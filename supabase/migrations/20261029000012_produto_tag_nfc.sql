-- Produto novo: Tag NFC adesiva (13,56 MHz, regravável), só para revenda, kits de 50 em 50, R$ 2,20 a unidade. ADITIVA e idempotente.
--  is_supply:     produto de revenda sem placa/QR/lote (insumo). Só aparece e só vende no caminho de revenda.
--  quantity_step: a quantidade tem que ser múltipla disso (50, 100, 150, 200…).
-- O produto nasce OCULTO ('oculto'): publique quando o estoque e as fotos estiverem prontos (UPDATE no fim deste arquivo).
-- REVERTER: DELETE FROM public.products WHERE slug = 'tag-nfc-adesiva';  (e as colunas, se não tiver outro uso)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_supply BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantity_step INTEGER NOT NULL DEFAULT 1 CHECK (quantity_step >= 1);

INSERT INTO public.products
  (slug, name, format, tagline, description, status, has_qr, has_nfc, is_blank, is_supply, min_quantity, quantity_step,
   price_delta_cents, resale_delta_cents, sort_order)
VALUES
  (
    'tag-nfc-adesiva',
    'Tag NFC adesiva (kit para revenda)',
    'Etiqueta NFC adesiva 13,56 MHz, regravável',
    'Etiqueta NFC para você gravar e colar',
    'Etiqueta adesiva com chip NFC 13,56 MHz regravável, para quem monta o próprio produto. Vendida em kits a partir de 50 unidades (50, 100, 150, 200…), só para revendedores. Chega vazia: você grava o link com o app NFC Tools.',
    'oculto', false, true, false, true,
    50, 50,
    0, 0, 6
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, format = EXCLUDED.format, tagline = EXCLUDED.tagline, description = EXCLUDED.description,
  has_qr = EXCLUDED.has_qr, has_nfc = EXCLUDED.has_nfc, is_blank = EXCLUDED.is_blank, is_supply = EXCLUDED.is_supply,
  min_quantity = EXCLUDED.min_quantity, quantity_step = EXCLUDED.quantity_step, sort_order = EXCLUDED.sort_order;
-- (o status NÃO é sobrescrito no ON CONFLICT: quem já publicou continua publicado)

DELETE FROM public.product_price_tiers
 WHERE product_id IN (SELECT id FROM public.products WHERE slug = 'tag-nfc-adesiva');
INSERT INTO public.product_price_tiers (product_id, min_quantity, unit_price_cents, label)
SELECT p.id, 50, 220, '50 unidades ou mais'
FROM public.products p WHERE p.slug = 'tag-nfc-adesiva';

-- PUBLICAR (rode só quando for abrir a venda):
--   UPDATE public.products SET status = 'ativo' WHERE slug = 'tag-nfc-adesiva';
