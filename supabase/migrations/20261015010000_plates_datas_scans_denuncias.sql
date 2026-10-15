-- Fase 1: datas de estado, leituras sem robôs/NFC×QR, contagem atômica e denúncias.
-- Estados da placa NÃO mudam (nao_ativada / ativada / bloqueada). Só entram colunas de data.
-- Tudo com IF NOT EXISTS. Reversível: DROP das colunas/triggers/funções criadas aqui.

-- 1) Datas de estado e marca de rastreio -----------------------------------------------------
ALTER TABLE public.plates
  ADD COLUMN IF NOT EXISTS sold_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blocked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS block_reason    TEXT,
  ADD COLUMN IF NOT EXISTS bot_scan_count  INTEGER NOT NULL DEFAULT 0,
  -- true = placa/chip novo, que leva ?s=q (QR) / ?s=n (NFC). As existentes ficam false e seguem sem parâmetro.
  ADD COLUMN IF NOT EXISTS tracking_v2     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.plates ALTER COLUMN tracking_v2 SET DEFAULT true;  -- só vale para linhas novas

-- Preenche com o que já se sabe (sem inventar): venda pelo pedido; bloqueio pela última alteração.
UPDATE public.plates p SET sold_at = COALESCE(o.paid_at, p.created_at)
  FROM public.orders o WHERE p.order_id = o.id AND p.sold_at IS NULL;
UPDATE public.plates p SET sold_at = COALESCE(o.paid_at, p.created_at)
  FROM public.batches b JOIN public.orders o ON o.id = b.owner_order_id
  WHERE p.batch_id = b.id AND p.sold_at IS NULL;
UPDATE public.plates SET blocked_at = updated_at WHERE status = 'bloqueada' AND blocked_at IS NULL;

CREATE OR REPLACE FUNCTION public.plates_track_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.order_id IS NOT NULL AND NEW.sold_at IS NULL THEN NEW.sold_at := now(); END IF;
    IF NEW.status = 'bloqueada' AND NEW.blocked_at IS NULL THEN NEW.blocked_at := now(); END IF;
    IF NEW.status = 'ativada' AND NEW.activated_at IS NULL THEN NEW.activated_at := now(); END IF;
    RETURN NEW;
  END IF;
  IF NEW.order_id IS NOT NULL AND OLD.order_id IS NULL AND NEW.sold_at IS NULL THEN NEW.sold_at := now(); END IF;
  -- Placa que entra num lote com dono (pedido, e-mail ou usuário) passou a ser vendida.
  IF NEW.sold_at IS NULL AND NEW.batch_id IS NOT NULL AND OLD.batch_id IS DISTINCT FROM NEW.batch_id
     AND EXISTS (SELECT 1 FROM public.batches b WHERE b.id = NEW.batch_id
                 AND (b.owner_order_id IS NOT NULL OR b.owner_email IS NOT NULL OR b.owner_user_id IS NOT NULL)) THEN
    NEW.sold_at := now();
  END IF;
  IF NEW.status = 'bloqueada' AND OLD.status IS DISTINCT FROM 'bloqueada' THEN NEW.blocked_at := now(); END IF;
  IF NEW.status <> 'bloqueada' AND OLD.status = 'bloqueada' THEN NEW.blocked_at := NULL; NEW.block_reason := NULL; END IF;
  IF NEW.status = 'ativada' AND OLD.status IS DISTINCT FROM 'ativada' AND NEW.activated_at IS NULL THEN
    NEW.activated_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plates_track_dates_trg ON public.plates;
CREATE TRIGGER plates_track_dates_trg BEFORE INSERT OR UPDATE ON public.plates
  FOR EACH ROW EXECUTE FUNCTION public.plates_track_dates();

-- Não ativa código que não foi vendido (sem pedido e sem lote). service_role e SQL Editor passam.
CREATE OR REPLACE FUNCTION public.plates_require_sold_to_activate()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'ativada' AND OLD.status IS DISTINCT FROM 'ativada'
     AND NEW.order_id IS NULL AND NEW.batch_id IS NULL THEN
    RAISE EXCEPTION 'Esse código ainda não foi vendido; não dá para ativar.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plates_require_sold_to_activate_trg ON public.plates;
CREATE TRIGGER plates_require_sold_to_activate_trg BEFORE UPDATE ON public.plates
  FOR EACH ROW EXECUTE FUNCTION public.plates_require_sold_to_activate();

-- Gatilho do revendedor: igual ao anterior + novas colunas protegidas.
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
     OR NEW.scan_count <> OLD.scan_count
     OR NEW.bot_scan_count <> OLD.bot_scan_count
     OR NEW.tracking_v2 <> OLD.tracking_v2
     OR NEW.sold_at IS DISTINCT FROM OLD.sold_at
     OR NEW.blocked_at IS DISTINCT FROM OLD.blocked_at
     OR NEW.block_reason IS DISTINCT FROM OLD.block_reason THEN
    RAISE EXCEPTION 'Alteração não permitida';
  END IF;
  IF NEW.status NOT IN ('ativada', 'nao_ativada') OR OLD.status = 'bloqueada' THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF NEW.destination_url IS NOT NULL AND NOT public.is_allowed_destination(NEW.destination_url) THEN
    RAISE EXCEPTION 'Link precisa ser do Google ou do TOQY (https)';
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Leituras: origem NFC×QR, robôs, visitante do dia ----------------------------------------
ALTER TABLE public.plate_scan_events
  ADD COLUMN IF NOT EXISTS source       TEXT CHECK (source IN ('q', 'n')),     -- NULL = desconhecido (placas antigas)
  ADD COLUMN IF NOT EXISTS is_bot       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_reason   TEXT,
  ADD COLUMN IF NOT EXISTS visitor_hash TEXT,                                   -- hash diário: sem IP nem UA guardados
  ADD COLUMN IF NOT EXISTS day          DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date);
CREATE INDEX IF NOT EXISTS plate_scan_events_unique_idx ON public.plate_scan_events (plate_id, day, visitor_hash);
CREATE INDEX IF NOT EXISTS plate_scan_events_day_idx ON public.plate_scan_events (day);

-- Registro atômico: sem ler-somar-gravar. Leitura de robô/pré-visualização entra separada.
CREATE OR REPLACE FUNCTION public.plate_register_scan(
  _plate_id UUID, _token TEXT, _device TEXT, _country TEXT, _referrer_host TEXT,
  _source TEXT, _is_bot BOOLEAN, _bot_reason TEXT, _visitor_hash TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  INSERT INTO public.plate_scan_events
    (plate_id, token, device, country, referrer_host, source, is_bot, bot_reason, visitor_hash)
  VALUES
    (_plate_id, _token, _device, _country, _referrer_host,
     CASE WHEN _source IN ('q', 'n') THEN _source ELSE NULL END, COALESCE(_is_bot, false), _bot_reason, _visitor_hash);
  IF COALESCE(_is_bot, false) THEN
    UPDATE public.plates SET bot_scan_count = bot_scan_count + 1 WHERE id = _plate_id;
  ELSE
    UPDATE public.plates SET scan_count = scan_count + 1, last_scan_at = now() WHERE id = _plate_id;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.plate_register_scan(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plate_register_scan(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;

-- Leituras únicas por dia e por origem (só gente: sem robôs). RLS das tabelas de base vale (invoker).
CREATE OR REPLACE VIEW public.plate_scan_daily WITH (security_invoker = true) AS
SELECT plate_id, day,
       count(*) FILTER (WHERE NOT is_bot)                                   AS leituras,
       count(DISTINCT visitor_hash) FILTER (WHERE NOT is_bot)               AS leituras_unicas,
       count(*) FILTER (WHERE NOT is_bot AND source = 'n')                  AS nfc,
       count(*) FILTER (WHERE NOT is_bot AND source = 'q')                  AS qr,
       count(*) FILTER (WHERE NOT is_bot AND source IS NULL)                AS desconhecido,
       count(*) FILTER (WHERE is_bot)                                       AS robos
FROM public.plate_scan_events
GROUP BY plate_id, day;
GRANT SELECT ON public.plate_scan_daily TO authenticated;

-- 3) Denúncias de abuso ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.abuse_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_id    UUID REFERENCES public.plates ON DELETE SET NULL,
  short_code  TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('golpe', 'conteudo_ilegal', 'outro')),
  details     TEXT CHECK (details IS NULL OR length(details) <= 500),
  contact     TEXT CHECK (contact IS NULL OR length(contact) <= 120),
  status      TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'resolvida', 'descartada')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS abuse_reports_status_idx ON public.abuse_reports (status, created_at DESC);
ALTER TABLE public.abuse_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.abuse_reports TO authenticated;     -- só a equipe, pela policy
GRANT ALL ON public.abuse_reports TO service_role;                 -- a denúncia entra pelo servidor
DROP POLICY IF EXISTS "abuse team read" ON public.abuse_reports;
CREATE POLICY "abuse team read" ON public.abuse_reports FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "abuse team update" ON public.abuse_reports;
CREATE POLICY "abuse team update" ON public.abuse_reports FOR UPDATE TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));
