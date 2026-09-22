-- Transportadora do envio: sem isso o cliente recebe só um código e não sabe em qual
-- site rastrear (nem sempre é Correios -- Melhor Envio despacha por várias).
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;
