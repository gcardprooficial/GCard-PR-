BEGIN;

-- GCard Plus: novos tipos de evento para o Hub. ADITIVA e idempotente.
--  plus_assinado / plus_atrasado / plus_cancelado (data: plan) e qr_criado (data: só o host, nunca a URL).
-- Só amplia (1) o CHECK de events.type e (2) a lista de chaves permitidas no gatilho do Hub (resto da função idêntico a 20261018000000).
-- REVERTER: recriar o CHECK sem os 4 tipos (só se nenhuma linha usa) e reaplicar hub_outbox_from_events de 20261018000000.

DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.events'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%conta_criada%'
  LOOP
    EXECUTE format('ALTER TABLE public.events DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.events ADD CONSTRAINT events_type_check CHECK (type IN (
    'conta_criada', 'email_confirmado', 'produto_visto', 'checkout_iniciado',
    'pagamento_iniciado', 'pedido_pago', 'codigo_ativado', 'destino_alterado', 'qr_baixado',
    'plus_assinado', 'plus_atrasado', 'plus_cancelado', 'qr_criado'));
END
$$;

-- Trava: só segue se a função do banco for a conferida em produção (md5 5b6ff4fc84a44b620dc8d26df9964231) ou já tiver os tipos plus.
DO $$
DECLARE def TEXT := pg_get_functiondef('public.hub_outbox_from_events'::regproc);
BEGIN
  IF position('plus_assinado' IN def) = 0 AND md5(def) <> '5b6ff4fc84a44b620dc8d26df9964231' THEN
    RAISE EXCEPTION 'hub_outbox_from_events mudou desde a versão conferida (md5 atual %). Nada foi alterado.', md5(def);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.hub_outbox_from_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  mail    TEXT;
  ord_num BIGINT;
  ord_mail TEXT;
  allowed TEXT[];
  d       JSONB;
  origin  JSONB;
  env     JSONB;
BEGIN
  BEGIN
    mail := lower(NULLIF(trim(NEW.email), ''));
    IF NEW.order_id IS NOT NULL THEN
      SELECT order_number, lower(customer_email) INTO ord_num, ord_mail FROM public.orders WHERE id = NEW.order_id;
    END IF;
    IF mail IS NULL THEN mail := NULLIF(ord_mail, ''); END IF;
    IF mail IS NULL AND NEW.person_id IS NOT NULL THEN
      SELECT lower(email) INTO mail FROM auth.users WHERE id = NEW.person_id;
    END IF;
    IF mail IS NULL AND NEW.type = 'produto_visto' THEN RETURN NEW; END IF;

    -- data só com as chaves do contrato (nunca a URL de destino, nada de dados pessoais)
    allowed := CASE NEW.type
      WHEN 'produto_visto'       THEN ARRAY['slug', 'origin']
      WHEN 'checkout_iniciado'   THEN ARRAY['order_number', 'total_cents', 'kind']
      WHEN 'pagamento_iniciado'  THEN ARRAY['provider']
      WHEN 'pedido_pago'         THEN ARRAY['order_number', 'total_cents', 'provider', 'kind']
      WHEN 'codigo_ativado'      THEN ARRAY['short_code']
      WHEN 'destino_alterado'    THEN ARRAY['short_code', 'host']
      WHEN 'qr_baixado'          THEN ARRAY['slug']
      WHEN 'plus_assinado'       THEN ARRAY['plan']
      WHEN 'plus_atrasado'       THEN ARRAY['plan']
      WHEN 'plus_cancelado'      THEN ARRAY['plan']
      WHEN 'qr_criado'           THEN ARRAY['host']
      ELSE ARRAY[]::TEXT[]
    END;
    d := COALESCE((SELECT jsonb_object_agg(k, v) FROM jsonb_each(COALESCE(NEW.data, '{}'::jsonb)) AS t(k, v) WHERE k = ANY (allowed)), '{}'::jsonb);
    -- pedido_pago do banco não leva o número do pedido; o contrato exige.
    IF NEW.type IN ('checkout_iniciado', 'pedido_pago') AND NOT (d ? 'order_number') AND ord_num IS NOT NULL THEN
      d := d || jsonb_build_object('order_number', ord_num);
    END IF;

    -- só as 5 chaves de origem do contrato (o first_touch do banco traz também landing/referrer/ts)
    origin := jsonb_strip_nulls(jsonb_build_object(
      'utm_source',   NEW.first_touch ->> 'utm_source',
      'utm_medium',   NEW.first_touch ->> 'utm_medium',
      'utm_campaign', NEW.first_touch ->> 'utm_campaign',
      'utm_content',  NEW.first_touch ->> 'utm_content',
      'ref',          NEW.first_touch ->> 'ref'
    ));

    env := jsonb_build_object(
      'schema_version', 1,
      'event_id',       'gcard:' || NEW.id,
      'type',           NEW.type,
      'occurred_at',    to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'source',         'gcard',
      'person',         jsonb_strip_nulls(jsonb_build_object('email', mail, 'external_id', NEW.person_id)),
      'data',           d
    );
    IF origin <> '{}'::jsonb THEN env := env || jsonb_build_object('context', jsonb_build_object('origin', origin)); END IF;

    INSERT INTO public.hub_outbox (event_id, payload, status)
    VALUES ('gcard:' || NEW.id, env, CASE WHEN mail IS NULL THEN 'sem_email' ELSE 'pendente' END)
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_outbox_from_events falhou (SQLSTATE %)', SQLSTATE;   -- sem dado pessoal no aviso
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hub_outbox_from_events() FROM PUBLIC, anon, authenticated;

COMMIT;
