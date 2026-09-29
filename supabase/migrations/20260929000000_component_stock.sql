-- Estoque de insumo avulso (sem produto do catálogo): chip NFC solto, arte impressa
-- avulsa, cartão PVC ainda sem arte aplicada -- coisas que ainda não viraram um
-- produto pronto pra vender. Mesmo padrão do card_stock_entries, mas por nome livre
-- em vez de product_id (não faz sentido cadastrar "chip NFC" como produto do catálogo).
CREATE TABLE IF NOT EXISTS public.component_stock_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity <> 0),
  note       TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.component_stock_entries ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.component_stock_entries TO authenticated;
GRANT ALL ON public.component_stock_entries TO service_role;

DROP POLICY IF EXISTS "component stock team all" ON public.component_stock_entries;
CREATE POLICY "component stock team all" ON public.component_stock_entries FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));
