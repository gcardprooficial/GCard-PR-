-- Leads da ferramenta grátis "Gerar link de avaliação". Só o servidor (service_role)
-- grava, via server function -- não é uma tabela pública gravável direto pelo navegador.
CREATE TABLE IF NOT EXISTS public.tool_leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  place_id      TEXT,
  whatsapp      TEXT,
  source        TEXT NOT NULL DEFAULT 'gerador_link',
  contacted_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tool_leads ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.tool_leads TO service_role;
GRANT SELECT, UPDATE ON public.tool_leads TO authenticated;

DROP POLICY IF EXISTS "tool leads team select" ON public.tool_leads;
CREATE POLICY "tool leads team select" ON public.tool_leads FOR SELECT TO authenticated
  USING (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "tool leads team update" ON public.tool_leads;
CREATE POLICY "tool leads team update" ON public.tool_leads FOR UPDATE TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

CREATE INDEX IF NOT EXISTS tool_leads_created_idx ON public.tool_leads(created_at DESC);
