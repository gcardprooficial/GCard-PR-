-- GCard Plus (assinatura): base. ADITIVA e idempotente. Nada existente é alterado.
--  1) plus_subscriptions: uma linha por assinatura da Kiwify (mensal ou anual), ligada pelo e-mail da compra;
--  2) plus_webhook_events: idempotência do webhook (a Kiwify reenvia; o mesmo aviso nunca vale duas vezes).
-- Escrita só pelo servidor (service_role). O cliente lê só a própria assinatura; a equipe lê todas.
-- A assinatura vale pelo E-MAIL da compra: se a conta ainda não existe, ela fica "esperando" na tabela e passa a valer
-- sozinha quando alguém se cadastra e CONFIRMA esse e-mail (não precisa de estado separado).
--
-- REGRA DE OURO (aprovada): vencer ou cancelar NUNCA derruba placa nem QR. Esta migração não toca em plates, /r nem destinos.
--
-- REVERTER: DROP TABLE IF EXISTS public.plus_webhook_events, public.plus_subscriptions;

CREATE TABLE IF NOT EXISTS public.plus_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  TEXT NOT NULL CHECK (email = lower(email)),
  plan                   TEXT NOT NULL CHECK (plan IN ('mensal', 'anual')),
  status                 TEXT NOT NULL CHECK (status IN ('ativa', 'atrasada', 'cancelada', 'reembolsada')),
  kiwify_subscription_id TEXT,
  kiwify_order_id        TEXT,
  kiwify_product_id      TEXT,
  current_period_end     TIMESTAMPTZ,
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at            TIMESTAMPTZ,
  last_event             TEXT NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plus_subscriptions_sub_uidx ON public.plus_subscriptions (kiwify_subscription_id)
  WHERE kiwify_subscription_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS plus_subscriptions_order_uidx ON public.plus_subscriptions (kiwify_order_id)
  WHERE kiwify_subscription_id IS NULL AND kiwify_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plus_subscriptions_email_idx ON public.plus_subscriptions (email);

ALTER TABLE public.plus_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.plus_subscriptions FROM PUBLIC, anon;
GRANT SELECT ON public.plus_subscriptions TO authenticated;
GRANT ALL ON public.plus_subscriptions TO service_role;
DROP POLICY IF EXISTS "plus subs read" ON public.plus_subscriptions;
CREATE POLICY "plus subs read" ON public.plus_subscriptions FOR SELECT TO authenticated
  USING (app_private.is_team(auth.uid()) OR email = lower(COALESCE(auth.jwt() ->> 'email', '')));

DROP TRIGGER IF EXISTS plus_subscriptions_updated_at ON public.plus_subscriptions;
CREATE TRIGGER plus_subscriptions_updated_at BEFORE UPDATE ON public.plus_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.plus_webhook_events (
  dedupe_key  TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plus_webhook_events ENABLE ROW LEVEL SECURITY;     -- sem políticas: só o servidor
REVOKE ALL ON public.plus_webhook_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.plus_webhook_events TO service_role;
