# GCard-PRÓ — setup nas suas contas

Tudo local em `C:\mega-brain-test\projects\GCard-PRÓ`. Sem remote, sem deploy.
Faça na ordem.

---

## 1. GitHub (sua conta)

Crie um repositório **privado** vazio chamado `gcard-pro` (sem README).

```bash
cd "C:\mega-brain-test\projects\GCard-PRÓ"
git remote add origin https://github.com/SEU_USUARIO/gcard-pro.git
git push -u origin main
```

> Existe um repo abandonado `leonardomarusso1-design/gcard-pro` (conta errada, não
> consegui apagar). Apague em github.com → repo → Settings → Delete repository.

---

## 2. Supabase (sua conta)

1. Novo projeto. Região: **South America (São Paulo)**.
2. Aplicar as migrações (CLI, aplica as 5 em ordem):

```bash
cd "C:\mega-brain-test\projects\GCard-PRÓ"
npx supabase login
npx supabase link --project-ref SEU_REF
npx supabase db push
```

   Alternativa sem CLI: SQL Editor → colar e rodar, **nesta ordem**, o conteúdo de:
   1. `supabase/migrations/20260910184023_...sql`
   2. `supabase/migrations/20260910184045_...sql`
   3. `supabase/migrations/20260910184159_...sql`
   4. `supabase/migrations/20260910190223_...sql`
   5. `supabase/migrations/20260911000000_fix_plan_pricing.sql`

3. Project Settings → API → copiar para o `.env`:

| Campo no painel | Variável |
|---|---|
| Project URL | `SUPABASE_URL` e `VITE_SUPABASE_URL` |
| Reference ID | `SUPABASE_PROJECT_ID` e `VITE_SUPABASE_PROJECT_ID` |
| Chave `publishable` (`sb_publishable_...`) | `SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Chave `secret` (`sb_secret_...`) | `SUPABASE_SERVICE_ROLE_KEY` |

---

## 3. Google Cloud (grátis)

1. [console.cloud.google.com](https://console.cloud.google.com) → novo projeto `gcard-pro`.
2. APIs e Serviços → Ativar APIs → **Places API (New)** → Ativar.
3. Credenciais → Criar credenciais → Chave de API.
4. Restringir a chave → Restrições de API → só **Places API (New)**.
5. Copiar para o `.env` → `GOOGLE_MAPS_API_KEY`.

---

## 4. Rodar local

```bash
cd "C:\mega-brain-test\projects\GCard-PRÓ"
npm install
npm run dev
```

Abre em `http://localhost:3000` (ou porta que o Vite indicar).

---

## 5. Vercel (sua conta)

1. vercel.com → Add New → Project → importar `gcard-pro` do seu GitHub.
2. Framework é detectado sozinho. Build: `vite build`. Output: automático.
3. Settings → Environment Variables → adicionar as 8:

```
SUPABASE_URL
SUPABASE_PROJECT_ID
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_PROJECT_ID
VITE_SUPABASE_PUBLISHABLE_KEY
GOOGLE_MAPS_API_KEY
```

   (`NITRO_PRESET=vercel` já está no `vercel.json`.)
4. Deploy. Depois, cada `git push` na `main` faz deploy sozinho.

---

## 6. Depois do deploy — virar admin

Painel ainda não construído. Quando estiver: cadastre-se no `/painel`, depois no
SQL Editor do Supabase:

```sql
insert into public.user_roles (user_id, role)
values ((select id from auth.users where email = 'SEU_EMAIL'), 'admin');
```

---

## 7. Logo

Salvar na pasta `public/`:
- `public/favicon.ico` — versão só-ícone (G + ondas), fundo branco
- `public/og-image.png` — 1200×630, lockup "GCard-PRÓ" fundo branco

Depois aviso pra ligar o `og:image` no `<head>`.

---

## Ainda pendente (próximas sessões)

- Painel admin (pedidos, financeiro 50/50, placas, scans, auditoria)
- Camada `PaymentProvider` + Mercado Pago + webhook + emissão idempotente de placa
- E-mails transacionais (Resend)
- Páginas `/termos` e `/privacidade`
- Revisão de segurança dedicada antes de divulgar
