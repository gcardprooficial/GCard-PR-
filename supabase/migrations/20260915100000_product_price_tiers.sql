-- Preço de revenda próprio por produto (substitui o modelo "delta fixo em
-- cima do plano" quando existe linha aqui). O cartão continua usando as
-- faixas do plano renda-extra normalmente.
CREATE TABLE IF NOT EXISTS public.product_price_tiers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES public.products ON DELETE CASCADE,
  min_quantity     INTEGER NOT NULL CHECK (min_quantity >= 1),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents > 0),
  label            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, min_quantity)
);
GRANT SELECT ON public.product_price_tiers TO anon, authenticated;
GRANT ALL ON public.product_price_tiers TO service_role;
ALTER TABLE public.product_price_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_price_tiers_public_read" ON public.product_price_tiers;
CREATE POLICY "product_price_tiers_public_read" ON public.product_price_tiers
  FOR SELECT TO anon, authenticated USING (true);

-- Plaquinha 10x10 revenda: custo real ~R$8,80-12/un (com frete de envio e
-- taxa do gateway no pior caso). Preço abaixo bate o concorrente (R$22/un
-- em 20 unidades = R$440) com margem de 32%+ mesmo no cenário ruim.
DELETE FROM public.product_price_tiers
 WHERE product_id = (SELECT id FROM public.products WHERE slug = 'plaquinha-10x10');

INSERT INTO public.product_price_tiers (product_id, min_quantity, unit_price_cents, label)
SELECT id, t.min_q, t.price, t.lbl
  FROM public.products,
       (VALUES
         (10, 2190, '10 a 24 unidades'),
         (25, 1890, '25 a 99 unidades'),
         (100, 1590, '100 unidades ou mais')
       ) AS t(min_q, price, lbl)
 WHERE slug = 'plaquinha-10x10';
