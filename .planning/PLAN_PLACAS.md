# Plano técnico — Placas & Avaliações (projeto "orbita", codinome)

> **2026-09-10 — PIVOT:** este módulo saiu do Toqy e virou negócio próprio,
> sociedade 50/50 com sócio. Marca/Supabase/domínio próprios (a definir).
> Repo: `projects/orbita`. Tabelas `plate_*` + `finance_*` na migration
> `supabase/migrations/0001_foundation.sql`. Nada mais depende do Toqy.
>
> Status herdado do Toqy: fundação (tipos, state machine, redirect `/r/`,
> landing, funil) + painel financeiro (calc + UI) portados. Fase 2 (compra
> individual) aguarda provedor de pagamento + Google Places. Fase 4
> (revenda/ativação) e checkout ainda por fazer.
> Baseado no prompt/spec do Leonardo + 17 prints do AvaliaCard.

---

## 0. Decisões já fechadas com o Leonardo (2026-09-10)

| Tema | Decisão |
|---|---|
| Separação na home | Módulo separado em `toqy.com.br`. Landing própria (`/placas`). Nos painéis de biosite: **zero** função deste módulo. Única ponte: uma chamadinha em `/app/qr` ("Quer o fornecedor de placas prontas? Clique aqui"). |
| Pagamento | Leonardo configura o provedor. **Recomendação: appmax** (é o que o AvaliaCard usa, BR, produto físico, parcelamento, antifraude, webhook). Feito atrás de uma abstração `PaymentProvider` pra ser trocável. |
| Google Places | Leonardo cria o projeto no Google Cloud + billing + chave. Backend usa camada `GoogleBusinessProvider` com fallback de colar link manual. |
| Frete | **Grátis sempre.** Custo já embutido no preço do produto. Sem cálculo de frete, sem PAC/Sedex, sem API de Correios. Campo `shipping_cost` fica `0` no schema (mantido pra futuro). |
| Produção física | Leonardo + 1 sócio. Precisa de **painel admin** pra receber e controlar tudo: separar "pedido pra empresa própria (precisa configurar arte/negócio)" de "lote pra revendedor (só quantidade + arte de lote)". |
| WhatsApp / Instagram / e-mail automático | **Fora deste MVP.** Vira projeto próprio de marketing/automação (WhatsApp Business API / Meta, disparo automático). Neste módulo: só e-mail transacional via Resend (já existe). |

---

## 1. Nomenclatura (evita colisão com o que já existe)

- `/revenda` **já é rota** do programa de revenda de biosites (`src/app/app/revenda`) — **não usar**.
- `/qr/[slug]` e `toqy_qr_codes` **já existem** (QR avulso pra NFC da plaquinha Pix) — módulo novo é separado, não mexe nisso.

**Escolhido:**

| Uso | Caminho |
|---|---|
| Landing pública do produto | `/placas` |
| Fluxo de compra individual (Caminho A) | `/placas/comprar` (wizard) |
| Fluxo de compra em lote (Caminho B) | `/placas/revenda` |
| Painel do comprador/revendedor | `/app/placas` (aba própria no menu, separada de biosites) |
| Redirect dinâmico do QR/NFC | `/r/[token]` (curto, sem login) |
| Tela pública de ativação (placa não ativada) | `/r/[token]` mesma rota, renderiza estado "não ativada" |
| Painel admin de produção | `/app/admin/placas` (gate `profiles.is_admin`) |
| Prefixo de tabela | `toqy_plate_*` (consistente com `toqy_qr_codes`, `toqy_bookings`) — **NÃO** `evaluation_*` como no rascunho da spec |

---

## 2. Fronteira do módulo (regra mais importante)

- Navegação principal do `/app` ganha um item novo: **"Placas & avaliações"** (`DashboardShell.tsx`), visível só pra quem tem pelo menos 1 pedido/lote OU sempre visível como entrada de compra — **decisão pendente** (ver §11).
- `SiteBuilder`, editor de biosite, `/me`, `/editar/[slug]`: **nenhuma mudança**, nenhum componente novo.
- `/app/qr/page.tsx`: adiciona **um card/banner** no topo — "Quer o fornecedor de placas prontas? Clique aqui" → `/placas`. Só isso.
- `src/app/page.tsx` (home): adiciona **uma seção** com CTA pro `/placas`. Sem misturar com as seções de biosite.
- Dados: tabelas `toqy_plate_*` totalmente separadas de `toqy_biosites`. Um `profiles.id` pode ter os dois produtos; são módulos independentes.
- Auth: **reusa** a auth Supabase que já existe. Zero segunda autenticação.

---

## 3. Banco de dados — migrations novas

Seguindo a convenção do projeto: prefixo `toqy_plate_`, `GRANT` explícito por role
(este projeto Supabase **não tem grant automático** — ver histórico de bugs
`grant_service_role_*`), RLS ligado, política por dono, service_role pra rotas de
servidor.

Arquivo: `supabase/migrations/2026-09-XX_plate_module_foundation.sql`

### `toqy_plate_product_types` — catálogo de produtos físicos
`id`, `name`, `slug` (unique), `description`, `format` (`counter`|`l_stand`|`business_card`|`other`),
`technology` (`qr`|`nfc`|`qr_nfc`), `unit_price` (numeric), `active` (bool),
`images` (jsonb), `created_at`, `updated_at`.
RLS: leitura pública só de `active = true`; escrita só service_role (admin).

### `toqy_plate_orders` — pedido (individual ou lote)
`id`, `owner_profile_id` (fk profiles), `order_type` (`individual`|`reseller`),
`status` (enum §4), `payment_status` (`pending`|`paid`|`failed`|`refunded`),
`subtotal`, `shipping_cost` (default `0`), `discount`, `total`,
`shipping_snapshot` (jsonb — nome, endereço, CEP, telefone congelados no momento),
`customer_notes`, `provider` (`appmax`), `provider_order_id`, `created_at`, `updated_at`.
RLS: dono lê/cria os próprios; update só service_role (via webhook/admin).

### `toqy_plate_order_items`
`id`, `order_id` (fk), `product_type_id` (fk), `quantity`,
`unit_price_snapshot` (**preço congelado**, nunca reconstruir do catálogo atual),
`artwork_id` (nullable), `batch_id` (nullable).

### `toqy_plate_batches` — lote
`id`, `batch_code` (unique, ex `LOTE-000010`), `buyer_profile_id`, `order_id`,
`quantity`, `activated_quantity` (default 0), `status` (enum),
`generated_at` (nullable — só preenche depois do pagamento confirmado),
`delivered_at` (nullable).

### `toqy_plate_units` — unidade individual (o "cartão" físico)
`id`, `batch_id` (nullable — pedido individual pode não ter lote),
`order_id`, `product_type_id`, `internal_serial` (sequencial por lote, exibição),
`public_token` (aleatório 16+ bytes base32, **unique**, indexado — vai no QR/NFC),
`activation_code_hash` (bcrypt/argon do código de ativação),
`activation_code_last4` (só pra exibir "•••• 4821"),
`status` (enum §4), `activated_at`, `activated_by_profile_id`, `final_business_id` (fk),
`created_at`, `updated_at`.
- Código de ativação em texto puro: **nunca gravado**. Mostrado 1x na geração do lote
  (PDF/planilha protegida) e some.
- `public_token` ≠ `activation_code` (funções diferentes, ver tabela na spec §5).

### `toqy_plate_businesses` — negócio final vinculado
`id`, `owner_profile_id` (dono OU revendedor que cadastrou),
`google_place_id` (nullable), `google_business_name`, `google_review_url`,
`business_name`, `category`, `logo_url`, `phone`, `whatsapp`, `address`,
`status` (`active`|`suspended`), `created_at`, `updated_at`.

### `toqy_plate_destinations` — histórico de destino (nunca sobrescreve)
`id`, `unit_id` (fk), `destination_url`, `destination_type` (`google_review`|`custom`),
`is_active` (bool — só 1 ativo por unit), `changed_by_profile_id`, `created_at`.

### `toqy_plate_activations` — registro de ativação
`id`, `unit_id`, `business_id`, `reseller_profile_id`, `activation_code_last4`,
`ip_hash` (nullable), `created_at`.

### `toqy_plate_scan_events` — métrica não-invasiva
`id`, `unit_id`, `event_type` (`qr_scan`|`nfc_open`|`redirect`|`activation_page_view`),
`referrer` (nullable), `device_type` (nullable), `created_at`.
Sem dado pessoal. Agregação depois.

### `toqy_plate_artworks`
`id`, `owner_profile_id`, `order_id`, `logo_url`, `artwork_url`,
`status` (`pending`|`approved`|`rejected`|`revision_requested`),
`review_notes`, `approved_at`, `approved_by`.

### `toqy_plate_audit_log` — auditoria
`id`, `actor_profile_id` (nullable pra ações de sistema/webhook), `entity_type`,
`entity_id`, `action`, `before` (jsonb), `after` (jsonb), `created_at`.
Toda transição de estado relevante escreve aqui.

### RBAC — decisão MVP
Não criar 6 papéis agora. Reusa `profiles.is_admin` (já existe) pra TUDO de operação
(admin + operations + artwork_reviewer + shipping_operator juntos). `reseller` vs
`individual_customer` = **inferido** (tem `toqy_plate_batches` com `order_type=reseller`
→ é revendedor). Papéis granulares entram na Fase 6 se precisar.

### Geração de lote — transacional
Função Postgres `generate_plate_batch(order_id, quantity)` em transação:
`gen_random_bytes` pra token e código, `INSERT ... ON CONFLICT DO NOTHING` +
re-loop até atingir quantity (colisão de 16 bytes é ~impossível, mas o loop garante).
Nunca roda 2x pro mesmo pedido (checa se já existe lote pro `order_id`).

---

## 4. Máquinas de estado (explícitas, iguais à spec)

- **Unidade**: `reserved` → `manufacturing` → `in_stock` → `shipped` → `available_for_activation` → `activated` → (`suspended` ↔) → `cancelled`.
- **Pedido**: `draft` → `pending_payment` → `paid` → `processing` → `artwork_review` → `manufacturing` → `ready_to_ship` → `shipped` → `delivered` → `completed` / `cancelled` / `refunded`.
- **Código de ativação**: `generated` → `assigned_to_batch` → `available` → `activation_pending` → `activated` / `blocked` / `voided`.

Transições válidas num `src/lib/plateStateMachine.ts` (objeto `{from: [to...]}`),
qualquer transição inválida joga erro + não grava. Teste unitário cobre a tabela inteira.

---

## 5. Rota pública dinâmica `/r/[token]` (decisão arquitetural central — igual spec §5)

`src/app/r/[token]/page.tsx` (server component) + `src/app/api/r/[token]/route.ts`
pro registro de evento (fire-and-forget).

1. Resolve `public_token` → `toqy_plate_units` (service_role, ignora RLS).
2. Não existe → 404 "placa não encontrada" (tela segura, sem vazar nada).
3. `status = available_for_activation` (não ativada) → renderiza **tela de ativação**:
   "Esta placa ainda não foi ativada" + botão "Ativar placa" → `/app/placas/ativar?token=...`
   (exige login + código de ativação; **nunca** ativa só por escanear).
4. `status in (suspended, cancelled)` → tela "placa temporariamente indisponível".
5. `status = activated` → lê `toqy_plate_destinations` onde `is_active = true` →
   grava `scan_event` (`redirect`) → `redirect(destination_url, 302)`.
6. **Nunca open redirect**: destino só pode ser uma URL que está gravada em
   `toqy_plate_destinations` pra aquela unit E validada (`https://` obrigatório,
   host allowlist opcional: `google.com`, `search.google.com`, `g.page`, `maps.app.goo.gl`).

`public_token`: `crypto.randomBytes(16)` → base32 (26 chars, sem `0/O/1/l`). Nunca o `id` sequencial.

---

## 6. Camadas de integração externa (abstração + modo dev seguro)

### `src/lib/plate/paymentProvider.ts`
```
interface PaymentProvider {
  createCheckout(order): Promise<{ checkoutUrl | clientToken, providerOrderId }>
  parseWebhook(req): Promise<{ providerOrderId, status, raw } | null>  // valida assinatura
}
```
- Impl real: `appmaxProvider.ts` (quando `APPMAX_API_KEY` setada).
- Impl dev: `mockPaymentProvider.ts` — cria pedido, marca `paid` via botão "simular pagamento" no admin. Ativo quando a env não está setada.
- Webhook: `src/app/api/plate/webhook/route.ts` — **idempotente** (checa `provider_order_id` + `payment_status` antes de aplicar), valida assinatura, só gera o lote definitivo (`generate_plate_batch`) DEPOIS de `paid` confirmado. Loga toda tentativa em `toqy_plate_audit_log`.

### `src/lib/plate/googleBusinessProvider.ts`
```
interface GoogleBusinessProvider {
  search(query): Promise<Array<{ placeId, name, category, address, rating, reviewCount }>>
  getReviewUrl(placeId): Promise<string>   // monta search.google.com/local/writereview?placeid=X
}
```
- Impl real: Google Places API (Text Search + Place Details). Chave **só no backend** (`GOOGLE_PLACES_API_KEY`), nunca no bundle.
- Impl dev/fallback: retorna `[]` → frontend cai no "colar link manual".
- Custo documentado: Places Text Search ~US$32/1000, Place Details ~US$17/1000. Rate limit + cache de 24h por query no backend.

### E-mail: reusa Resend (`src/lib/htmlEscape.ts` + padrão de `api/lead/route.ts`).
### WhatsApp/IG: **não** neste módulo.

---

## 7. Telas (mobile-first, wizard estilo AvaliaCard)

**Públicas:**
1. `/placas` — landing. Hero "Aproximou. Clicou. Avaliou." + 2 CTAs: "Comprar pro meu negócio" / "Comprar em lote e revender".
2. `/placas/comprar` — wizard Caminho A (barra de progresso, 1 decisão por etapa, respostas salvas em `localStorage` + retomável):
   busca do negócio no Google → confirma → escolhe produto físico → escolhe tecnologia (QR/NFC/ambos) → arte (padrão ou upload de logo) → prévia → dados de contato → endereço → resumo → checkout (appmax) → confirmação.
3. `/placas/revenda` — wizard Caminho B: escolhe lote (10/20/100/1000) → arte de lote → dados → endereço → resumo → checkout → confirmação.
4. `/r/[token]` — redirect ou tela de ativação (§5).

**Painel do comprador/revendedor (`/app/placas`):**
5. Visão geral — total de placas, disponíveis, ativadas, bloqueadas, % ativação, últimos pedidos/ativações.
6. Minhas placas — tabela: código parcial, apelido, status, negócio vinculado, ativação, último acesso. Ações: ativar, ver, editar destino, suspender, copiar link `/r/token`, baixar QR (PNG via `qrcode.react` → canvas).
7. Meus lotes — código, data, qtd total/ativada/disponível, download da relação de códigos (PDF), download do manual.
8. Empresas atendidas — nome, link de avaliação, placa, ativação, status.
9. `/app/placas/ativar` — fluxo de ativação: cola código → valida (rate-limited) → busca/cadastra negócio final → confirma link Google → logo/nome/whats opcional → prévia → confirma.
10. Materiais de apoio — só operacional (manual de ativação, como achar link do Google, como posicionar, como testar QR/NFC, regras da marca).

**Painel admin (`/app/admin/placas`, gate `is_admin`):**
11. Pedidos — lista com filtro por `order_type` (própria empresa × revenda), status. Cada pedido: dados, itens, endereço snapshot, arte, transições de estado.
12. Lotes — geração (transacional, botão só habilita com pagamento `paid`), consulta.
13. Placas/unidades — consulta por serial/token parcial, status, ativação.
14. Artes pendentes — aprovar / pedir revisão / rejeitar (com nota).
15. Produção — mover pedido pelos estados (`processing` → `manufacturing` → `ready_to_ship` → `shipped` com código de rastreio opcional).
16. Empresas finais, ativações, auditoria (read-only), produtos/preços/estoque.

---

## 8. Métricas (§16 da spec)

Tabela `toqy_plate_scan_events` + um `toqy_plate_funnel_events` leve pra:
landing view, clique compra individual, clique revenda, busca empresa, empresa
selecionada, produto selecionado, checkout iniciado, pagamento aprovado, lote
visto, código ativado, QR escaneado, redirect. Visão admin de conversão por etapa,
sem PII além do necessário. Pode reusar o padrão de `toqy_analytics_events` que já existe.

---

## 9. Segurança (§14 — obrigatório)

- Autorização no backend em **toda** leitura/edição/ativação (RLS + checagem por dono na rota).
- `activation_code_hash` (nunca texto puro). `public_token` não-sequencial.
- Rate limit na ativação (`checkRateLimit` já existe): X tentativas/IP+token/hora, bloqueio temporário após excesso, `toqy_plate_units.status = blocked` após N inválidas.
- Redirect público: só destino cadastrado + validado, só `https://`, allowlist de host. **Sem open redirect.**
- Upload de arte/logo: reusa o endurecimento já feito (`api/upload-image`, magic bytes, limite de tamanho/tipo, nome gerado no servidor).
- Isolamento entre revendedores via RLS (`owner_profile_id = auth.uid()`).
- Webhook idempotente + assinatura verificada.
- `toqy_plate_audit_log` em toda transição.
- Não expor PII na rota pública `/r/[token]`.

---

## 10. Env vars novas (documentar no `.env.example`)

```
# Pagamento — módulo de placas (produto físico). Sem isso, usa mock (admin
# marca pago manualmente). Provedor recomendado: appmax.
APPMAX_API_KEY=
APPMAX_WEBHOOK_SECRET=

# Google Places — busca do negócio no fluxo de compra. Sem isso, o fluxo
# cai no "colar link de avaliação manualmente". Chave SÓ backend.
GOOGLE_PLACES_API_KEY=
```

---

## 11. Decisões fechadas (2026-09-10, respostas do Leonardo)

1. **Código de lote**: `LOTE-` + 8 chars base32 aleatórios (ex `LOTE-7K2M9QX4`).
   **Não** sequencial global (na escala de 1M não dá pra coordenar/travar, e
   sequencial deixa adivinhar o próximo). `internal_serial` da unidade =
   sequencial DENTRO do lote (`0001`, `0002`...) só pro numerinho impresso no
   canto da peça (mesmo padrão do `toqy_qr_codes.seq_number` que já existe).
   `public_token` = 16 bytes aleatórios base32, sempre.
2. **Menu**: "Placas & avaliações" **sempre visível** pra todo mundo no `/app`.
3. **Preços**: definidos DEPOIS pelo Leonardo, editáveis no admin
   (`toqy_plate_product_types.unit_price`). Nada hardcoded. Wizard lê do catálogo.
4. **Catálogo inicial — 3 produtos**, todos só pra avaliação Google, arte padrão,
   sem logo/nome de empresa:
   - `business_card` — Cartão de visita
   - `square_10` — Plaquinha quadrada 10x10 (adesiva)
   - `l_stand_10x15` — Plaquinha 10x15 em L
   Todos `technology = qr_nfc`.
5. **Arte**: SEMPRE padrão. Cliente **só escolhe o formato**, não escolhe arte,
   não envia logo. → **Corta do MVP**: tabela `toqy_plate_artworks`, etapa de
   arte no wizard, aprovação de arte no admin. A arte física é feita pelo
   Leonardo fora do sistema.
6. **Fulfillment** (define o comportamento de ativação):
   - **Individual (pra ele mesmo)**: a placa já sai **configurada**. No pedido a
     gente já tem o negócio (busca Google) → cria a unidade + `public_token` +
     grava a `destination` = URL de avaliação do Google → unidade nasce
     `activated`. Sem etapa de ativação separada. Leonardo grava o NFC na
     produção com `toqy.com.br/r/{token}`, QR impresso com o mesmo link.
   - **Revenda (lote)**: QR e chip **vazios**. Unidades nascem
     `available_for_activation`, com `public_token` + `activation_code`, **sem
     destino**. O revendedor ativa cada uma pelo `/app/placas/ativar` (cola
     código → escolhe/cadastra negócio → confirma link Google). O chip físico
     vai em branco — Leonardo manda um cartãozinho com os **códigos de
     ativação** + tutorial de como gravar o NFC com o app "NFC Tools". O link
     `toqy.com.br/r/{token}` de cada unidade o revendedor pega no próprio
     painel (`Meus lotes` → baixar relação, ou depois de ativar aparece na tela
     "grave este link no chip") — não vai em papel solto.

### Impacto das decisões no escopo (o que sai)

- **Sai**: `toqy_plate_artworks`, etapa de arte, aprovação de arte no admin,
  cálculo de frete, telas de upsell do AvaliaCard ("quantas avaliações quer",
  "projeção de crescimento" — fluff de marketing, não pedido).
- **Wizard individual fica enxuto**: buscar negócio Google → confirmar → escolher
  formato → contato → endereço → resumo → pagar → pronto (já configurado).
- Sistema de ativação só é exercido no fluxo de **revenda**.

---

## 12. Fases (GSD — projeto próprio, não misturar com bugfix de biosite)

Vira uma milestone própria no `.planning/ROADMAP.md` (ex: Phase 13 — Módulo Placas).

| Fase | Entrega | Dep. externa |
|---|---|---|
| **1 — Fundação** ✅ | migration (11 tabelas + `generate_plate_batch` + seed), `stateMachine.ts`/`tokens.ts` + 13 testes, nav `/app/placas`, landing `/placas` + `/placas/comprar`+`/placas/revenda` (placeholder), banner `/app/qr`, faixa na home, `/api/plate/products` + `/api/plate/funnel`. Commits c0fa924, 98392dc, e4e69d0. | Nenhuma — **feito 2026-09-10** |
| **2 — Compra individual** | wizard `/placas/comprar`, `GoogleBusinessProvider` (real + fallback), seleção de produto, arte (upload+prévia), endereço, `PaymentProvider` (mock + appmax), pedido no admin | appmax + Google (mock cobre dev) |
| **3 — QR dinâmico** ✅ | rota `/r/[token]` (force-dynamic), redirect 307 pro Google, tela de ativação, `scan_events`, `isSafePlateDestination` (só https + host Google/Toqy, anti open-redirect). Commit 49b15d9. | Nenhuma — **feito 2026-09-10** |
| **4 — Revenda** | dashboard `/app/placas` de verdade, fluxo de ativação `/app/placas/ativar` (cola código → nº negócio → confirma Google), empresas atendidas, export PDF de códigos + manual. `generate_plate_batch` já existe (Fase 1). | Nenhuma — **próxima** |
| **5 — Operação** | aprovação de arte, estados de produção, rastreio, notificação por e-mail (Resend), relatórios admin | Nenhuma |
| **6 — Segurança & qualidade** | 19 testes da spec §17, rate limit fino, auditoria completa, revisão de permissões, verificação manual do fluxo E2E | Nenhuma |

Cada fase = `tsc` + `lint` (mesmo baseline) + `test` + `build` limpos, commit direto na master, sem quebrar biosite.

---

## 13. O que fica mock / pendente até o Leonardo configurar

| Item | Estado sem config | Config necessária |
|---|---|---|
| Pagamento | `mockPaymentProvider` — admin marca pago no painel | `APPMAX_API_KEY` + webhook cadastrado na appmax |
| Google Places | fluxo cai em "colar link manual" | `GOOGLE_PLACES_API_KEY` + billing no Google Cloud |
| Rastreio de envio | campo livre no admin (colar código dos Correios manual) | nada (é manual mesmo) |
| WhatsApp/IG automático | não existe neste módulo | projeto separado de automação de marketing |

---

## 14. Riscos

- **Escopo grande** — 12 tabelas, ~16 telas, 19 testes. É semanas. Fazer fase a fase, cada uma verificável, sem "big bang".
- **Pagamento de físico ≠ Kiwify** — appmax tem antifraude/análise manual; pedido pode ficar "em análise" horas. Estado `pending_payment` tem que segurar isso sem gerar lote.
- **Google Places custo** — sem cache/rate-limit, uma busca com debounce mal feito queima crédito rápido. Cache 24h + debounce 500ms + limite por IP.
- **Colisão conceitual com `toqy_qr_codes`** — são coisas diferentes (QR avulso pra NFC do Pix × placa de avaliação). Manter separado, sem "unificar" agora.
- **Reimpressão** — o valor do QR dinâmico é o cliente trocar o link do Google sem reimprimir. Testar E2E esse cenário exato (spec §17 pede) antes de considerar pronto.

---

## 15. Fase 1 — Fundação (detalhe, sem dependência externa)

Ordem de implementação. Cada passo = commit próprio, `tsc`/`lint`/`test`/`build` limpos.

### 1.1 — Migration `supabase/migrations/2026-09-XX_plate_module_foundation.sql`
Cria (schema do §3, menos `toqy_plate_artworks`):
`toqy_plate_product_types`, `toqy_plate_orders`, `toqy_plate_order_items`,
`toqy_plate_batches`, `toqy_plate_units`, `toqy_plate_businesses`,
`toqy_plate_destinations`, `toqy_plate_activations`, `toqy_plate_scan_events`,
`toqy_plate_funnel_events`, `toqy_plate_audit_log`.
- Todas com RLS ligado + GRANT explícito (`anon`/`authenticated`/`service_role`
  conforme o caso — este projeto não tem grant automático).
- Política por dono (`owner_profile_id = auth.uid()`) onde aplica.
- `toqy_plate_product_types`: leitura pública só `active = true`.
- Função `generate_plate_batch(p_order_id uuid, p_quantity int)` transacional,
  `gen_random_bytes` + loop anti-colisão, idempotente por `order_id`.
- Trigger de auditoria em `toqy_plate_orders`/`toqy_plate_units` (status change → `toqy_plate_audit_log`).
- Seed dos 3 produtos (§11.4) com `unit_price = 0` (Leonardo ajusta no admin depois).

### 1.2 — Tipos + state machine
- `src/lib/plate/types.ts` — todos os tipos TS das entidades.
- `src/lib/plate/stateMachine.ts` — `PLATE_UNIT_TRANSITIONS`, `PLATE_ORDER_TRANSITIONS`,
  `ACTIVATION_CODE_TRANSITIONS` (objetos `{from: [to]}`) + `canTransition(kind, from, to)`.
- `src/lib/plate/tokens.ts` — `newPublicToken()` (16 bytes → base32 sem 0/O/1/l),
  `newActivationCode()` (8 chars legível), `hashActivationCode()` / `verifyActivationCode()`.
- `src/lib/plate/stateMachine.test.ts` — cobre a tabela de transições inteira + tokens.

### 1.3 — Navegação
- `DashboardShell.tsx` — novo item "Placas & avaliações" → `/app/placas` (sempre visível).
- `src/app/app/placas/page.tsx` — shell vazio ("em breve" / visão geral zerada).

### 1.4 — Landing pública
- `src/app/placas/page.tsx` — landing própria. Hero "Aproximou. Clicou. Avaliou.",
  2 CTAs: `/placas/comprar` e `/placas/revenda` (rotas ainda 404/placeholder nesta fase).
  Identidade visual própria mas usando os tokens de tema do Toqy (não quebra a marca).
- `src/app/page.tsx` (home do Toqy) — 1 seção nova com CTA → `/placas`.
- `src/app/app/qr/page.tsx` — 1 banner no topo: "Quer o fornecedor de placas prontas? Clique aqui" → `/placas`.
- `src/app/api/plate/funnel/route.ts` — registra `landing_view` etc. em `toqy_plate_funnel_events`.

### 1.5 — Catálogo (leitura)
- `src/lib/plate/catalog.ts` — `getPlateProducts()` (rota pública, cache curto).
- `src/app/api/plate/products/route.ts` — GET lista de produtos ativos.

**Entregável da Fase 1**: navegação separada existe, landing no ar, catálogo com 3
produtos, todo o schema + state machine + tokens testados. Nada de pagamento, nada
de Google ainda. Biosites intactos.

## 16. Próximo passo

Leonardo aprova a Fase 1 (§15) → começo pela migration `1.1`. Schema é decisão de
estrutura de dados — **não avanço sem o ok explícito**.
