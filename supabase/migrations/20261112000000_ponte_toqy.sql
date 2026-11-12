-- Ponte GCard <-> Toqy (2026-11-12). Só aditivo: colunas e tabela novas e duas funções reescritas com um campo a mais.
-- Rodar no SQL Editor do Supabase do GCard (produção). Reversível: ver o fim do arquivo.

-- 1) Liberação de domínio vinda do Toqy: de onde veio a linha e de quem é.
ALTER TABLE public.allowed_destination_hosts ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.allowed_destination_hosts ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- 2) Auditoria das chamadas da rota assinada (sem o corpo bruto). Só o servidor escreve e lê.
CREATE TABLE IF NOT EXISTS public.toqy_partner_audit (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  host       TEXT NOT NULL,
  action     TEXT NOT NULL,
  result     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.toqy_partner_audit ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.toqy_partner_audit TO service_role;

-- 3) Evento codigo_ativado passa a levar destino_tipo: toqy, google ou outro (só o tipo, nunca a URL).
CREATE OR REPLACE FUNCTION public.plates_track_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  who UUID := auth.uid();
  h   TEXT;
  tipo TEXT;
BEGIN
  IF NEW.status = 'ativada' AND OLD.status IS DISTINCT FROM 'ativada' THEN
    h := lower(substring(NEW.destination_url FROM '^https://([^/?#]*)'));
    tipo := CASE
      WHEN h IS NULL THEN 'outro'
      WHEN h = 'toqy.com.br' OR h LIKE '%.toqy.com.br' THEN 'toqy'
      WHEN EXISTS (SELECT 1 FROM public.allowed_destination_hosts a WHERE a.host = h AND a.source = 'toqy') THEN 'toqy'
      WHEN h ~ '(^|\.)(google\.com|g\.page)$' THEN 'google'
      ELSE 'outro'
    END;
    PERFORM public.track_event('codigo_ativado', who, NULL, NEW.order_id, NEW.id, NULL,
      jsonb_build_object('short_code', NEW.short_code, 'destino_tipo', tipo), NULL);
  END IF;
  IF NEW.destination_url IS DISTINCT FROM OLD.destination_url AND NEW.destination_url IS NOT NULL AND OLD.destination_url IS NOT NULL THEN
    PERFORM public.track_event('destino_alterado', who, NULL, NEW.order_id, NEW.id, NULL,
      jsonb_build_object('short_code', NEW.short_code, 'host', substring(NEW.destination_url FROM '^https://([^/?#]*)')), NULL);
  END IF;
  RETURN NEW;
END;
$$;

-- 4) A fila do Hub deixa passar a chave nova do codigo_ativado (o resto da função é igual à versão de 20261029000001).
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
      WHEN 'codigo_ativado'      THEN ARRAY['short_code', 'destino_tipo']
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

/* Para desfazer (volta ao comportamento anterior; não apaga dados):
   -- recriar plates_track_events e hub_outbox_from_events com os arquivos 20261015020000 e 20261029000001;
   ALTER TABLE public.allowed_destination_hosts DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS owner_email;
   DROP TABLE IF EXISTS public.toqy_partner_audit;
*/
