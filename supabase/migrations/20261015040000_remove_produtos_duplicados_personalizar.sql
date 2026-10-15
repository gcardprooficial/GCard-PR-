-- Desfaz a migração 20261015030000: os 2 produtos "para personalizar" duplicavam o acrílico liso.
-- O fluxo certo é o acrílico liso com a opção "Chip NFC" (já existente); o painel vincula os chips (cada um com
-- o seu código) ao pedido. Só apaga se nenhum pedido usou esses produtos; senão apenas os deixa ocultos.
-- Idempotente.

DELETE FROM public.product_price_tiers
 WHERE product_id IN (
   SELECT p.id FROM public.products p
    WHERE p.slug IN ('acrilico-10x10-nfc-personalizar', 'acrilico-10x15-nfc-personalizar')
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id));

DELETE FROM public.products p
 WHERE p.slug IN ('acrilico-10x10-nfc-personalizar', 'acrilico-10x15-nfc-personalizar')
   AND NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id);

UPDATE public.products SET status = 'oculto'
 WHERE slug IN ('acrilico-10x10-nfc-personalizar', 'acrilico-10x15-nfc-personalizar');

ALTER TABLE public.products DROP COLUMN IF EXISTS is_customizable;
