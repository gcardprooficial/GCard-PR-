-- Endurece permissões (achados da auditoria de RLS do banco vivo, 2026-10-15). Nada aqui muda o que o site faz:
-- conferi no código que (a) nenhuma tela pública escreve com o cliente do navegador, (b) todo chamador de
-- wa_sync_contacts no servidor usa a chave de serviço, (c) nenhuma função de gatilho é chamada como RPC.
-- Idempotente. Para desfazer, veja o bloco REVERTER no fim.

-- 1) wa_sync_contacts: visitante sem login não pode chamar -------------------------------------
-- A checagem antiga ("se há usuário e ele não é da equipe, recusa") deixava passar quem não tem usuário (anon).
-- Em vez de reescrever as ~100 linhas da função, ela vira "impl" e uma função fina confere a permissão e a chama.
DO $$
BEGIN
  IF to_regprocedure('public.wa_sync_contacts_impl()') IS NULL THEN
    ALTER FUNCTION public.wa_sync_contacts() RENAME TO wa_sync_contacts_impl;
  END IF;
END
$$;
REVOKE ALL ON FUNCTION public.wa_sync_contacts_impl() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wa_sync_contacts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Passa: servidor (chave de serviço), SQL Editor/administração do banco (sessão postgres) e equipe logada.
  -- Recusa: visitante (anon) e usuário comum.
  IF NOT (
       auth.role() IN ('service_role', 'supabase_admin')
    OR session_user IN ('postgres', 'supabase_admin')
    OR app_private.is_team(auth.uid())
  ) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  RETURN public.wa_sync_contacts_impl();
END;
$$;
REVOKE ALL ON FUNCTION public.wa_sync_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wa_sync_contacts() TO authenticated, service_role;

-- 2) Menor privilégio nas tabelas ---------------------------------------------------------------
-- A RLS continua sendo a regra de acesso. Aqui só some o que ela nem controla (TRUNCATE, TRIGGER, REFERENCES)
-- e a escrita do visitante, que nenhuma tela pública usa. A escrita do usuário logado (authenticated) fica,
-- porque o painel e o /ativar dependem dela (a RLS decide linha a linha).
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM authenticated;

-- 3) Funções de gatilho: ninguém as chama de fora ---------------------------------------------
-- O gatilho dispara sem checar EXECUTE de quem faz a escrita, então isto não afeta nada.
REVOKE EXECUTE ON FUNCTION public.handle_user_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_track_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plates_track_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_reseller_plate_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plates_track_dates() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.plates_require_sold_to_activate() FROM PUBLIC, anon, authenticated;

-- REVERTER (só se algo quebrar; rode o que for preciso):
--   GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
--   GRANT TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.handle_user_confirmed(), public.orders_track_events(),
--     public.plates_track_events(), public.guard_reseller_plate_update(), public.plates_track_dates(),
--     public.plates_require_sold_to_activate() TO anon, authenticated;
--   -- wa_sync_contacts: DROP FUNCTION public.wa_sync_contacts(); ALTER FUNCTION public.wa_sync_contacts_impl() RENAME TO wa_sync_contacts;
