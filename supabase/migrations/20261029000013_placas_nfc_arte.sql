-- Placas de acrílico 10x10 com arte pronta e chip NFC (Instagram, Pix, WhatsApp). Só para revenda, mínimo 10. ADITIVA e idempotente.
--  Sem QR: o cliente final aproxima o celular. O chip chega vazio e o revendedor grava o link com o app NFC Tools.
--  Usam o mesmo mecanismo do produto "tag-nfc-adesiva": is_supply = só revenda, sem lote e sem código.
--  ship_profile: tamanho de embalagem usado na cotação de frete ('acrilico' = placa 10x10; 'pvc' = cartão/tag pequenos).
-- Nascem OCULTOS ('oculto'). Publique depois do deploy (UPDATE no fim deste arquivo).
-- REVERTER: DELETE FROM public.products WHERE slug IN ('placa-instagram-10x10','placa-pix-10x10','placa-whatsapp-10x10');
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ship_profile TEXT CHECK (ship_profile IS NULL OR ship_profile IN ('acrilico', 'pvc'));

INSERT INTO public.products
  (slug, name, format, tagline, description, status, has_qr, has_nfc, is_blank, is_supply, min_quantity, quantity_step,
   ship_profile, price_delta_cents, resale_delta_cents, sort_order)
VALUES
  ('placa-instagram-10x10', 'Placa Instagram 10x10 com NFC', 'Placa de acrílico 2mm · 10 x 10 cm, arte pronta, chip NFC',
   'Aproxime o celular e abra o Instagram',
   'Placa de acrílico 2mm 10x10 cm com a arte do Instagram e chip NFC. Só para revendedores, a partir de 10 unidades. O chip chega vazio: você grava o perfil do seu cliente com o app NFC Tools.',
   'oculto', false, true, false, true, 10, 1, 'acrilico', 0, 0, 7),
  ('placa-pix-10x10', 'Placa Pix 10x10 com NFC', 'Placa de acrílico 2mm · 10 x 10 cm, arte pronta, chip NFC',
   'Aproxime o celular e pague com Pix',
   'Placa de acrílico 2mm 10x10 cm com a arte do Pix e chip NFC. Só para revendedores, a partir de 10 unidades. O chip chega vazio: você grava o link ou a chave de pagamento do seu cliente com o app NFC Tools.',
   'oculto', false, true, false, true, 10, 1, 'acrilico', 0, 0, 8),
  ('placa-whatsapp-10x10', 'Placa WhatsApp 10x10 com NFC', 'Placa de acrílico 2mm · 10 x 10 cm, arte pronta, chip NFC',
   'Aproxime o celular e chame no WhatsApp',
   'Placa de acrílico 2mm 10x10 cm com a arte do WhatsApp e chip NFC. Só para revendedores, a partir de 10 unidades. O chip chega vazio: você grava o link do WhatsApp do seu cliente com o app NFC Tools.',
   'oculto', false, true, false, true, 10, 1, 'acrilico', 0, 0, 9)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, format = EXCLUDED.format, tagline = EXCLUDED.tagline, description = EXCLUDED.description,
  has_qr = EXCLUDED.has_qr, has_nfc = EXCLUDED.has_nfc, is_blank = EXCLUDED.is_blank, is_supply = EXCLUDED.is_supply,
  min_quantity = EXCLUDED.min_quantity, quantity_step = EXCLUDED.quantity_step, ship_profile = EXCLUDED.ship_profile,
  sort_order = EXCLUDED.sort_order;
-- (o status NÃO é sobrescrito: quem já publicou continua publicado)

-- Preço de revenda por faixa (frete grátis já diluído, como nos outros produtos).
DELETE FROM public.product_price_tiers
 WHERE product_id IN (SELECT id FROM public.products WHERE slug IN ('placa-instagram-10x10','placa-pix-10x10','placa-whatsapp-10x10'));
INSERT INTO public.product_price_tiers (product_id, min_quantity, unit_price_cents, label)
SELECT p.id, t.min_q, t.price, t.lbl
FROM public.products p,
     (VALUES
       (10, 1890, '10 a 19 unidades'),
       (20, 1690, '20 a 49 unidades'),
       (50, 1590, '50 a 99 unidades'),
       (100, 1490, '100 unidades ou mais')
     ) AS t(min_q, price, lbl)
WHERE p.slug IN ('placa-instagram-10x10','placa-pix-10x10','placa-whatsapp-10x10');

-- PUBLICAR (rode só depois do deploy):
--   UPDATE public.products SET status = 'ativo' WHERE slug IN ('placa-instagram-10x10','placa-pix-10x10','placa-whatsapp-10x10');
