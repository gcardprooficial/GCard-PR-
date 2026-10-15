-- Teste de permissões (rodar no SQL Editor do Supabase, só leitura: tudo dentro de transação com ROLLBACK).
-- Esperado: cada linha da saída com ok = true. Qualquer false = furo; me mande a saída.

BEGIN;

CREATE TEMP TABLE _res (teste TEXT, ok BOOLEAN);
GRANT ALL ON _res TO anon, authenticated;

-- 1) Visitante (anon) NÃO lê tabelas internas -----------------------------------------------------
SET LOCAL ROLE anon;
DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['orders','order_items','plates','events','consent_records','internal_accounts',
                           'rate_limits','app_settings','abuse_reports','marketing_contacts','user_roles','profiles']
  LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      INSERT INTO _res VALUES ('anon lê '||t||' → 0 linhas', n = 0);
    EXCEPTION WHEN insufficient_privilege THEN
      INSERT INTO _res VALUES ('anon lê '||t||' → negado', true);
    WHEN undefined_table THEN
      INSERT INTO _res VALUES ('anon lê '||t||' → (tabela não existe)', true);
    END;
  END LOOP;
END $$;

-- 2) Visitante NÃO executa funções de relatório/limite --------------------------------------------
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['SELECT * FROM public.accounts_report()',
                           'SELECT * FROM public.funnel_report(current_date, current_date)',
                           'SELECT public.rate_limit_hit(''x'',1,60)',
                           'SELECT * FROM public.people_summary()',
                           'SELECT public.wa_sync_contacts()']
  LOOP
    BEGIN
      EXECUTE f;
      INSERT INTO _res VALUES ('anon executa: '||f, false);
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO _res VALUES ('anon bloqueado: '||f, true);
    END;
  END LOOP;
END $$;

-- 3) Visitante NÃO escreve ------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    INSERT INTO public.events (type) VALUES ('produto_visto');
    INSERT INTO _res VALUES ('anon escreve em events', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO _res VALUES ('anon bloqueado de escrever em events', true); END;
  BEGIN
    UPDATE public.orders SET payment_status = 'pago';
    INSERT INTO _res VALUES ('anon altera orders', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO _res VALUES ('anon bloqueado de alterar orders', true); END;
END $$;
RESET ROLE;

-- 4) Usuário comum logado (sem papel admin/staff): não lê pedidos de outros nem roda relatórios -----
-- Usa o primeiro usuário que NÃO é da equipe.
DO $$
DECLARE uid UUID; mail TEXT; n INT;
BEGIN
  SELECT u.id, u.email INTO uid, mail FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role IN ('admin','staff')) LIMIT 1;
  IF uid IS NULL THEN INSERT INTO _res VALUES ('(sem usuário comum para testar)', true); RETURN; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.orders WHERE customer_email IS DISTINCT FROM mail;
  INSERT INTO _res VALUES ('usuário comum não vê pedidos alheios', n = 0);
  BEGIN
    PERFORM * FROM public.accounts_report();
    INSERT INTO _res VALUES ('usuário comum executa accounts_report', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO _res VALUES ('usuário comum bloqueado em accounts_report', true); END;
  BEGIN
    PERFORM * FROM public.funnel_report(current_date, current_date);
    INSERT INTO _res VALUES ('usuário comum executa funnel_report', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO _res VALUES ('usuário comum bloqueado em funnel_report', true); END;
  SELECT count(*) INTO n FROM public.internal_accounts;
  INSERT INTO _res VALUES ('usuário comum não lê internal_accounts', n = 0);
  SELECT count(*) INTO n FROM public.events;
  INSERT INTO _res VALUES ('usuário comum não lê events', n = 0);
  EXECUTE 'RESET ROLE';
END $$;

SELECT teste, ok FROM _res ORDER BY ok, teste;
ROLLBACK;
