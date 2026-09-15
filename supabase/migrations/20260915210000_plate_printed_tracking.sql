-- Controle de "impresso" pro estoque solto. Depois de gerar um lote grande
-- de plaquinhas (ex: 81 un.), o operador baixa o zip de QR pra montar a
-- arte e manda pra gráfica -- mas até agora não tinha como marcar quais
-- códigos já foram usados numa arte/impressão, então cada nova geração de
-- estoque virava uma lista indistinguível da anterior.
--
-- printed_at fica NULL até ser marcado manualmente no painel (não é setado
-- automaticamente ao baixar o zip -- baixar não significa que já foi pra
-- gráfica, o operador confirma quando de fato imprimir).
ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS printed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS plates_printed_at_idx ON public.plates (printed_at)
  WHERE batch_id IS NULL;
