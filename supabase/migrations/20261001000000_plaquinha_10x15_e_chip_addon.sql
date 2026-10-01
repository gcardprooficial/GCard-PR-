-- 1) Reativa a plaquinha 10x15 (tirada de linha em 20260916) com a nova arte/preço.
--    Lojista: fixo R$119 (delta sobre o plano lojista R$59,90 = R$59,10).
--    Revenda: tiers próprios 10un/25un/100un, ignora delta do plano.
UPDATE public.products
   SET status = 'ativo',
       name = 'Placa de acrílico para Avaliação do Google com NFC e QRCode Dinâmico (10x15)',
       tagline = 'Placa de acrílico 2mm · 10 x 15 cm',
       description = 'Placa de acrílico premium com QR Code dinâmico e NFC — o cliente aproxima o celular ou escaneia o QR e cai direto na tela de avaliação do seu Google.',
       price_delta_cents = 5910
 WHERE slug = 'plaquinha-10x15-l';

DELETE FROM public.product_price_tiers
 WHERE product_id = (SELECT id FROM public.products WHERE slug = 'plaquinha-10x15-l');

INSERT INTO public.product_price_tiers (product_id, min_quantity, unit_price_cents, label)
SELECT id, 10, 2490, NULL FROM public.products WHERE slug = 'plaquinha-10x15-l'
UNION ALL
SELECT id, 25, 2190, NULL FROM public.products WHERE slug = 'plaquinha-10x15-l'
UNION ALL
SELECT id, 100, 1890, NULL FROM public.products WHERE slug = 'plaquinha-10x15-l';

-- 2) Renomeia (só display, slug continua igual -- QR já impresso aponta pro slug antigo)
UPDATE public.products
   SET name = 'Placa de acrílico para Avaliação do Google com NFC e QRCode Dinâmico (10x10)',
       tagline = 'Placa de acrílico 2mm · 10 x 10 cm',
       description = 'Placa de acrílico premium com QR Code dinâmico e NFC — o cliente aproxima o celular ou escaneia o QR e cai direto na tela de avaliação do seu Google.'
 WHERE slug = 'plaquinha-10x10';

UPDATE public.products
   SET name = 'Cartão de bolso para Avaliação do Google com NFC (PVC)',
       tagline = 'Cartão de bolso 8,5 x 5,4 cm'
 WHERE slug = 'cartao-bolso';

UPDATE public.products
   SET name = 'Placa de acrílico 2mm 10x10 lisa, sem arte'
 WHERE slug = 'acrilico-10x10-sem-arte';

-- 3) Chip NFC avulso como add-on do acrílico liso: Sim/Não + quantidade, R$2/chip.
--    Reaproveita color_variants? Não -- é quantidade variável, não opção fixa.
--    Campo próprio: preço do chip e se o produto oferece o add-on.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS nfc_addon_price_cents INTEGER;

UPDATE public.products
   SET nfc_addon_price_cents = 200
 WHERE slug = 'acrilico-10x10-sem-arte';
