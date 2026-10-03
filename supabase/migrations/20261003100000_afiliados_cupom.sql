-- Afiliados (divulgadores do Instagram): link próprio /c/{code}, cupom automático de
-- desconto pro cliente e comissão sobre o valor pago. Tudo calculado no servidor.

CREATE TABLE IF NOT EXISTS public.affiliates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  code           TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]{3,30}$'),
  email          TEXT,
  phone          TEXT,
  document       TEXT,
  instagram      TEXT,
  pix_key        TEXT,
  discount_pct   SMALLINT NOT NULL DEFAULT 5 CHECK (discount_pct BETWEEN 0 AND 50),
  commission_pct SMALLINT NOT NULL DEFAULT 5 CHECK (commission_pct BETWEEN 0 AND 50),
  is_active      BOOLEAN NOT NULL DEFAULT true,
  -- Link privado do painel do parceiro (/parceiro/{token}): só números agregados, sem PII de cliente.
  access_token   TEXT NOT NULL UNIQUE
                 DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  clicks         INTEGER NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_discount_cents INTEGER NOT NULL DEFAULT 0,
  -- Snapshot do % na hora do pedido: mudar o % do parceiro depois não mexe em venda antiga.
  ADD COLUMN IF NOT EXISTS affiliate_commission_pct SMALLINT;
CREATE INDEX IF NOT EXISTS orders_affiliate_idx ON public.orders(affiliate_id) WHERE affiliate_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE RESTRICT,
  -- 1 comissão por pedido: webhook, retorno e reconciliação podem chamar juntos.
  order_id         UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  base_cents       INTEGER NOT NULL,
  amount_cents     INTEGER NOT NULL CHECK (amount_cents >= 0),
  status           TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'cancelada')),
  paid_at          TIMESTAMPTZ,
  finance_entry_id UUID REFERENCES public.finance_entries(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_idx
  ON public.affiliate_commissions(affiliate_id, created_at DESC);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.affiliates TO service_role;
GRANT ALL ON public.affiliate_commissions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.affiliates TO authenticated;
GRANT SELECT ON public.affiliate_commissions TO authenticated;

DROP POLICY IF EXISTS "affiliates team select" ON public.affiliates;
CREATE POLICY "affiliates team select" ON public.affiliates FOR SELECT TO authenticated
  USING (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "affiliates team insert" ON public.affiliates;
CREATE POLICY "affiliates team insert" ON public.affiliates FOR INSERT TO authenticated
  WITH CHECK (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "affiliates team update" ON public.affiliates;
CREATE POLICY "affiliates team update" ON public.affiliates FOR UPDATE TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

-- Comissão só muda pelo servidor (marcar paga gera a saída no Financeiro junto).
DROP POLICY IF EXISTS "affiliate commissions team select" ON public.affiliate_commissions;
CREATE POLICY "affiliate commissions team select" ON public.affiliate_commissions FOR SELECT TO authenticated
  USING (app_private.is_team(auth.uid()));

-- Contador de cliques atômico (sem ler-e-gravar). Só o servidor chama.
CREATE OR REPLACE FUNCTION public.affiliate_track_click(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SET search_path = public
AS $$
  WITH u AS (
    UPDATE public.affiliates SET clicks = clicks + 1
     WHERE code = lower(p_code) AND is_active
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u);
$$;
REVOKE ALL ON FUNCTION public.affiliate_track_click(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.affiliate_track_click(TEXT) TO service_role;

-- Estorno/cancelamento por QUALQUER caminho (webhook ou select manual no painel)
-- cancela a comissão ainda não paga. Comissão já paga fica pra acerto manual.
CREATE OR REPLACE FUNCTION app_private.cancel_affiliate_commission_on_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.affiliate_commissions
     SET status = 'cancelada'
   WHERE order_id = NEW.id AND status = 'pendente';
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.cancel_affiliate_commission_on_refund() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS orders_cancel_affiliate_commission ON public.orders;
CREATE TRIGGER orders_cancel_affiliate_commission
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (OLD.payment_status = 'pago' AND NEW.payment_status IN ('estornado', 'cancelado'))
  EXECUTE FUNCTION app_private.cancel_affiliate_commission_on_refund();
