-- GCard Plus: link de acompanhamento para o cliente do assinante. ADITIVA e idempotente.
-- O assinante cria um link privado por código; quem tem o link vê só números agregados daquele código (leituras por dia,
-- NFC/QR), sem destino, sem token do código e sem nada de pessoa. O link vale só enquanto o dono tem Plus em dia e
-- enquanto não for revogado. Criar/revogar exige Plus em dia (ou equipe); o dono lê os próprios links sempre.
-- REVERTER: DROP TABLE IF EXISTS public.plate_report_links;

CREATE TABLE IF NOT EXISTS public.plate_report_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token      TEXT NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  plate_id   UUID NOT NULL REFERENCES public.plates ON DELETE CASCADE,
  label      TEXT CHECK (label IS NULL OR length(label) <= 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS plate_report_links_plate_idx ON public.plate_report_links (plate_id);

ALTER TABLE public.plate_report_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plate_report_links FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.plate_report_links TO authenticated;
GRANT ALL ON public.plate_report_links TO service_role;

DROP POLICY IF EXISTS "report_links read" ON public.plate_report_links;
CREATE POLICY "report_links read" ON public.plate_report_links FOR SELECT TO authenticated
  USING (plate_id IN (SELECT id FROM public.plates));
DROP POLICY IF EXISTS "report_links insert" ON public.plate_report_links;
CREATE POLICY "report_links insert" ON public.plate_report_links FOR INSERT TO authenticated
  WITH CHECK (plate_id IN (SELECT id FROM public.plates) AND (public.my_plus_active() OR app_private.is_team(auth.uid())));
DROP POLICY IF EXISTS "report_links update" ON public.plate_report_links;
CREATE POLICY "report_links update" ON public.plate_report_links FOR UPDATE TO authenticated
  USING (plate_id IN (SELECT id FROM public.plates))
  WITH CHECK (plate_id IN (SELECT id FROM public.plates));

-- O dono só pode REVOGAR (preencher revoked_at); não troca token nem código do link.
CREATE OR REPLACE FUNCTION public.plate_report_links_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.token <> OLD.token OR NEW.plate_id <> OLD.plate_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Essa informação não pode ser alterada.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.plate_report_links_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS plate_report_links_guard_trg ON public.plate_report_links;
CREATE TRIGGER plate_report_links_guard_trg BEFORE UPDATE ON public.plate_report_links
  FOR EACH ROW EXECUTE FUNCTION public.plate_report_links_guard();
