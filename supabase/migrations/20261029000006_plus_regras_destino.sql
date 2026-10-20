-- GCard Plus: destino por horário, dia da semana e validade. ADITIVA e idempotente.
-- Cada código pode ter até 10 regras. A primeira (por posição) que casar no momento da leitura vence; sem regra que case,
-- vale o destino normal do código. O /r só considera as regras se o dono tem Plus em dia: sem Plus, volta ao destino normal
-- (regra de ouro: a placa nunca para; o destino normal nunca é tocado por esta migração).
-- Escrever regra exige Plus em dia (ou equipe); ler, o dono lê sempre. O destino da regra passa pela mesma lista de hosts liberados.
-- REVERTER: DROP TABLE IF EXISTS public.plate_rules; DROP FUNCTION IF EXISTS public.plate_rules_guard();

CREATE TABLE IF NOT EXISTS public.plate_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_id        UUID NOT NULL REFERENCES public.plates ON DELETE CASCADE,
  label           TEXT CHECK (label IS NULL OR length(label) <= 60),
  destination_url TEXT NOT NULL,
  days            SMALLINT[] CHECK (days IS NULL OR (days <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[])),
  start_time      TIME,
  end_time        TIME,
  valid_from      DATE,
  valid_until     DATE,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((start_time IS NULL) = (end_time IS NULL)),
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until >= valid_from)
);
CREATE INDEX IF NOT EXISTS plate_rules_plate_idx ON public.plate_rules (plate_id) WHERE enabled;

CREATE OR REPLACE FUNCTION public.plate_rules_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_allowed_destination(NEW.destination_url) THEN
    RAISE EXCEPTION 'Esse endereço ainda não está liberado para este código.';
  END IF;
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.plate_rules WHERE plate_id = NEW.plate_id) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 regras por código.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.plate_rules_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS plate_rules_guard_trg ON public.plate_rules;
CREATE TRIGGER plate_rules_guard_trg BEFORE INSERT OR UPDATE OF destination_url ON public.plate_rules
  FOR EACH ROW EXECUTE FUNCTION public.plate_rules_guard();

ALTER TABLE public.plate_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plate_rules FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plate_rules TO authenticated;
GRANT ALL ON public.plate_rules TO service_role;

-- Ler: quem enxerga o código (dono pelo lote, ou equipe) — a RLS de plates já filtra.
DROP POLICY IF EXISTS "plate_rules read" ON public.plate_rules;
CREATE POLICY "plate_rules read" ON public.plate_rules FOR SELECT TO authenticated
  USING (plate_id IN (SELECT id FROM public.plates));
-- Escrever: o mesmo, e só com Plus em dia (ou equipe).
DROP POLICY IF EXISTS "plate_rules write" ON public.plate_rules;
CREATE POLICY "plate_rules write" ON public.plate_rules FOR ALL TO authenticated
  USING (plate_id IN (SELECT id FROM public.plates) AND (public.my_plus_active() OR app_private.is_team(auth.uid())))
  WITH CHECK (plate_id IN (SELECT id FROM public.plates) AND (public.my_plus_active() OR app_private.is_team(auth.uid())));
