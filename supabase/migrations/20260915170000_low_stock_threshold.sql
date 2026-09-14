-- Limite de estoque baixo por produto, pra alertar no dashboard quando o
-- estoque solto (plaquinhas sem lote) cair abaixo do esperado.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 20;
