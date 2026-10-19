-- Estado de entrega dos e-mails de pedido (Resend: entregue / bounce / suprimido / reclamação).
-- ADITIVA e idempotente. Só acrescenta colunas em email_events; o status de envio (processing/sent/failed) continua igual.
-- REVERTER: ALTER TABLE public.email_events DROP COLUMN IF EXISTS provider_message_id, DROP COLUMN IF EXISTS delivery_status,
--           DROP COLUMN IF EXISTS delivery_detail, DROP COLUMN IF EXISTS delivery_at;
ALTER TABLE public.email_events
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT,
  ADD COLUMN IF NOT EXISTS delivery_detail TEXT,
  ADD COLUMN IF NOT EXISTS delivery_at TIMESTAMPTZ;
ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS email_events_delivery_status_check;
ALTER TABLE public.email_events ADD CONSTRAINT email_events_delivery_status_check
  CHECK (delivery_status IS NULL OR delivery_status IN ('entregue', 'atrasado', 'bounce', 'suprimido', 'reclamacao'));
CREATE INDEX IF NOT EXISTS email_events_provider_msg_idx ON public.email_events (provider_message_id) WHERE provider_message_id IS NOT NULL;

-- A equipe precisa ler o estado dos e-mails no painel (antes só o servidor lia). Cliente comum continua sem acesso.
GRANT SELECT ON public.email_events TO authenticated;
DROP POLICY IF EXISTS "email_events team read" ON public.email_events;
CREATE POLICY "email_events team read" ON public.email_events FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));
