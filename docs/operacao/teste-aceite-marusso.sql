-- Teste do aceite Marusso EM TRANSAÇÃO COM ROLLBACK (rode ANTES da migração de verdade).
-- Aplica a migração dentro da transação, cria contas de teste em auth.users, confere o resultado e DESFAZ TUDO
-- (inclusive a função handle_new_user e as contas). Esperado: todas as linhas com ok = true.
-- Um erro em handle_new_user poderia impedir cadastros: por isso o teste cobre também a falha do aceite Marusso.

BEGIN;

CREATE TEMP TABLE _res (teste TEXT, ok BOOLEAN);

-- ===== 1) a migração (a mesma que vai para produção, sem o BEGIN/COMMIT dela) =====
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



-- ===== 2) contas de teste =====
DO $$
DECLARE
  u1 UUID := gen_random_uuid(); u2 UUID := gen_random_uuid(); u3 UUID := gen_random_uuid();
  u4 UUID := gen_random_uuid(); u5 UUID := gen_random_uuid(); u6 UUID := gen_random_uuid();
  def TEXT;
BEGIN
  def := pg_get_functiondef('public.handle_new_user'::regproc);
  INSERT INTO _res VALUES ('0a função nova tem o bloco Marusso', position('marusso_consent' IN def) > 0);
  INSERT INTO _res VALUES ('0b função nova manteve profiles, evento e consentimento atual',
    position('INSERT INTO public.profiles' IN def) > 0 AND position('conta_criada' IN def) > 0 AND position('marketing_consent' IN def) > 0);
  INSERT INTO _res VALUES ('0c texto Marusso gravado exato em consent_texts',
    (SELECT text FROM public.consent_texts WHERE version = 'marusso-2026-10-v1') =
    'Quero receber novidades e ofertas da Marusso Produções (TOQY, GCard-PRÓ, cursos e outros produtos) por e-mail. Posso sair quando quiser.');

  -- u1: as DUAS caixas marcadas
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (u1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-marusso-1@exemplo.com',
          '{"first_touch":{"utm_source":"teste"},"marketing_consent":true,"consent_version":"2026-10-v1","marusso_consent":true}', now(), now());
  INSERT INTO _res VALUES ('1a u1: perfil criado', EXISTS (SELECT 1 FROM public.profiles WHERE id = u1));
  INSERT INTO _res VALUES ('1b u1: aceite atual (2026-10-v1) gravado como antes',
    EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u1 AND text_version = '2026-10-v1' AND accepted AND source = 'cadastro'));
  INSERT INTO _res VALUES ('1c u1: aceite Marusso gravado (cadastro)',
    EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u1 AND text_version = 'marusso-2026-10-v1' AND accepted AND source = 'cadastro'));
  INSERT INTO _res VALUES ('1d u1: contato de marketing do GCard criado como antes',
    EXISTS (SELECT 1 FROM public.marketing_contacts WHERE email = 'teste-marusso-1@exemplo.com' AND marketing_consent_at IS NOT NULL));
  INSERT INTO _res VALUES ('1e u1: 2 consentimento_dado no outbox (um por versão)',
    (SELECT count(*) FROM public.hub_outbox WHERE payload #>> '{person,email}' = 'teste-marusso-1@exemplo.com' AND payload ->> 'type' = 'consentimento_dado') = 2);

  -- u2: nenhuma caixa marcada
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (u2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-marusso-2@exemplo.com',
          '{"marketing_consent":false,"consent_version":"2026-10-v1"}', now(), now());
  INSERT INTO _res VALUES ('2a u2: perfil criado', EXISTS (SELECT 1 FROM public.profiles WHERE id = u2));
  INSERT INTO _res VALUES ('2b u2: sem aceite Marusso', NOT EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u2 AND text_version = 'marusso-2026-10-v1'));
  INSERT INTO _res VALUES ('2c u2: recusa do aceite atual continua gravada (accepted=false) e NÃO vira evento',
    EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u2 AND text_version = '2026-10-v1' AND NOT accepted)
    AND NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE payload #>> '{person,email}' = 'teste-marusso-2@exemplo.com' AND payload ->> 'type' LIKE 'consentimento%'));

  -- u3: só a caixa Marusso
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (u3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-marusso-3@exemplo.com',
          '{"marusso_consent":true}', now(), now());
  INSERT INTO _res VALUES ('3a u3: perfil criado', EXISTS (SELECT 1 FROM public.profiles WHERE id = u3));
  INSERT INTO _res VALUES ('3b u3: só o aceite Marusso gravado',
    (SELECT count(*) FROM public.consent_records WHERE user_id = u3) = 1
    AND EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u3 AND text_version = 'marusso-2026-10-v1' AND accepted));

  -- u4: metadata vazio (cadastro de sempre)
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (u4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-marusso-4@exemplo.com', '{}', now(), now());
  INSERT INTO _res VALUES ('4 u4: perfil criado e nenhum consentimento', EXISTS (SELECT 1 FROM public.profiles WHERE id = u4)
    AND NOT EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u4));

  -- u5: valor inválido não conta como aceite (só o texto "true")
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (u5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-marusso-5@exemplo.com',
          '{"marusso_consent":"sim"}', now(), now());
  INSERT INTO _res VALUES ('5 u5: "sim" NÃO conta como aceite, cadastro segue', EXISTS (SELECT 1 FROM public.profiles WHERE id = u5)
    AND NOT EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u5));

  -- u6: o registro do aceite Marusso FALHA (simulado): o cadastro NÃO pode quebrar
  ALTER TABLE public.consent_records ADD CONSTRAINT zz_teste_falha CHECK (text_version <> 'marusso-2026-10-v1') NOT VALID;
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  VALUES (u6, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teste-marusso-6@exemplo.com',
          '{"marusso_consent":true}', now(), now());
  INSERT INTO _res VALUES ('6 u6: falha no aceite Marusso NÃO impede o cadastro (perfil criado, sem aceite)',
    EXISTS (SELECT 1 FROM public.profiles WHERE id = u6) AND NOT EXISTS (SELECT 1 FROM public.consent_records WHERE user_id = u6));
  ALTER TABLE public.consent_records DROP CONSTRAINT zz_teste_falha;

  -- origem 'configuracoes' aceita; desligar vira evento; recusa em checkout não
  INSERT INTO public.consent_records (email, accepted, text_version, source)
  VALUES ('teste-marusso-7@exemplo.com', true, 'marusso-2026-10-v1', 'configuracoes'),
         ('teste-marusso-7@exemplo.com', false, 'marusso-2026-10-v1', 'configuracoes'),
         ('teste-marusso-7@exemplo.com', false, 'marusso-2026-10-v1', 'checkout');
  INSERT INTO _res VALUES ('7a configurações: ligar gera consentimento_dado (origem configuracoes)',
    EXISTS (SELECT 1 FROM public.hub_outbox WHERE payload #>> '{person,email}' = 'teste-marusso-7@exemplo.com'
            AND payload ->> 'type' = 'consentimento_dado' AND payload #>> '{data,origem}' = 'configuracoes'));
  INSERT INTO _res VALUES ('7b configurações: desligar gera consentimento_revogado (prioridade 10)',
    EXISTS (SELECT 1 FROM public.hub_outbox WHERE payload #>> '{person,email}' = 'teste-marusso-7@exemplo.com'
            AND payload ->> 'type' = 'consentimento_revogado' AND payload #>> '{data,origem}' = 'configuracoes' AND priority = 10));
  INSERT INTO _res VALUES ('7c recusa no checkout NÃO gera evento',
    (SELECT count(*) FROM public.hub_outbox WHERE payload #>> '{person,email}' = 'teste-marusso-7@exemplo.com') = 2);
END $$;

SELECT teste, ok FROM _res ORDER BY ok, teste;
ROLLBACK;
