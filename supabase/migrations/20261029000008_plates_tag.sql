-- GCard Plus: pasta/etiqueta por código (organizar muitos QR por cliente ou campanha). ADITIVA e idempotente.
-- Texto livre de até 40 caracteres; o dono edita pelo painel (a RLS de plates já limita ao dono). Só organização: não afeta redirecionamento.
-- REVERTER: ALTER TABLE public.plates DROP COLUMN IF EXISTS tag;
ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS tag TEXT;
ALTER TABLE public.plates DROP CONSTRAINT IF EXISTS plates_tag_len_check;
ALTER TABLE public.plates ADD CONSTRAINT plates_tag_len_check CHECK (tag IS NULL OR length(tag) <= 40);
