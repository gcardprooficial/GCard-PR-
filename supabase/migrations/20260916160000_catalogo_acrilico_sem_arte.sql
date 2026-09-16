-- Catalogo final: 2 produtos COM arte (ja existem) + 2 acrilicos SEM arte (novos).
-- A plaquinha em L COM arte sai de linha por enquanto (da trabalho demais de produzir).
--
-- Acrilico sem arte nao tem QR nem NFC -- e acrilico puro, nao gera placa nenhuma
-- no sistema (ver has_qr/has_nfc = false e is_blank = true).

-- 1) Tira de linha a plaquinha em L COM arte
UPDATE public.products
   SET status = 'oculto'
 WHERE slug = 'plaquinha-10x15-l';

-- 2) Flag pra produto "vazio" (sem QR/NFC): nao emite placa, nao entra em lote
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_blank BOOLEAN NOT NULL DEFAULT false;

-- 3) Cores disponiveis por produto, com acrescimo proprio de cada uma.
--    Formato: [{ "slug", "name", "delta_cents" }]
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_variants JSONB;

-- 4) Quantidade minima de venda (kit fechado). Acrilico so sai a partir de 10 un.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity INTEGER NOT NULL DEFAULT 1;

-- 5) Os dois acrilicos sem arte
INSERT INTO public.products
  (slug, name, format, tagline, description, status, has_qr, has_nfc, is_blank,
   min_quantity, color_variants, price_delta_cents, sort_order)
VALUES
  (
    'acrilico-10x10-sem-arte',
    'Acrílico 10x10 sem arte',
    'Placa de acrílico 2mm · 10 x 10 cm',
    'Acrílico puro, sem impressão',
    'Placa de acrílico 2mm cortada em 10x10 cm, sem nenhuma impressão. Para quem já tem a própria arte ou quer aplicar adesivo. Frete grátis incluso, kit mínimo de 10 unidades.',
    'ativo', false, false, true,
    10,
    '[{"slug":"cristal","name":"Cristal (transparente)","delta_cents":0},
      {"slug":"branco","name":"Branco","delta_cents":50},
      {"slug":"preto","name":"Preto","delta_cents":200}]'::jsonb,
    0, 3
  ),
  (
    'acrilico-15x10-l-sem-arte',
    'Acrílico 15x10 em L sem arte',
    'Placa de acrílico 2mm · 15 x 10 cm em "L"',
    'Acrílico puro, formato de mesa',
    'Placa de acrílico 2mm dobrada em "L" (15x10 cm), fica em pé no balcão sem suporte. Sem nenhuma impressão — para quem já tem a própria arte. Frete grátis incluso, kit mínimo de 10 unidades.',
    'ativo', false, false, true,
    10,
    '[{"slug":"cristal","name":"Cristal (transparente)","delta_cents":0},
      {"slug":"branco","name":"Branco","delta_cents":200},
      {"slug":"preto","name":"Preto","delta_cents":400}]'::jsonb,
    0, 4
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  format = EXCLUDED.format,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  has_qr = EXCLUDED.has_qr,
  has_nfc = EXCLUDED.has_nfc,
  is_blank = EXCLUDED.is_blank,
  min_quantity = EXCLUDED.min_quantity,
  color_variants = EXCLUDED.color_variants,
  sort_order = EXCLUDED.sort_order;

-- 6) Preco por faixa (cor cristal = base; branco/preto somam o delta acima).
--    O frete de R$25 ja esta diluido: 10un = R$2,50/un, 20un = R$1,25/un, 50un = R$0,50/un.
DELETE FROM public.product_price_tiers
 WHERE product_id IN (
   SELECT id FROM public.products
    WHERE slug IN ('acrilico-10x10-sem-arte', 'acrilico-15x10-l-sem-arte')
 );

INSERT INTO public.product_price_tiers (product_id, min_quantity, unit_price_cents, label)
SELECT p.id, t.min_q, t.price, t.lbl
FROM public.products p,
     (VALUES
       (10, 1050, '10 a 19 unidades'),
       (20,  920, '20 a 49 unidades'),
       (50,  850, '50 unidades ou mais')
     ) AS t(min_q, price, lbl)
WHERE p.slug = 'acrilico-10x10-sem-arte';

INSERT INTO public.product_price_tiers (product_id, min_quantity, unit_price_cents, label)
SELECT p.id, t.min_q, t.price, t.lbl
FROM public.products p,
     (VALUES
       (10, 1250, '10 a 19 unidades'),
       (20, 1120, '20 a 49 unidades'),
       (50, 1050, '50 unidades ou mais')
     ) AS t(min_q, price, lbl)
WHERE p.slug = 'acrilico-15x10-l-sem-arte';
