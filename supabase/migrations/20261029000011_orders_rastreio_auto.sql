-- Rastreio automático: guarda o id da etiqueta no Melhor Envio e o estado real dela (postada, entregue…). ADITIVA e idempotente.
-- me_order_id: id da etiqueta no Melhor Envio (para consultar o rastreio). shipping_status: estado cru que a transportadora/plataforma informou.
-- delivered_at: quando foi entregue (informado pela plataforma). tracking_synced_at: última consulta bem-sucedida.
-- REVERTER: ALTER TABLE public.orders DROP COLUMN IF EXISTS me_order_id, DROP COLUMN IF EXISTS shipping_status,
--           DROP COLUMN IF EXISTS delivered_at, DROP COLUMN IF EXISTS tracking_synced_at;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS me_order_id TEXT,
  ADD COLUMN IF NOT EXISTS shipping_status TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_synced_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS orders_me_order_idx ON public.orders (me_order_id) WHERE me_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_tracking_code_idx ON public.orders (lower(tracking_code)) WHERE tracking_code IS NOT NULL;
