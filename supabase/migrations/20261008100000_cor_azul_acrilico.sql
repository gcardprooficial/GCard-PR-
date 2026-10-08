-- Cor azul nos acrílicos sem arte, com o mesmo adicional da preta de cada tamanho.
-- Idempotente: só acrescenta se a cor ainda não existe.
UPDATE public.products p
SET color_variants = p.color_variants || jsonb_build_array(
  jsonb_build_object(
    'slug', 'azul',
    'name', 'Azul',
    'delta_cents', (SELECT (v->>'delta_cents')::int FROM jsonb_array_elements(p.color_variants) v WHERE v->>'slug' = 'preto')
  )
)
WHERE p.slug IN ('acrilico-10x10-sem-arte', 'acrilico-15x10-l-sem-arte')
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.color_variants) v WHERE v->>'slug' = 'azul');
