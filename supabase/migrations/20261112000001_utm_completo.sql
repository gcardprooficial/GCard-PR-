-- UTM completo (2026-11-12): o first-touch passa a guardar também utm_term, utm_id, src, sck (Utmify) e os identificadores
-- de clique (fbclid, gclid, ttclid). Só substitui a função de limpeza (aditivo): linhas antigas continuam válidas.
-- Rodar no SQL Editor do Supabase do GCard. Para desfazer: recriar a função com o arquivo 20261015020000.
CREATE OR REPLACE FUNCTION public.clean_first_touch(_j JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN _j IS NULL OR jsonb_typeof(_j) <> 'object' THEN NULL ELSE
    NULLIF(jsonb_strip_nulls(jsonb_build_object(
      'utm_source',   lower(left(_j ->> 'utm_source', 60)),
      'utm_medium',   lower(left(_j ->> 'utm_medium', 60)),
      'utm_campaign', lower(left(_j ->> 'utm_campaign', 80)),
      'utm_content',  lower(left(_j ->> 'utm_content', 80)),
      'utm_term',     lower(left(_j ->> 'utm_term', 80)),
      'utm_id',       lower(left(_j ->> 'utm_id', 60)),
      'src',          left(_j ->> 'src', 200),
      'sck',          left(_j ->> 'sck', 200),
      'fbclid',       left(_j ->> 'fbclid', 200),
      'gclid',        left(_j ->> 'gclid', 200),
      'ttclid',       left(_j ->> 'ttclid', 200),
      'ref',          lower(left(_j ->> 'ref', 60)),
      'landing',      left(_j ->> 'landing', 120),
      'referrer_host',lower(left(_j ->> 'referrer_host', 80)),
      'ts',           left(_j ->> 'ts', 40)
    )), '{}'::jsonb) END;
$$;
