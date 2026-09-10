# orbita (codinome)

Negócio de **placas físicas com QR Code + NFC** que levam o cliente direto pra
avaliar o negócio no Google. Separado do Toqy. Sociedade 50/50 — divide custos
e lucros. Marca, Supabase e domínio próprios (a definir).

- Next.js 16 (App Router) + React 19 + Tailwind 4 + Supabase
- Dev roda na porta **3100** (`npm run dev`)

## O que já tem

| Área | Estado |
|---|---|
| Landing (`/`), pré-venda, grupo WhatsApp | pronto |
| Redirect dinâmico da placa (`/r/[token]`) | pronto (só https + hosts Google) |
| Catálogo de produtos (`/api/plate/products`) | pronto (lê `plate_product_types`) |
| Funil de eventos (`/api/plate/funnel`) | pronto |
| Painel financeiro (`/painel`) | pronto — visão geral, lançamentos, calculadoras |
| Compra individual + checkout | falta (aguarda provedor de pagamento) |
| Revenda + ativação de placa (`/painel/ativar`) | placeholder |
| Google Places / link de avaliação | falta |

Plano completo: [.planning/PLAN_PLACAS.md](.planning/PLAN_PLACAS.md)

## Setup

```bash
npm install
cp .env.example .env.local   # preencher depois
npm run dev
```

1. **Criar projeto Supabase novo** (não usar o do Toqy).
2. Aplicar a migration: cole `supabase/migrations/0001_foundation.sql` no
   SQL Editor do Supabase e rode. Cria `profiles` + roles + módulo `plate_*`
   + módulo `finance_*`. Já semeia 3 produtos (cartão, 10x10, 10x15-L em "em breve").
3. Preencher `.env.local` com URL + anon key + service_role key do projeto novo.
4. Criar seu usuário (Auth > Users no Supabase) e virar admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu@email.com';
   ```
5. Cadastrar os sócios pra divisão de lucro:
   ```sql
   insert into public.finance_partners (name, share_percent) values ('Léo', 50), ('Sócio', 50);
   ```
6. `/painel` → entrar com email/senha → aba Lançamentos / Calculadoras.

## Verificação

```bash
npx tsc --noEmit
npm run lint
npx vitest run
npm run build
```

## Comandos

| Comando | O quê |
|---|---|
| `npm run dev` | dev server :3100 |
| `npm run build` | build produção |
| `npm run lint` | eslint |
| `npm run test` | vitest (calc financeira, state machine, redirect) |
