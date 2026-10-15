-- Produtos "para personalizar": acrílico + NFC, sem arte impressa, com um código por unidade.
-- Entram OCULTOS e sem preço (TODO_PRECOS): só aparecem no site quando você definir os preços e
-- virar status = 'ativo' (veja o SQL de exemplo no fim). Não mexe nos produtos atuais.
-- Reversível: DELETE FROM public.products WHERE slug IN (...); ALTER TABLE ... DROP COLUMN is_customizable.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_customizable BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.products
  (slug, name, format, tagline, description, status, has_qr, has_nfc, is_blank, is_customizable,
   min_quantity, color_variants, price_delta_cents, sort_order)
VALUES
  (
    'acrilico-10x10-nfc-personalizar',
    'Acrílico 10x10 + NFC (para personalizar)',
    'Placa de acrílico 2mm · 10 x 10 cm',
    'Sem arte impressa, com NFC e código próprio',
    'Placa de acrílico 2mm 10x10 sem arte impressa, com o chip NFC já gravado com o código dela. Você baixa o QR desse código no painel e coloca na sua arte.',
    'oculto', false, true, true, true,
    1,
    '[{"slug":"cristal","name":"Cristal (transparente)","delta_cents":0},
      {"slug":"branco","name":"Branco","delta_cents":0},
      {"slug":"preto","name":"Preto","delta_cents":0},
      {"slug":"azul","name":"Azul","delta_cents":0}]'::jsonb,
    0, 5
  ),
  (
    'acrilico-10x15-nfc-personalizar',
    'Acrílico 10x15 + NFC (para personalizar)',
    'Placa de acrílico 2mm · 10 x 15 cm',
    'Sem arte impressa, com NFC e código próprio',
    'Placa de acrílico 2mm 10x15 sem arte impressa, com o chip NFC já gravado com o código dela. Você baixa o QR desse código no painel e coloca na sua arte.',
    'oculto', false, true, true, true,
    1,
    '[{"slug":"cristal","name":"Cristal (transparente)","delta_cents":0},
      {"slug":"branco","name":"Branco","delta_cents":0},
      {"slug":"preto","name":"Preto","delta_cents":0},
      {"slug":"azul","name":"Azul","delta_cents":0}]'::jsonb,
    0, 6
  )
ON CONFLICT (slug) DO NOTHING;

-- Para publicar (quando os preços estiverem definidos), por exemplo:
--   UPDATE public.products SET price_delta_cents = <centavos>, status = 'ativo'
--    WHERE slug IN ('acrilico-10x10-nfc-personalizar','acrilico-10x15-nfc-personalizar');
-- Faixas de lote: tabela product_price_tiers (mesma estrutura dos outros produtos).
