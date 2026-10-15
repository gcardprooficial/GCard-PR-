-- Única fonte dos hosts aceitos como destino de uma placa (/r, /ativar e gatilho do banco).
-- Compatível: os hosts do Google que estavam fixos em 3 lugares entram aqui com o mesmo
-- comportamento de hoje (só HTTPS). Acrescenta toqy.com.br (e subdomínios).
-- Reversível: DROP TRIGGER/FUNCTION abaixo e restaurar o gatilho de 20260915120000.

CREATE TABLE IF NOT EXISTS public.allowed_destination_hosts (
  host               TEXT PRIMARY KEY CHECK (host = lower(host) AND host ~ '^[a-z0-9.-]+$'),
  include_subdomains BOOLEAN NOT NULL DEFAULT false,
  note               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_destination_hosts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.allowed_destination_hosts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.allowed_destination_hosts TO authenticated;
GRANT ALL ON public.allowed_destination_hosts TO service_role;

DROP POLICY IF EXISTS "dest hosts read" ON public.allowed_destination_hosts;
CREATE POLICY "dest hosts read" ON public.allowed_destination_hosts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dest hosts team write" ON public.allowed_destination_hosts;
CREATE POLICY "dest hosts team write" ON public.allowed_destination_hosts FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

INSERT INTO public.allowed_destination_hosts (host, include_subdomains, note) VALUES
  ('search.google.com',  false, 'Google (avaliação)'),
  ('www.google.com',     false, 'Google'),
  ('google.com',         false, 'Google'),
  ('maps.google.com',    false, 'Google Maps'),
  ('g.page',             false, 'Google (link curto)'),
  ('toqy.com.br',        true,  'TOQY e subdomínios (*.toqy.com.br)'),
  ('www.toqy.com.br',    false, 'TOQY')
ON CONFLICT (host) DO NOTHING;

-- true se a URL é https, sem usuário/senha, sem porta diferente de 443 e com host permitido.
CREATE OR REPLACE FUNCTION public.is_allowed_destination(_url TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  authority TEXT;
  h TEXT;
BEGIN
  IF _url IS NULL OR length(_url) > 2000 THEN RETURN false; END IF;
  authority := substring(_url FROM '^https://([^/?#]*)');
  IF authority IS NULL OR authority = '' OR position('@' IN authority) > 0 THEN RETURN false; END IF;
  h := lower(regexp_replace(authority, ':443$', ''));
  IF h !~ '^[a-z0-9.-]+$' THEN RETURN false; END IF;  -- recusa porta, barra invertida, espaço etc.
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_destination_hosts a
    WHERE a.host = h OR (a.include_subdomains AND h LIKE '%.' || a.host)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.is_allowed_destination(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_destination(TEXT) TO authenticated, service_role;

-- Gatilho do revendedor: mesma regra de antes, agora lendo a tabela.
CREATE OR REPLACE FUNCTION public.guard_reseller_plate_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF app_private.is_team(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.token <> OLD.token
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.batch_id IS DISTINCT FROM OLD.batch_id
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.business_id IS DISTINCT FROM OLD.business_id
     OR NEW.scan_count <> OLD.scan_count THEN
    RAISE EXCEPTION 'Alteração não permitida';
  END IF;
  IF NEW.status NOT IN ('ativada', 'nao_ativada') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF NEW.destination_url IS NOT NULL AND NOT public.is_allowed_destination(NEW.destination_url) THEN
    RAISE EXCEPTION 'Link precisa ser do Google ou do TOQY (https)';
  END IF;
  RETURN NEW;
END;
$$;
