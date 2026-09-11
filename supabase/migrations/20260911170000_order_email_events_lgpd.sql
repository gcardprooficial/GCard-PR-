-- E-mail transacional e consentimento LGPD.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  marketing_consent_at TIMESTAMPTZ,
  marketing_unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('pedido_recebido', 'pagamento_confirmado', 'pedido_enviado')),
  idempotency_key TEXT NOT NULL UNIQUE,
  recipient TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'queued', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, event_type)
);

CREATE INDEX IF NOT EXISTS email_events_order_idx ON public.email_events(order_id, event_type);
CREATE INDEX IF NOT EXISTS marketing_contacts_consent_idx ON public.marketing_contacts(marketing_consent_at)
  WHERE marketing_consent_at IS NOT NULL AND marketing_unsubscribed_at IS NULL;

GRANT ALL ON public.email_events TO service_role;
GRANT ALL ON public.marketing_contacts TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_marketing_contact()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS marketing_contacts_updated_at ON public.marketing_contacts;
CREATE TRIGGER marketing_contacts_updated_at BEFORE UPDATE ON public.marketing_contacts
FOR EACH ROW EXECUTE FUNCTION public.touch_marketing_contact();
