-- Estoque de cartões de PVC (só NFC, sem QR e sem código): não usam plates/lote.
-- Produzidos entram aqui à mão (quantity > 0); baixa/perda/correção é quantity < 0.
-- "Vendidos" não é gravado: o painel soma os pedidos pagos, então nunca fica defasado.
CREATE TABLE IF NOT EXISTS public.card_stock_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity   INTEGER NOT NULL CHECK (quantity <> 0),
  note       TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.card_stock_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.card_stock_entries TO authenticated;
GRANT ALL ON public.card_stock_entries TO service_role;

DROP POLICY IF EXISTS "card stock team all" ON public.card_stock_entries;
CREATE POLICY "card stock team all" ON public.card_stock_entries FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));
