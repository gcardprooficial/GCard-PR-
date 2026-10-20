-- GCard Plus: a EQUIPE enxerga o Plus mesmo com a flag desligada (para testar a tela sem abrir a venda para clientes).
-- Cliente comum continua dependendo só da flag. O cron e o servidor (sem usuário logado) também só olham a flag.
-- REVERTER: recriar plus_enabled() só com o SELECT da flag (migração 20261029000002_plus_flag.sql).
CREATE OR REPLACE FUNCTION public.plus_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value ->> 'enabled')::boolean FROM public.app_settings WHERE key = 'gcard_plus'), false)
      OR COALESCE(app_private.is_team(auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.plus_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plus_enabled() TO authenticated;
