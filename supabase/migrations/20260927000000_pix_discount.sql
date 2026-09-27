-- Promoção temporária: 5% de desconto pagando via Pix (até 30/09/2026).
-- Flag idempotente -- sem ela, gerar o link de pagamento de novo (ex.: link expirou)
-- aplicaria o desconto duas vezes em cima do preço já reduzido.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pix_discount_applied BOOLEAN NOT NULL DEFAULT false;
