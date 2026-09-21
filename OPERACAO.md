# GCard-PRÓ — Operação e arquitetura (estado em 21/09/2026)

Guia de como o sistema funciona hoje, o que depende de configuração manual e o que ainda está em aberto.

## Catálogo

| Produto | Material | QR | NFC | Código/lote |
|---|---|---|---|---|
| Cartão de bolso | PVC, 8,5×5,4 cm | não | sim (aproximação) | **não** — estoque simples |
| Placa 10×10 | acrílico puro, arte “Avaliação do Google” (adesivo retroverso) | sim | sim | sim (`GCARD-00001`…) |
| Acrílico sem arte (10×10 e 15×10 em L) | cristal, branco, preto | não | não | **não** — só revenda, kit ≥ 10 un. |

- Lojista: preço fixo por unidade (faixa para 5 un.). Revenda: a partir de 10 un., preço cai por faixa. Frete grátis. Preços vêm do banco (`plans`, `plan_price_tiers`, `product_price_tiers`).
- Tamanhos fora do padrão: orçamento pelo WhatsApp. Atendimento **só por WhatsApp** (Leonardo 19 99705-1919, Paulo 11 95294-6565, em `src/lib/contact.ts`). Chat próprio e Tawk foram removidos.

## Pagamento (Mercado Pago)

- Checkout como convidado: a preferência envia nome e CPF do comprador, **nunca o e-mail** (o e-mail de quem tem conta no MP força login).
- Retorno do MP vai para `/pagamento/retorno`, que consulta o `payment_id` na API (não confia na URL).
- Único ponto que grava pagamento: `src/lib/payments/settle.server.ts` → `applyPaymentToOrder`. Chamado por: webhook, `/pagamento/retorno`, painel (ao abrir e no botão “Atualizar e conferir pagamentos”) e cron diário. Ao virar PAGO: emite placas (se o produto tiver código), manda e-mail e lança **entrada “Vendas”** no Financeiro (1 por pedido, índice único).
- Pedido pago à mão no painel também lança no Financeiro.
- `createPreference` tenta 3× e, se falhar, avisa `ADMIN_NOTIFY_EMAIL`. Painel tem “Gerar e copiar link” e “Enviar por e-mail” (link de pagamento).
- Cron `/api/cron/daily` (Vercel, 12:00 UTC = 9h BRT): reconcilia pendentes e envia 1 lembrete de pagamento (link novo) para pendentes há > 2h. **Protegido por `CRON_SECRET`** (sem ela, retorna 401).

## E-mails (Resend)

Eventos em `src/lib/email-events.server.ts` (idempotentes por pedido; envio “failed” pode ser reenviado): `pedido_recebido`, `pagamento_pendente`, `pagamento_confirmado`, `lote_criado`, `em_producao`, `pedido_enviado`, `pedido_entregue`. Tutorial de ativação vai para revenda com código; cartão PVC e acrílico sem arte não recebem tutorial de `/ativar`. Enviado (revenda) lista `GCARD-xxxxx` + link do QR de cada placa. Gatilhos no painel: pago, em produção, entregue, lote montado, rastreio salvo (enviado).

## Painel

- **Pedidos:** abas por etapa (Aguardando pagamento, Pagos a produzir, Em produção, Enviados, Entregues/cancelados). Pendentes mostram idade e motivo (sem link / link gerado / recusado).
- **Lote por escaneamento:** no pedido de revenda pago, “Vincular placas escaneadas” — cole `GCARD-000XX`, links `/r/…` ou tokens. RPC `allocate_batch_from_tokens` valida (existe, livre, mesmo produto) e monta o lote de forma atômica. “Gerar lote do estoque (ordem)” existe mas **não usar**: a ordem impressa não bate com a do banco.
- **Placas:** visões Por lote (recolhível), Estoque livre, Todas; paginação. **Estoque de cartões de PVC** no topo: produzidos (manual), vendidos (pedidos pagos), a enviar, em estoque; baixas e histórico (`card_stock_entries`).
- Pedidos de loja própria com código ganham lote (dono = e-mail da compra) para o comprador ver as placas em `/ativar`.

## Regras de dados que não podem ser quebradas

- Placa que sai de um lote **volta ao estoque** (`batch_id = null`); nunca `DELETE` — é objeto físico já impresso.
- Antes de qualquer `DELETE` em dado físico/estoque, `select *` da linha e mostrar.
- Venda feita fora do site entra por SQL com `payment_provider = 'manual'`, sem lançar entrada (já está no Financeiro).

## Design system

`--secondary` é o **azul-marinho** (`#0F172A`, sidebar). Para fundo claro use `bg-muted` (`#F1F5F9`) ou `bg-surface` (`#F8FAFC`); nunca `bg-secondary` com texto escuro.

## Migrations desta rodada (todas já rodadas, exceto se indicado)

`20260916160000_catalogo_acrilico_sem_arte`, `20260916213500_email_events_add_lote_producao`, `20260921000000_pagamentos_financeiro_emails`, `20260921010000_allocate_batch_from_tokens`, `20260921020000_card_stock` (**rodar se ainda não rodou**).

## Configuração externa

Vercel: `CRON_SECRET`, `ADMIN_NOTIFY_EMAIL`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY`, `PUBLIC_APP_URL`. Supabase Auth: o e-mail de confirmação usa o template do dashboard (link no domínio `supabase.co`, aceito).

## Em aberto

- Pedidos de loja própria antigos não têm lote (issue #11).
- Loja no Mercado Livre: não existe; card removido da home.
- Supabase MCP (`.mcp.json`, somente leitura) precisa de `claude /mcp` → Authenticate.
- Confirmar em produção: pagamento sem login (aba anônima), PAGO automático de ponta a ponta, telas do painel logado.
- Backlog no GitHub (`gcardprooficial/GCard-PR-`, issues #1–#12): fechar com o hash dos commits após validar.
