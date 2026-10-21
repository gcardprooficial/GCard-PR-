-- GCard Plus: estilo do QR (cores, cantos, frase e logo reduzido) salvo por código. ADITIVA e idempotente.
-- JSON pequeno: o dono edita pelo painel (RLS de plates). Só aparência do arquivo baixado; não afeta redirecionamento.
-- REVERTER: ALTER TABLE public.plates DROP COLUMN IF EXISTS qr_style;
ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS qr_style JSONB;
ALTER TABLE public.plates DROP CONSTRAINT IF EXISTS plates_qr_style_size_check;
ALTER TABLE public.plates ADD CONSTRAINT plates_qr_style_size_check CHECK (qr_style IS NULL OR length(qr_style::text) <= 150000);
