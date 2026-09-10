-- ============================================================================
-- Revenda (lotes) + painel do revendedor + configurações do painel admin
-- ============================================================================

-- PRODUTOS: quais mídias cada modelo tem (cartão de bolso = só NFC)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_qr  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS has_nfc BOOLEAN NOT NULL DEFAULT true;

UPDATE public.products SET has_qr = false, has_nfc = true WHERE slug = 'cartao-bolso';
UPDATE public.products SET has_qr = true,  has_nfc = true WHERE slug IN ('plaquinha-10x10', 'plaquinha-10x15-l');

-- BATCHES: dono (revendedor), produto, custo, controle de envio de códigos
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS label           TEXT,
  ADD COLUMN IF NOT EXISTS product_id      UUID REFERENCES public.products ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_email     TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id   UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codes_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_to         TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS batches_owner_idx ON public.batches (owner_user_id);

-- PLATES: dados que o revendedor preenche ao ativar
ALTER TABLE public.plates
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS sold_to       TEXT,
  ADD COLUMN IF NOT EXISTS activated_by  UUID REFERENCES auth.users ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS plates_batch_idx ON public.plates (batch_id);

-- ----------------------------------------------------------------------------
-- RLS: revendedor enxerga só o próprio lote (leitura). Escritas via server fn.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "batches team all" ON public.batches;
CREATE POLICY "batches team all" ON public.batches FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "batches owner read" ON public.batches;
CREATE POLICY "batches owner read" ON public.batches FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "plates owner read" ON public.plates;
CREATE POLICY "plates owner read" ON public.plates FOR SELECT TO authenticated
  USING (batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "plates owner update" ON public.plates;
CREATE POLICY "plates owner update" ON public.plates FOR UPDATE TO authenticated
  USING (batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = auth.uid()))
  WITH CHECK (batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = auth.uid()));

-- Revendedor só mexe em status/destino/nome/sold_to. Bloqueia adulteração de
-- vínculos e valida o host Google no próprio banco (além de /r/{token}).
CREATE OR REPLACE FUNCTION public.guard_reseller_plate_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (server: /r/{token}, emissão) e time passam direto
  IF auth.role() = 'service_role' OR auth.role() = 'supabase_admin' THEN RETURN NEW; END IF;
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
  IF NEW.destination_url IS NOT NULL
     AND NEW.destination_url !~ '^https://(search\.google\.com|www\.google\.com|google\.com|maps\.google\.com|g\.page)/' THEN
    RAISE EXCEPTION 'Link precisa ser do Google';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plates_reseller_guard ON public.plates;
CREATE TRIGGER plates_reseller_guard BEFORE UPDATE ON public.plates
  FOR EACH ROW EXECUTE FUNCTION public.guard_reseller_plate_update();

-- Admin cria um lote e gera os códigos numa chamada só.
CREATE OR REPLACE FUNCTION public.create_batch(
  _label TEXT, _product_id UUID, _quantity INTEGER, _owner_email TEXT, _unit_cost_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE bid UUID; i INTEGER;
BEGIN
  IF NOT app_private.is_team(auth.uid()) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _quantity < 1 OR _quantity > 5000 THEN RAISE EXCEPTION 'Quantidade inválida (1-5000)'; END IF;
  INSERT INTO public.batches (code, label, product_id, quantity, owner_email, unit_cost_cents, status)
  VALUES (
    'L-' || to_char(now(), 'YYMMDD') || '-' || substr(md5(random()::text), 1, 5),
    _label, _product_id, _quantity, nullif(trim(_owner_email), ''), coalesce(_unit_cost_cents, 0), 'produzido'
  )
  RETURNING id INTO bid;
  FOR i IN 1.._quantity LOOP
    INSERT INTO public.plates (token, batch_id, product_id, status)
    VALUES (replace(gen_random_uuid()::text, '-', ''), bid, _product_id, 'nao_ativada');
  END LOOP;
  RETURN bid;
END;
$$;
REVOKE ALL ON FUNCTION public.create_batch(TEXT, UUID, INTEGER, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_batch(TEXT, UUID, INTEGER, TEXT, INTEGER) TO authenticated;

-- Revendedor vincula os lotes cadastrados com o e-mail dele à conta dele.
CREATE OR REPLACE FUNCTION public.claim_my_batches()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
  my_email TEXT;
BEGIN
  SELECT email INTO my_email FROM auth.users WHERE id = auth.uid();
  IF my_email IS NULL THEN RETURN 0; END IF;
  UPDATE public.batches
     SET owner_user_id = auth.uid(), updated_at = now()
   WHERE owner_user_id IS NULL
     AND lower(owner_email) = lower(my_email);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_my_batches() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_my_batches() TO authenticated;

-- ----------------------------------------------------------------------------
-- Configurações compartilhadas do painel (ex.: premissas da calculadora)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings team all" ON public.app_settings;
CREATE POLICY "settings team all" ON public.app_settings FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES
  ('pricing', '{"unit_cost_cents":0,"packaging_cents":0,"shipping_cents":0,"gateway_pct":4.99,"fixed_monthly_cents":0,"min_margin_pct":30}'::jsonb)
ON CONFLICT (key) DO NOTHING;

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS batches_updated_at ON public.batches;
CREATE TRIGGER batches_updated_at BEFORE UPDATE ON public.batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
