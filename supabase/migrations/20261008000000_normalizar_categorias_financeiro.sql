-- "frete", "Frete" e "FRETE" eram 3 categorias. Padroniza: sem espaços sobrando,
-- 1ª letra maiúscula e o resto minúsculo (ex.: "Frete", "Comissões").
UPDATE public.finance_entries
   SET category = upper(left(btrim(regexp_replace(category, '\s+', ' ', 'g')), 1))
                  || lower(substr(btrim(regexp_replace(category, '\s+', ' ', 'g')), 2))
 WHERE category IS DISTINCT FROM
       upper(left(btrim(regexp_replace(category, '\s+', ' ', 'g')), 1))
       || lower(substr(btrim(regexp_replace(category, '\s+', ' ', 'g')), 2));
