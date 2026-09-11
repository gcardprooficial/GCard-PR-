# GCard-PRÓ

Cartões e plaquinhas com NFC + QR Code que levam o cliente direto para a tela de
avaliação do Google do estabelecimento. Fase 1: site público + checkout guiado +
redirecionamento `/r/{token}` + painel administrativo.

## Stack

- TanStack Start (Vite, SSR) + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Deploy: Vercel (Nitro preset `vercel`)

## Desenvolvimento

```sh
bun install
cp .env.example .env   # preencha os valores
bun run dev
```

Rotas: `/` (landing), `/comprar` (checkout guiado), `/r/{token}` (redirect da placa),
`/painel` (admin — em construção).

## Banco de dados

Migrações em `supabase/migrations/`, aplicadas em ordem. Todas as tabelas com RLS
ativado; funções de papel (`has_role`, `is_team`) vivem no schema `app_private`,
fora da API pública. Preço é sempre recalculado no servidor
(`src/lib/checkout.functions.ts`), nunca confiando no valor do navegador.

## Variáveis de ambiente

Ver `.env.example`. Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_MAPS_API_KEY`,
`MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY` e
`RESEND_FROM` ou `RESEND_FROM_EMAIL`) só no gerenciador de segredos da hospedagem — nunca no
repositório, nunca em variáveis `VITE_*`.

## Deploy (Vercel)

1. Importar o repositório no Vercel.
2. Definir env vars (todas de `.env.example` que já tiver valor).
3. Definir `NITRO_PRESET=vercel` (também em `vercel.json`).
4. Build: `bun run build` · Output: automático (Nitro → `.vercel/output`).

O endpoint do webhook do Mercado Pago é `/api/webhooks/mercadopago`. Ele valida a
assinatura `x-signature`, consulta o pagamento na API do Mercado Pago e só então
marca o pedido como pago e envia o evento `pagamento_confirmado`. Os eventos
`pedido_recebido` e `pedido_enviado` também usam a tabela `email_events`, com
chave única por pedido/evento para impedir duplicidade em reenvios.

Atualizações estratégicas são opcionais no checkout e só são enviadas para
contatos com consentimento registrado em `marketing_contacts`. O link
`/api/unsubscribe?token=...` registra o descadastro.
