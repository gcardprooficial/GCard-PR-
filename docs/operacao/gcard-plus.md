# GCard Plus (assinatura)

R$ 19,90/mês ou R$ 190,80/ano, cobrado pela Kiwify (1 produto, 2 planos). Placas e ativação continuam grátis para sempre.

**Regra de ouro:** vencer ou cancelar nunca derruba placa nem QR. Os destinos ficam como estão; só os recursos do Plus pausam.
O destino de um QR criado pelo Plus fica congelado sem assinatura em dia (trigger `plates_plus_freeze`); placas compradas não são afetadas.

## Peças
- Webhook `POST /api/webhooks/kiwify-plus`: assinatura `?signature` = HMAC-SHA1 do corpo com `KIWIFY_PLUS_WEBHOOK_TOKEN`. Grava em `plus_subscriptions` pelo e-mail da compra (conta pode nascer depois). `KIWIFY_PLUS_PRODUCT_IDS` é filtro opcional.
- Eventos para o Hub (outbox): `plus_assinado`, `plus_atrasado`, `plus_cancelado` (data.plan) e `qr_criado` (data.host). Só mudança de estado gera evento.
- Flag `app_settings.gcard_plus` (leitura do cliente por `plus_enabled()`): desligada = nada aparece e `plus_create_qr` recusa.
- `/ativar` (assinante em dia): troca de destino em lote, estatísticas (7/30/90 dias), criador de QR. Sem assinatura: 1 QR de teste.
- Cron diário existente (`/api/cron/daily`, 12:00 UTC): relatório mensal no dia 1 (SP) e alerta de destino fora do ar (1 por código por semana). Dedupe em `plus_webhook_events`.

## Ligar a venda
Só depois do teste do QR e da primeira venda real combinada com o Hub:
`UPDATE public.app_settings SET value = '{"enabled": true}'::jsonb WHERE key = 'gcard_plus';`

## Conferir a 1ª venda
`SELECT kiwify_product_id, plan, status, last_event, created_at FROM public.plus_subscriptions ORDER BY created_at DESC LIMIT 5;`
Avisos ignorados aparecem na Vercel como `kiwify-plus ignorado` (tipo e frequência, sem dado pessoal).
