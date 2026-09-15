-- Agrupamento nomeado do estoque solto (ex.: "Estoque 1", "Estoque 2"),
-- pra organizar remessas de impressao -- o operador gera N plaquinhas,
-- baixa o zip de QR, monta a arte, e precisa saber depois qual grupo de
-- codigos corresponde a qual arte ja mandada pra grafica. O flag binario
-- impresso/nao-impresso (printed_at, migration anterior) nao guardava
-- QUAL remessa -- so se tinha sido tratado ou nao.
ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS print_group TEXT;

CREATE INDEX IF NOT EXISTS plates_print_group_idx ON public.plates (print_group)
  WHERE batch_id IS NULL;
