-- 1) E-mails: novos eventos (lembrete de pagamento e pedido entregue).
ALTER TABLE public.email_events DROP CONSTRAINT IF EXISTS email_events_event_type_check;
ALTER TABLE public.email_events ADD CONSTRAINT email_events_event_type_check
  CHECK (event_type IN (
    'pedido_recebido',
    'pagamento_pendente',
    'pagamento_confirmado',
    'lote_criado',
    'em_producao',
    'pedido_enviado',
    'pedido_entregue'
  ));

-- 2) Financeiro: no máximo 1 entrada automática por pedido (webhook, retorno e cron
--    podem chegar juntos; o índice garante que só uma vence).
CREATE UNIQUE INDEX IF NOT EXISTS finance_entries_order_entrada_uniq
  ON public.finance_entries (order_id)
  WHERE kind = 'entrada' AND order_id IS NOT NULL;

-- 3) Backfill: pedidos que já estão pagos e nunca foram lançados no Financeiro.
INSERT INTO public.finance_entries (kind, category, description, amount_cents, entry_date, order_id)
SELECT 'entrada'::public.finance_kind,
       'Vendas',
       'Pedido #' || o.order_number,
       o.total_cents,
       (COALESCE(o.paid_at, o.created_at) AT TIME ZONE 'America/Sao_Paulo')::date,
       o.id
  FROM public.orders o
 WHERE o.payment_status = 'pago'
   AND NOT EXISTS (
     SELECT 1 FROM public.finance_entries f
      WHERE f.order_id = o.id AND f.kind = 'entrada'
   );
