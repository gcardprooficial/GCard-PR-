-- WhatsApp v3: avisos de pedido (espelho dos e-mails) + pesquisa "por onde chegou até nós".
-- Rode DEPOIS de 20261002010000_whatsapp_v2_etiquetas.sql.

-- ---------------------------------------------------------------------------
-- 1) Avisos de pedido por WhatsApp: 1 por pedido+evento (mesma regra dos e-mails).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_order_notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  wa_id      TEXT,
  status     TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, event_type)
);
CREATE INDEX IF NOT EXISTS wa_order_notifications_day_idx ON public.wa_order_notifications (created_at);
ALTER TABLE public.wa_order_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.wa_order_notifications TO authenticated;
GRANT ALL ON public.wa_order_notifications TO service_role;
DROP POLICY IF EXISTS "wa notif team read" ON public.wa_order_notifications;
CREATE POLICY "wa notif team read" ON public.wa_order_notifications FOR SELECT TO authenticated
  USING (app_private.is_team(auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Fluxo "Pesquisa de origem": só roda quando a equipe manda (gatilho "manual").
--    A resposta vira etiqueta "Origem: …" no contato.
-- ---------------------------------------------------------------------------
INSERT INTO public.wa_flows (name, trigger, start, nodes, sort_order)
SELECT
  'Pesquisa de origem (manual)',
  '{"type":"manual"}'::jsonb,
  'n1',
  '{
    "n1": {"type":"choice","text":"Por gentileza, para nos ajudar a aprimorar nosso canal de comunicação, você poderia nos informar por onde chegou até nós?","options":[
      {"title":"Instagram"},
      {"title":"YouTube"},
      {"title":"Google / Site"},
      {"title":"Indicação de amigo/parceiro"},
      {"title":"ChatGPT / Inteligência Artificial"},
      {"title":"Outro"}],"next":"n2"},
    "n2": {"type":"text","text":"Agradeço demais pela gentileza e pelo seu feedback! 🚀","next":null}
  }'::jsonb,
  90
WHERE NOT EXISTS (SELECT 1 FROM public.wa_flows WHERE name = 'Pesquisa de origem (manual)');
