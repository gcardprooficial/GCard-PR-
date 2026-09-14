-- Código de ativação curto e legível, separado do token (que fica longo e
-- aleatório de propósito -- é o que vai no QR, não pode ser adivinhável).
CREATE SEQUENCE IF NOT EXISTS public.plates_short_code_seq START 1;

ALTER TABLE public.plates ADD COLUMN IF NOT EXISTS short_code TEXT;

ALTER TABLE public.plates
  ALTER COLUMN short_code
  SET DEFAULT ('GCARD-' || lpad(nextval('public.plates_short_code_seq')::text, 5, '0'));

UPDATE public.plates
   SET short_code = 'GCARD-' || lpad(nextval('public.plates_short_code_seq')::text, 5, '0')
 WHERE short_code IS NULL;

ALTER TABLE public.plates ALTER COLUMN short_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plates_short_code_key'
  ) THEN
    ALTER TABLE public.plates ADD CONSTRAINT plates_short_code_key UNIQUE (short_code);
  END IF;
END $$;
