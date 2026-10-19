-- Segundo aceite "Marusso" (versão marusso-2026-10-v1). ADITIVA e idempotente. O aceite 2026-10-v1 continua como está.
--  1) texto exato da nova versão em consent_texts;
--  2) consent_records passa a aceitar a origem 'configuracoes' (interruptor na conta);
--  3) cadastro: handle_new_user também registra o aceite Marusso quando a caixa separada vem marcada;
--  4) hub: 'configuracoes' com accepted = false também é revogação (descadastro total), além de 'sair'.
-- Aceite = linha em consent_records (accepted, versão, origem). Não marcar a caixa não grava nada e não emite evento.
--
-- handle_new_user parte da definição LIDA EM PRODUÇÃO (pg_get_functiondef) e só acrescenta o bloco do aceite Marusso.
-- TRAVA: se a função do banco não for a conferida (md5 406e680653ba454b7648d0c2e4b80b67) e ainda não tiver o aceite,
-- a migração ABORTA sem alterar nada. Tudo roda numa transação: ou entra tudo, ou nada.
--
-- REVERTER:
--   -- 1) DELETE FROM public.consent_texts WHERE version = 'marusso-2026-10-v1';   (só se nenhum consent_records usa)
--   -- 2) recriar a restrição sem 'configuracoes' (só se nenhuma linha usa essa origem)
--   -- 3) recriar handle_new_user sem o bloco "Segundo aceite" (definição conferida: md5 406e680653ba454b7648d0c2e4b80b67)
--   -- 4) reaplicar hub_outbox_from_consent de 20261018000000

BEGIN;

-- 1) Texto exato ------------------------------------------------------------------------------------------------
INSERT INTO public.consent_texts (version, text) VALUES
  ('marusso-2026-10-v1',
   'Quero receber novidades e ofertas da Marusso Produções (TOQY, GCard-PRÓ, cursos e outros produtos) por e-mail. Posso sair quando quiser.')
ON CONFLICT (version) DO NOTHING;

-- 2) Origem 'configuracoes' ---------------------------------------------------------------------------------------
DO $$
DECLARE c TEXT;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.consent_records'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%source%'
  LOOP
    EXECUTE format('ALTER TABLE public.consent_records DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.consent_records ADD CONSTRAINT consent_records_source_check
    CHECK (source IN ('cadastro', 'checkout', 'gerador', 'sair', 'configuracoes'));
END
$$;

-- 3) Cadastro ---------------------------------------------------------------------------------------------------------
-- 3a) Trava: só segue se a função for a conferida em produção (ou se já tiver o aceite Marusso).
DO $$
DECLARE def TEXT := pg_get_functiondef('public.handle_new_user'::regproc);
BEGIN
  IF position('marusso_consent' IN def) = 0 AND md5(def) <> '406e680653ba454b7648d0c2e4b80b67' THEN
    RAISE EXCEPTION 'handle_new_user mudou desde a versão conferida (md5 atual %). Nada foi alterado; revisar antes de aplicar.', md5(def);
  END IF;
END
$$;

-- 3b) Definição de produção + o bloco do aceite Marusso (única mudança).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ft JSONB := public.clean_first_touch(NEW.raw_user_meta_data -> 'first_touch');
  consent_ok BOOLEAN := COALESCE((NEW.raw_user_meta_data ->> 'marketing_consent') = 'true', false);
  consent_ver TEXT := NEW.raw_user_meta_data ->> 'consent_version';
BEGIN
  INSERT INTO public.profiles (id, full_name, email, first_touch)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, ft)
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.track_event('conta_criada', NEW.id, NEW.email, NULL, NULL, ft, '{}'::jsonb, 'conta_criada:' || NEW.id);

  IF consent_ver IS NOT NULL AND EXISTS (SELECT 1 FROM public.consent_texts WHERE version = consent_ver) THEN
    INSERT INTO public.consent_records (email, user_id, accepted, text_version, source)
    VALUES (lower(NEW.email), NEW.id, consent_ok, consent_ver, 'cadastro');
    IF consent_ok THEN
      INSERT INTO public.marketing_contacts (email, full_name, marketing_consent_at)
      VALUES (lower(NEW.email), NEW.raw_user_meta_data ->> 'full_name', now())
      ON CONFLICT (email) DO UPDATE SET marketing_consent_at = now(), marketing_unsubscribed_at = NULL, updated_at = now();
    END IF;
  END IF;

  -- Segundo aceite (Marusso): caixa separada. Só grava quando marcada. Falha aqui não pode impedir o cadastro.
  IF COALESCE((NEW.raw_user_meta_data ->> 'marusso_consent') = 'true', false)
     AND EXISTS (SELECT 1 FROM public.consent_texts WHERE version = 'marusso-2026-10-v1') THEN
    BEGIN
      INSERT INTO public.consent_records (email, user_id, accepted, text_version, source)
      VALUES (lower(NEW.email), NEW.id, true, 'marusso-2026-10-v1', 'cadastro');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user: aceite Marusso não registrado (SQLSTATE %)', SQLSTATE;
    END;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) Hub: revogação = descadastro ('sair') OU desligar o interruptor da conta ('configuracoes'). --------------------
-- Única mudança em relação a 20261018000000: o IF que decide o que NÃO enfileira.
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
    IF NOT NEW.accepted AND NEW.source NOT IN ('sair', 'configuracoes') THEN RETURN NEW; END IF;   -- caixa não marcada, não é revogação
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
      CASE WHEN NEW.accepted THEN 0 ELSE 10 END
    )
    ON CONFLICT (event_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_outbox_from_consent falhou (SQLSTATE %)', SQLSTATE;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.hub_outbox_from_consent() FROM PUBLIC, anon, authenticated;

COMMIT;
