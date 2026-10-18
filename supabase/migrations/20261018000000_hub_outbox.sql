-- Outbox de eventos para o hub (contrato v1). ADITIVA: nada existente é alterado, só tabela, funções e gatilhos novos.
-- Com HUB_OUTBOX_ENABLED desligado (padrão) a rota de envio não manda nada; o outbox só acumula.
-- Falha em qualquer gatilho daqui NUNCA impede o evento, o cadastro, o consentimento nem o descadastro original.
--
-- REVERTER (nesta ordem):
--   DROP TRIGGER IF EXISTS hub_outbox_events_trg ON public.events;
--   DROP TRIGGER IF EXISTS hub_outbox_consent_trg ON public.consent_records;
--   DROP FUNCTION IF EXISTS public.hub_outbox_from_events();
--   DROP FUNCTION IF EXISTS public.hub_outbox_from_consent();
--   DROP FUNCTION IF EXISTS public.hub_outbox_claim(INTEGER);
--   DROP TABLE IF EXISTS public.hub_outbox;

-- 1) Tabela ------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hub_outbox (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        TEXT NOT NULL UNIQUE,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviado', 'morto', 'sem_email')),
  priority        SMALLINT NOT NULL DEFAULT 0,                 -- revogação de consentimento = 10: sai primeiro
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error      TEXT,                                        -- só código (http_500, rede, timeout…), nunca e-mail
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS hub_outbox_due_idx ON public.hub_outbox (status, next_attempt_at);
ALTER TABLE public.hub_outbox ENABLE ROW LEVEL SECURITY;      -- sem políticas: só o servidor (service_role) acessa
REVOKE ALL ON public.hub_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.hub_outbox TO service_role;

-- 2) Gatilho em events: monta o envelope do contrato -----------------------------------------------------
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
    -- Visitante anônimo vendo produto: é o evento mais frequente e nunca seria enviado. Nem guarda.
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
DROP TRIGGER IF EXISTS hub_outbox_events_trg ON public.events;
CREATE TRIGGER hub_outbox_events_trg AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.hub_outbox_from_events();

-- 3) Gatilho em consent_records: aceite e revogação ----------------------------------------------------------
-- accepted = true (qualquer origem) → consentimento_dado.
-- accepted = false e source = 'sair' (descadastro) → consentimento_revogado.
-- accepted = false vindo de cadastro, checkout ou gerador é só a caixa não marcada: NÃO enfileira nada.
CREATE OR REPLACE FUNCTION public.hub_outbox_from_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mail TEXT;
BEGIN
  BEGIN
    mail := lower(NULLIF(trim(NEW.email), ''));
    IF mail IS NULL THEN RETURN NEW; END IF;
    IF NOT NEW.accepted AND NEW.source <> 'sair' THEN RETURN NEW; END IF;   -- caixa não marcada, não é revogação
    INSERT INTO public.hub_outbox (event_id, payload, status, priority)
    VALUES (
      'gcard:consent:' || NEW.id,
      jsonb_build_object(
        'schema_version', 1,
        'event_id',       'gcard:consent:' || NEW.id,
        'type',           CASE WHEN NEW.accepted THEN 'consentimento_dado' ELSE 'consentimento_revogado' END,
        'occurred_at',    to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source',         'gcard',
        'person',         jsonb_strip_nulls(jsonb_build_object('email', mail, 'external_id', NEW.user_id)),
        'data',           jsonb_build_object('texto_versao', NEW.text_version, 'origem', NEW.source)
      ),
      'pendente',
      CASE WHEN NEW.accepted THEN 0 ELSE 10 END      -- revogação sai primeiro
    )
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_outbox_from_consent falhou (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hub_outbox_from_consent() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS hub_outbox_consent_trg ON public.consent_records;
CREATE TRIGGER hub_outbox_consent_trg AFTER INSERT ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.hub_outbox_from_consent();

-- 4) Pegar o próximo lote para enviar ----------------------------------------------------------------------------
-- Escolhe os vencidos com FOR UPDATE SKIP LOCKED e já "aluga" cada item por 5 minutos (next_attempt_at),
-- para duas execuções simultâneas da rota não enviarem o mesmo item. O resultado do envio atualiza depois.
CREATE OR REPLACE FUNCTION public.hub_outbox_claim(_limit INTEGER DEFAULT 50)
RETURNS SETOF public.hub_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  UPDATE public.hub_outbox o
     SET next_attempt_at = now() + interval '5 minutes'
   WHERE o.id IN (
     SELECT h.id FROM public.hub_outbox h
      WHERE h.status = 'pendente' AND h.next_attempt_at <= now()
      ORDER BY h.priority DESC, h.next_attempt_at, h.created_at
      LIMIT LEAST(GREATEST(_limit, 1), 200)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING o.*;
END;
$$;
REVOKE ALL ON FUNCTION public.hub_outbox_claim(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_outbox_claim(INTEGER) TO service_role;
