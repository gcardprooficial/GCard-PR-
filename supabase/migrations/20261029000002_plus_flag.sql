-- GCard Plus: o cliente precisa saber se a venda está liberada (app_settings é só da equipe).
-- Função só devolve true/false; nada mais de app_settings fica exposto. Aditiva e idempotente.
-- REVERTER: DROP FUNCTION IF EXISTS public.plus_enabled();
CREATE OR REPLACE FUNCTION public.plus_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value ->> 'enabled')::boolean FROM public.app_settings WHERE key = 'gcard_plus'), false);
$$;
REVOKE ALL ON FUNCTION public.plus_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.plus_enabled() TO authenticated;
