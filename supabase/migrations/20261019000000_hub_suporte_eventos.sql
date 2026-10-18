-- Eventos de suporte para o hub (contrato v1, seção 7): suporte_mensagem e suporte_resposta, pelo outbox.
-- ADITIVA. Só cliente IDENTIFICADO (e-mail conhecido) gera evento; visitante sem e-mail e anexos nunca entram.
-- Falha em qualquer gatilho daqui NUNCA impede a gravação da mensagem original.
--
-- REVERTER:
--   DROP TRIGGER IF EXISTS hub_outbox_wa_msg_trg ON public.wa_messages;
--   DROP TRIGGER IF EXISTS hub_outbox_chat_msg_trg ON public.chat_messages;
--   DROP FUNCTION IF EXISTS public.hub_outbox_from_wa_message();
--   DROP FUNCTION IF EXISTS public.hub_outbox_from_chat_message();
--   DROP FUNCTION IF EXISTS public.hub_support_text(TEXT);

-- Texto da mensagem para o hub: números longos (CPF, cartão, telefone, datas completas) são trocados por um aviso
-- e o resultado é cortado em 300 caracteres. A pessoa pode ter digitado dado sensível no chat.
CREATE OR REPLACE FUNCTION public.hub_support_text(_body TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT left(regexp_replace(COALESCE(_body, ''), '\d[\d.\-/ ]{7,}\d', '[número removido]', 'g'), 300);
$$;

-- 1) WhatsApp: cliente (entrada) → suporte_mensagem; equipe (saída humana) → suporte_resposta ----------------------------
-- O e-mail vem do contato do WhatsApp (wa_contacts), ligado pelo telefone ao pedido. Sem e-mail: nada é enviado.
CREATE OR REPLACE FUNCTION public.hub_outbox_from_wa_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wid     TEXT;
  mail    TEXT;
  ev_type TEXT;
  d       JSONB;
BEGIN
  BEGIN
    IF NEW.direction = 'in' AND NEW.sender = 'cliente' THEN
      IF NEW.kind <> 'text' OR NULLIF(trim(COALESCE(NEW.body, '')), '') IS NULL THEN RETURN NEW; END IF;   -- sem anexo
      ev_type := 'suporte_mensagem';
    ELSIF NEW.direction = 'out' AND NEW.sender = 'humano' THEN
      ev_type := 'suporte_resposta';
    ELSE
      RETURN NEW;                                                                                         -- bot não conta
    END IF;

    SELECT v.wa_id INTO wid FROM public.wa_conversations v WHERE v.id = NEW.conversation_id;
    IF wid IS NULL OR length(wid) < 12 THEN RETURN NEW; END IF;
    SELECT lower(NULLIF(trim(k.email), '')) INTO mail FROM public.wa_contacts k WHERE k.phone_key = substr(wid, 3, 2) || right(wid, 8);
    IF mail IS NULL THEN RETURN NEW; END IF;                                                              -- só cliente identificado

    d := CASE ev_type
      WHEN 'suporte_mensagem' THEN jsonb_build_object('conversa', NEW.conversation_id, 'texto', public.hub_support_text(NEW.body), 'canal', 'whatsapp')
      ELSE jsonb_build_object('conversa', NEW.conversation_id)
    END;

    INSERT INTO public.hub_outbox (event_id, payload, status)
    VALUES (
      'gcard:suporte:' || NEW.id,
      jsonb_build_object(
        'schema_version', 1,
        'event_id',       'gcard:suporte:' || NEW.id,
        'type',           ev_type,
        'occurred_at',    to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source',         'gcard',
        'person',         jsonb_build_object('email', mail),
        'data',           d
      ),
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_outbox_from_wa_message falhou (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hub_outbox_from_wa_message() FROM PUBLIC, anon, authenticated;

-- 2) Chat do site: visitante com e-mail → suporte_mensagem; equipe → suporte_resposta ---------------------------------------
CREATE OR REPLACE FUNCTION public.hub_outbox_from_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mail    TEXT;
  ev_type TEXT;
  d       JSONB;
BEGIN
  BEGIN
    IF NEW.sender_type = 'visitor' THEN
      ev_type := 'suporte_mensagem';
    ELSIF NEW.sender_type = 'staff' THEN
      ev_type := 'suporte_resposta';
    ELSE
      RETURN NEW;
    END IF;

    SELECT lower(NULLIF(trim(c.visitor_email), '')) INTO mail FROM public.chat_conversations c WHERE c.id = NEW.conversation_id;
    IF mail IS NULL THEN RETURN NEW; END IF;                                                              -- visitante sem e-mail: nada

    d := CASE ev_type
      WHEN 'suporte_mensagem' THEN jsonb_build_object('conversa', NEW.conversation_id, 'texto', public.hub_support_text(NEW.body), 'canal', 'chat')
      ELSE jsonb_build_object('conversa', NEW.conversation_id)
    END;

    INSERT INTO public.hub_outbox (event_id, payload, status)
    VALUES (
      'gcard:suporte:' || NEW.id,
      jsonb_build_object(
        'schema_version', 1,
        'event_id',       'gcard:suporte:' || NEW.id,
        'type',           ev_type,
        'occurred_at',    to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'source',         'gcard',
        'person',         jsonb_build_object('email', mail),
        'data',           d
      ),
      'pendente'
    )
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_outbox_from_chat_message falhou (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hub_outbox_from_chat_message() FROM PUBLIC, anon, authenticated;

-- 3) Gatilhos (só se a tabela existe neste banco) -------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.wa_messages') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hub_outbox_wa_msg_trg ON public.wa_messages;
    CREATE TRIGGER hub_outbox_wa_msg_trg AFTER INSERT ON public.wa_messages
      FOR EACH ROW EXECUTE FUNCTION public.hub_outbox_from_wa_message();
  END IF;
  IF to_regclass('public.chat_messages') IS NOT NULL AND to_regclass('public.chat_conversations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hub_outbox_chat_msg_trg ON public.chat_messages;
    CREATE TRIGGER hub_outbox_chat_msg_trg AFTER INSERT ON public.chat_messages
      FOR EACH ROW EXECUTE FUNCTION public.hub_outbox_from_chat_message();
  END IF;
END
$$;
