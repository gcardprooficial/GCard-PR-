-- Repair schema drift from the reseller rollout.
-- Safe to run on an existing project: all additions are idempotent.
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS product_id UUID,
  ADD COLUMN IF NOT EXISTS owner_email TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codes_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_to TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'batches_product_id_fkey'
      AND conrelid = 'public.batches'::regclass
  ) THEN
    ALTER TABLE public.batches
      ADD CONSTRAINT batches_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.plates
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS sold_to TEXT,
  ADD COLUMN IF NOT EXISTS activated_by UUID REFERENCES auth.users ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS batches_owner_idx ON public.batches (owner_user_id);
CREATE INDEX IF NOT EXISTS plates_batch_idx ON public.plates (batch_id);

DROP POLICY IF EXISTS "batches owner read" ON public.batches;
CREATE POLICY "batches owner read" ON public.batches FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "plates owner read" ON public.plates;
CREATE POLICY "plates owner read" ON public.plates FOR SELECT TO authenticated
  USING (batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "plates owner update" ON public.plates;
CREATE POLICY "plates owner update" ON public.plates FOR UPDATE TO authenticated
  USING (batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = auth.uid()))
  WITH CHECK (batch_id IN (SELECT id FROM public.batches WHERE owner_user_id = auth.uid()));