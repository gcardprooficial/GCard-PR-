-- Destinos: troca o "qualquer link" ('*') por uma lista ampliada, com pedido de liberação, endereço exato e histórico.
-- Só HTTPS (a função is_allowed_destination já recusa o resto). Idempotente.
--
-- ATENÇÃO (compatibilidade): ao tirar o '*', todo código JÁ ATIVO cujo site não esteja na lista nova pararia de abrir no /r.
-- Por isso o passo 2 libera automaticamente os sites que JÁ estão em uso. Revise-os com o SELECT do passo 5.
--
-- REVERTER (volta ao "qualquer link"):
--   INSERT INTO public.allowed_destination_hosts (host, include_subdomains, note)
--   VALUES ('*', false, 'Qualquer link https (domínio público). Apague esta linha para voltar a só Google/TOQY.') ON CONFLICT DO NOTHING;
-- Para desfazer só as tabelas novas: DROP TABLE public.destination_history, public.destination_requests, public.allowed_destination_urls;

-- 1) Lista ampliada --------------------------------------------------------------------------------
INSERT INTO public.allowed_destination_hosts (host, include_subdomains, note) VALUES
  ('wa.me',            false, 'WhatsApp (link curto)'),
  ('api.whatsapp.com', false, 'WhatsApp'),
  ('whatsapp.com',     true,  'WhatsApp e subdomínios'),
  ('instagram.com',    true,  'Instagram e subdomínios (www.)'),
  ('facebook.com',     true,  'Facebook e subdomínios (www., m.)'),
  ('fb.com',           true,  'Facebook (link curto)'),
  ('tiktok.com',       true,  'TikTok e subdomínios (vm.)'),
  ('youtube.com',      true,  'YouTube e subdomínios (www., m.)'),
  ('youtu.be',         false, 'YouTube (link curto)'),
  ('maps.app.goo.gl',  false, 'Google Maps (link curto)'),
  ('linktr.ee',        false, 'Linktree'),
  ('ifood.com.br',     true,  'iFood e subdomínios (www.)')
ON CONFLICT (host) DO NOTHING;

-- 2) Não quebrar o que já está em uso: libera os sites dos códigos ativos que a lista nova não cobre ----
INSERT INTO public.allowed_destination_hosts (host, include_subdomains, note)
SELECT DISTINCT x.h, false, 'já em uso em ' || to_char(now(), 'YYYY-MM-DD') || ' (liberado ao tirar o "*")'
FROM (
  SELECT lower(substring(u FROM '^https://([^/?#:]*)')) AS h
  FROM (
    SELECT destination_url AS u FROM public.plates WHERE destination_url IS NOT NULL AND status = 'ativada'
    UNION
    SELECT b.review_url FROM public.plates p JOIN public.businesses b ON b.id = p.business_id
    WHERE p.destination_url IS NULL AND p.status = 'ativada' AND b.review_url IS NOT NULL
  ) s
) x
WHERE x.h IS NOT NULL AND x.h ~ '^[a-z0-9.-]+$' AND x.h ~ '\.' AND x.h !~ '^[0-9.]+$'
  AND NOT EXISTS (
    SELECT 1 FROM public.allowed_destination_hosts a
    WHERE a.host <> '*' AND (a.host = x.h OR (a.include_subdomains AND x.h LIKE '%.' || a.host))
  )
ON CONFLICT (host) DO NOTHING;

-- 3) Endereço exato liberado (aprovação "só este link") -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_destination_urls (
  url        TEXT PRIMARY KEY CHECK (url ~ '^https://' AND length(url) <= 2000),
  note       TEXT,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.allowed_destination_urls ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.allowed_destination_urls TO authenticated;
GRANT ALL ON public.allowed_destination_urls TO service_role;
DROP POLICY IF EXISTS "dest urls read" ON public.allowed_destination_urls;
CREATE POLICY "dest urls read" ON public.allowed_destination_urls FOR SELECT TO authenticated USING (true);

-- Mesma regra de antes + o endereço exato liberado.
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
  IF h !~ '^[a-z0-9.-]+$' THEN RETURN false; END IF;
  IF h !~ '\.' OR h ~ '^[0-9.]+$' OR h = 'localhost' OR h ~ '\.(local|internal|localhost|lan|home|corp)$' THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.allowed_destination_hosts a
    WHERE a.host = '*' OR a.host = h OR (a.include_subdomains AND h LIKE '%.' || a.host)
  ) OR EXISTS (SELECT 1 FROM public.allowed_destination_urls u WHERE u.url = _url);
END;
$$;
REVOKE ALL ON FUNCTION public.is_allowed_destination(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_destination(TEXT) TO authenticated, service_role;

-- 4) Pedidos de liberação e histórico de destinos ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.destination_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_id        UUID NOT NULL REFERENCES public.plates ON DELETE CASCADE,
  short_code      TEXT NOT NULL,
  url             TEXT NOT NULL CHECK (length(url) <= 2000),
  host            TEXT NOT NULL,
  requester_id    UUID REFERENCES auth.users ON DELETE SET NULL,
  requester_email TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado_dominio', 'aprovado_endereco', 'negado')),
  decided_by      UUID REFERENCES auth.users ON DELETE SET NULL,
  decided_at      TIMESTAMPTZ,
  decision_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS destination_requests_status_idx ON public.destination_requests (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS destination_requests_pending_uidx ON public.destination_requests (plate_id, url) WHERE status = 'pendente';
ALTER TABLE public.destination_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.destination_requests TO authenticated;      -- gravação só pelo servidor (chave de serviço)
GRANT ALL ON public.destination_requests TO service_role;
DROP POLICY IF EXISTS "dest requests read" ON public.destination_requests;
CREATE POLICY "dest requests read" ON public.destination_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR app_private.is_team(auth.uid()));

CREATE TABLE IF NOT EXISTS public.destination_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_id         UUID NOT NULL REFERENCES public.plates ON DELETE CASCADE,
  short_code       TEXT,
  old_url          TEXT,
  new_url          TEXT,
  changed_by       UUID REFERENCES auth.users ON DELETE SET NULL,
  changed_by_email TEXT,
  changed_by_role  TEXT NOT NULL CHECK (changed_by_role IN ('usuario', 'equipe', 'sistema')),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS destination_history_plate_idx ON public.destination_history (plate_id, changed_at DESC);
ALTER TABLE public.destination_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.destination_history TO authenticated;
GRANT ALL ON public.destination_history TO service_role;
DROP POLICY IF EXISTS "dest history read" ON public.destination_history;
CREATE POLICY "dest history read" ON public.destination_history FOR SELECT TO authenticated
  USING (plate_id IN (SELECT id FROM public.plates));            -- a RLS de plates já filtra por dono/equipe

CREATE OR REPLACE FUNCTION public.plates_log_destination()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  INSERT INTO public.destination_history (plate_id, short_code, old_url, new_url, changed_by, changed_by_email, changed_by_role)
  VALUES (
    NEW.id, NEW.short_code, OLD.destination_url, NEW.destination_url, uid,
    (SELECT email FROM auth.users WHERE id = uid),
    CASE WHEN uid IS NULL THEN 'sistema' WHEN app_private.is_team(uid) THEN 'equipe' ELSE 'usuario' END
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.plates_log_destination() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS plates_log_destination_trg ON public.plates;
CREATE TRIGGER plates_log_destination_trg AFTER UPDATE OF destination_url ON public.plates
  FOR EACH ROW WHEN (OLD.destination_url IS DISTINCT FROM NEW.destination_url)
  EXECUTE FUNCTION public.plates_log_destination();

-- 5) Por último: tira o "qualquer link" ------------------------------------------------------------------
DELETE FROM public.allowed_destination_hosts WHERE host = '*';

-- Conferência (rode depois): sites liberados automaticamente por já estarem em uso. Apague os que não reconhecer
-- (mas aí o código que usa esse site deixa de abrir; veja antes quais códigos são).
--   SELECT host, note FROM public.allowed_destination_hosts WHERE note LIKE 'já em uso%' ORDER BY host;
