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

## Envio

- Painel: seletor de transportadora (`tracking_carrier`) junto do código de rastreio. E-mail de "enviado" mostra a transportadora certa e, quando existe (Correios/Jadlog/Loggi), o link direto de rastreio (`src/lib/shipping.ts`).
- **Melhor Envio (fase 1 — conectado e testado em 22/09/2026):** OAuth2 em `src/lib/shipping/melhorenvio.server.ts`. Painel → Integrações → Conectar/Testar conexão. Tokens só no servidor (`app_settings`, via service_role). App em **produção** (client_id 30285), não sandbox — o app foi cadastrado no painel de produção do Melhor Envio, que é uma conta/login separada do sandbox.
  - Erros reais encontrados e corrigidos, na ordem: (1) endpoint `/oauth/token` quer `multipart/form-data`, não JSON, apesar da doc oficial resumida dizer o contrário — confirmado no código-fonte do SDK `talissonf/melhor-envio-sdk`; (2) `PUBLIC_APP_URL` no Vercel estava sem `www`, mas o app foi cadastrado com `www.gcardpro.com.br` — mismatch de `redirect_uri` derruba com `invalid_client` **no /oauth/authorize**, antes até de gerar `code` (por isso nenhum log do nosso lado aparecia); (3) `GET /api/v2/me` exige escopo `users-read`, que não estava pedido.
  - **Fase 2a (22/09/2026) — cotação:** botão "Cotar frete" no pedido (painel.index.tsx), só leitura. CEP de origem `13344-652`. Perfis de embalagem por kit de 10 un. em `PACKAGE_PROFILES` (melhorenvio.server.ts): acrílico 0,5kg/4×4×10cm, PVC 0,3kg/2×2×8cm — altura escala linear com nº de kits (`ceil(quantidade/10)`), aproximação, ajustável ali. **Nunca** afeta o preço mostrado ao comprador (fixo, frete já diluído) — é só pra Leonardo comparar transportadora antes de despachar.
  - **Fase 2b (22/09/2026) — compra de etiqueta:** botão "Comprar etiqueta" ao lado de cada cotação (painel.index.tsx). `buyShippingLabel` (melhorenvio.server.ts) adiciona ao carrinho, paga com saldo da carteira Melhor Envio e gera a etiqueta; grava `tracking_code`/`tracking_carrier` no pedido automaticamente (sem digitar à mão). Remetente fixo em `ORIGIN_ADDRESS`: Leonardo Marusso, Romeu Ferigati 330 apto 01, Jardim Belo Horizonte, Indaiatuba/SP, CEP 13344-652, CNPJ 68.194.199/0001-70. **Gasta saldo de verdade** — confirmação obrigatória no painel antes de comprar. Sem cancelamento automático; se comprar errado, cancelar direto no painel do Melhor Envio.
    - Grafia "Romeu Ferigati" (1 t) confirmada por Leonardo em 22/09/2026 — corrigida em `company.ts`, `privacidade.tsx`, `termos.tsx` (antes tinha "Ferigatti" com 2 t).

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
