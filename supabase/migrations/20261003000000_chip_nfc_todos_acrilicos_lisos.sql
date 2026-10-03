-- Chip NFC avulso (R$2/un) passa a valer pra TODO acrílico liso sem arte
-- (10x10, 10x15 e qualquer outro is_blank), não só o 10x10.
-- Cores (cristal/branco/preto) são variantes do mesmo produto, então já ficam cobertas.
UPDATE public.products
   SET nfc_addon_price_cents = 200
 WHERE is_blank = true
   AND nfc_addon_price_cents IS NULL;
