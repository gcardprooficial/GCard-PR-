-- O destino de um QR/NFC passa a aceitar QUALQUER link https (decisão do dono), não só Google/TOQY.
-- Continuam valendo as proteções estruturais: só https, sem usuário/senha, sem porta, sem endereço IP,
-- sem localhost/rede interna e sem esquemas como javascript: ou data:. Abuso (golpe, conteúdo ilegal) segue sendo
-- tratado por denúncia + desativação do código (tabela abuse_reports, status 'bloqueada').
-- Para VOLTAR a só Google/TOQY: DELETE FROM public.allowed_destination_hosts WHERE host = '*';
-- Idempotente.

ALTER TABLE public.allowed_destination_hosts DROP CONSTRAINT IF EXISTS allowed_destination_hosts_host_check;
ALTER TABLE public.allowed_destination_hosts ADD CONSTRAINT allowed_destination_hosts_host_check
  CHECK (host = '*' OR (host = lower(host) AND host ~ '^[a-z0-9.-]+$'));

INSERT INTO public.allowed_destination_hosts (host, include_subdomains, note)
VALUES ('*', false, 'Qualquer link https (domínio público). Apague esta linha para voltar a só Google/TOQY.')
ON CONFLICT (host) DO NOTHING;

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
  IF h !~ '^[a-z0-9.-]+$' THEN RETURN false; END IF;                 -- recusa porta, barra invertida, espaço etc.
  -- domínio público: precisa de ponto, não pode ser IP, localhost nem rede interna
  IF h !~ '\.' OR h ~ '^[0-9.]+$' OR h = 'localhost' OR h ~ '\.(local|internal|localhost|lan|home|corp)$' THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_destination_hosts a
    WHERE a.host = '*' OR a.host = h OR (a.include_subdomains AND h LIKE '%.' || a.host)
  );
END;
$$;
