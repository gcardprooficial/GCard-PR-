# PR: personalizar placa (curso), origem, eventos e ligação com o TOQY

Branch: `feat/personalizar-curso` (base: `main`). **Não faça merge sem testar no preview.**

## O que entra

**Fase 1: placa para personalizar**
- `/ativar`: **Baixar QR** por código (SVG e PDF vetoriais, PNG 1200 px+, normal e espelhado, nível H, margem de 4 módulos, texto de ajuda). Só o dono do código (ou a equipe) baixa; limite de 30 downloads/10 min por usuário. O QR leva a `/r/<token>?s=q`, nunca ao destino final.
- Destino aceita **qualquer link https público** (decisão do dono), com proteções fixas: só https, sem usuário/senha, sem porta, sem IP/localhost/rede interna, sem `javascript:`/`data:`. **Uma única lista**, tabela `allowed_destination_hosts` (linha `*` = qualquer domínio; apagar essa linha volta a só Google/TOQY), lida por `/r`, `/ativar`, `painel.placas` e pelo gatilho SQL. Etiqueta "Página TOQY" e botão "Criar minha página no TOQY" (com UTM).
- **Acrílico liso com QR opcional:** na compra do acrílico liso aparece **"Quer o QR Code de cada placa?"** (Sim/Não, grátis). Quem marca Sim recebe **um código de QR por unidade**, emitido sozinho no pagamento (sempre códigos **novos**: nunca usa o estoque que você gera e imprime). O cliente entra em `/ativar`, baixa o QR e escolhe o link. Quem só quer placa (e chip) marca Não e nada é emitido. O **chip NFC continua vazio**: o cliente grava o link com o app NFC Tools usando o botão "Copiar URL NFC" do código.
- Admin: CSV de lote com `url_nfc` e `url_qr`; painel de placas mostra a etapa (Em estoque / Vendido / Ativado / Desativado) e as datas; ativar código **não vendido** é bloqueado no banco; tela **Denúncias** (desativar código).
- `/r`: **302 + no-store** (sem cache), página neutra para código inexistente, não ativado e desativado, link **Denunciar**.
- `/personalizar`: passo a passo, gabaritos 10x10 e 10x15 (SVG), checklist de teste. Linkada em `/produtos` e `/guia`.

**Correções pedidas**
- Descadastro: o link do e-mail (GET) **abre uma página de confirmação** (`/sair`); só o botão (POST) descadastra. Links antigos continuam valendo. Cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post` nos e-mails a clientes.
- Leituras: país por `x-vercel-ip-country` (com `cf-ipcountry` de reserva), **contagem atômica no banco** (RPC `plate_register_scan`), **robôs e pré-visualizações separados** (`bot_scan_count`), leituras únicas por dia, origem NFC (`?s=n`) × QR (`?s=q`).

**Fase 2 e parte da 3**
- Origem first-touch (cookie próprio 30 dias, `gcard_ft`) gravada na conta, no pedido e no lead; aparece no pedido do admin.
- Tabela `events` (9 tipos, idempotente por `dedupe_key`). Pagamento sai de **gatilhos no banco**, sem tocar na cobrança.
- Consentimento versionado (`consent_texts`, `consent_records`); caixa nunca marcada, no cadastro e no checkout; `/privacidade` e `/termos` atualizados.
- Cadastro: sugestão de correção de domínio, reenviar confirmação, "digitei o e-mail errado", bloqueio de conta com e-mail quase igual (ponto/`+` do Gmail).
- Gerador (`/gerador`): lead **ligado à conta**, origem `gerador`, "receber por e-mail" com aceite opcional (e-mail pelo Resend).
- Pessoas por e-mail (`people_summary`) e **dois CSV** em Clientes: marketing (só consentidos) e operacional (sem marketing e sem CPF).

## Migrações (nesta ordem; todas com `IF NOT EXISTS` / `CREATE OR REPLACE`, RLS ligada em tabela nova)

| # | Arquivo | O que muda | Como desfazer |
|---|---|---|---|
| 1 | `20261015000000_allowed_destination_hosts.sql` | tabela de hosts (Google e TOQY), função `is_allowed_destination`, gatilho do revendedor passa a ler a tabela | `DROP FUNCTION is_allowed_destination`; restaurar o gatilho de `20260915120000` |
| 2 | `20261015010000_plates_datas_scans_denuncias.sql` | colunas `sold_at`, `blocked_at`, `block_reason`, `bot_scan_count`, `tracking_v2` em `plates`; colunas em `plate_scan_events`; RPC `plate_register_scan`; view `plate_scan_daily`; tabela `abuse_reports`; gatilhos de data e de "não ativar sem vender" | `DROP` das colunas/gatilhos/RPC/tabela listados |
| 3 | `20261015020000_eventos_consentimento_origem.sql` | `first_touch` em orders/profiles/tool_leads; `tool_leads.user_id/email/email_consent_at`; tabelas `events`, `consent_texts`, `consent_records`; gatilhos em `orders`, `plates` e `auth.users` (novo `handle_new_user`, `handle_user_confirmed`); funções `track_event`, `similar_account_exists`, `people_summary` | `DROP` dos gatilhos/funções/tabelas; restaurar `handle_new_user` de `20260910184023` |
| 4 | `20261015030000_produtos_para_personalizar.sql` | (substituída pela 5) criou 2 produtos duplicados do acrílico liso | ver 5 |
| 5 | `20261015040000_remove_produtos_duplicados_personalizar.sql` | apaga os 2 produtos duplicados (ou os deixa ocultos se houver pedido) (a coluna `is_customizable` fica, até o código dispensá-la) | n/a |
| 6 | `20261015050000_destino_qualquer_link_https.sql` | linha `*` em `allowed_destination_hosts` e `is_allowed_destination` com as proteções fixas | `DELETE FROM allowed_destination_hosts WHERE host = '*'` |

**Ordem de publicação:** aplique as migrações **antes** de publicar o código deste PR. O `/r` tem plano B (se a tabela de hosts não existir, volta a aceitar só Google, então nenhum QR impresso quebra), mas o `/ativar` e o painel de placas leem colunas novas.

Teste primeiro numa **branch do Supabase** (ou cópia). Validei a **sintaxe** das 4 migrações com o parser do PostgreSQL (incluindo as 12 funções plpgsql), mas **não as executei**: o conector de Supabase não alcança este projeto.

Atenção a duas mudanças de comportamento no banco:
- **Ativar placa sem dono** (sem pedido e sem lote) passa a ser recusado para usuário logado (service role e SQL Editor passam).
- `handle_new_user` foi reescrito (mesmo perfil de antes + origem, evento e consentimento). O cadastro não pode quebrar: teste um cadastro novo no preview.

## Como testar no preview

1. **Código antigo:** abra um QR e um NFC já impressos: devem abrir o mesmo destino de antes.
2. **Trocar destino:** em `/ativar`, troque o link e escaneie de novo: vale na hora (302 com `no-store`).
3. **TOQY:** cole `https://toqy.com.br/b/algo` no destino: aceita e mostra "Página TOQY". `http://`, `javascript:`, `https://toqy.com.br.evil.com` e `https://google.com@evil.com`: recusados.
4. **QR baixado:** baixe SVG, PDF e PNG (normal e espelhado), imprima a 2,5 e 3 cm e leia em iPhone e Android. O espelhado, visto por trás do acrílico, lê normal.
5. **Leituras:** escaneie pelo QR novo (`?s=q`): aparece em "QR". Compartilhe o link no WhatsApp: a pré-visualização entra como robô e não soma.
6. **Código desativado/inexistente:** `/r/xyz` e um código bloqueado mostram a página neutra; "Denunciar" abre `/denunciar`; a denúncia aparece em Painel, Denúncias.
7. **Descadastro:** abra um link `/api/unsubscribe?token=...` de um e-mail: cai em `/sair` **sem descadastrar**; clique em "Sim": descadastra, sem login.
8. **Cadastro novo:** crie conta com a caixa de novidades marcada e outra desmarcada: confira em `consent_records` e em `events` (`conta_criada`), e o e-mail de confirmação.
9. **Webhook duplicado:** reenvie o mesmo webhook de pagamento: `events` não duplica `pedido_pago` (chave `pedido_pago:<pedido>`).
10. **CSV:** Clientes, "Exportar consentidos" só traz quem aceitou e não saiu; "Exportar pessoas (operacional)" não traz campos de marketing nem CPF. Usuário sem acesso de equipe não consegue chamar.
11. **QR opcional:** compre acrílico liso na revenda: com **Sim** em "Quer o QR Code?", após o pagamento os códigos aparecem em `/ativar` do cliente; com **Não**, nenhum código é criado. Os códigos são sempre criados novos, sem tocar no estoque impresso.
12. **Qualquer link:** em `/ativar`, cole `https://instagram.com/...` e um site qualquer: aceita; `http://` sobe para https; IP, `localhost`, `.local` e `javascript:` são recusados.

Verificação automatizada: `npx tsx scripts/check-fase1.ts` (destino, robôs, origem, QR com margem e espelhado, sugestão de e-mail, fim de semana/feriado).

## Cache e performance

- `/r/*`: **sem cache** (302, `no-store`). Não pus cache de 60 s no redirecionamento: ele prenderia o link antigo.
- Cache de borda só existe em `/` e `/guia*` (60 s) e não mudou. A home não faz chamada nova; o cookie de origem é gravado no cliente.
- `/r` agora faz 3 consultas (placa, hosts permitidos, registro da leitura em 1 RPC), antes eram 3 (placa, 2 escritas). Sem piora relevante; a lista de hosts é minúscula.
- `produtos/$slug` faz 1 chamada assíncrona (`produto_visto`) que não bloqueia a página.
- Não consegui rodar Lighthouse. Medir `/` e `/produtos` no preview antes do merge.

## Achados de segurança (somente leitura, nada corrigido)

0. **Destino livre = redirecionador aberto.** Aceitar qualquer link https faz o `/r` poder levar a golpes usando o seu domínio. Mitigação atual: denúncia + "Desativar código" + proteções fixas (sem IP/rede interna). Se virar problema, apague a linha `*` da tabela (volta a Google/TOQY) ou acrescente bloqueio de domínios.

1. **Links de pagamento por número de pedido:** `createPagarmeCardCheckout`, `createInfinitePayCheckout` e `createCheckoutPreference` recebem o **número do pedido (sequencial)** e não exigem login. A página da Stone/InfinitePay abre com **nome, e-mail, CPF e celular pré-preenchidos**. Quem varre os números de pedidos pendentes vê dados de outros clientes. Correção sugerida: usar o `id` (UUID) do pedido, ou um token curto assinado, no lugar do número.
2. **`checkReturningCustomer`** (público): responde se e-mail+CPF já compraram. Tem limite de requisições; baixo risco.
3. **Limite de requisições em memória por instância** (`rateLimit.ts`): na Vercel não é compartilhado. Vale para `/r`, download de QR, cadastro e denúncia. Trocar por Upstash/Redis antes de confiar para abuso.
4. **CPF no navegador da equipe:** o painel de pedidos lê `customer_document` no cliente (equipe, protegido por RLS). A regra "CPF nunca vai ao navegador" vale para visitantes; para a equipe é um débito.
5. **Painel de admin conferido no cliente** (`user_roles`) mais RLS. As 22 server functions de admin chamam a checagem de equipe **no servidor**; as 3 novas de usuário comum (`registerQrDownload`, `submitToolLead`, `emailReviewLink`) usam o cliente do usuário (RLS) ou o id da sessão. As 21 públicas são as de loja, pagamento, cupom, descadastro e catálogo (lista no relatório).
6. **RPCs `SECURITY DEFINER`:** as de administração conferem equipe/dono no corpo e têm `REVOKE ... FROM anon`. As novas (`track_event`, `plate_register_scan`, `similar_account_exists`) só executam como `service_role`. `has_role`/`is_team` aceitam um `uuid` qualquer e dizem se esse usuário é da equipe (vazamento mínimo).
7. **Tipos do Supabase defasados** (`integrations/supabase/types.ts` não tem colunas/tabelas novas): por isso o código novo usa `src/lib/db-untyped.ts`. Regenerar os tipos elimina o cast.
8. **`.mcp.json`** (não rastreado, não incluído): só aponta para o MCP do Supabase com `project_ref`; **não contém token**. Não está no `.gitignore`.
9. **RLS do banco vivo:** `docs/seguranca/rls-banco-vivo.sql` (somente leitura) lista tabelas, policies, grants, funções definer, gatilhos e views; compare com `docs/seguranca/rls-esperado-das-migracoes.md`.
10. **Sentry, lembrete de domínio e backup:** fora desta rodada.

## Pendências suas (`TODO_`)

- `TODO_LINKS_CANVA`: links dos modelos em `src/routes/personalizar.tsx`.
- Remetente do Resend (`RESEND_FROM`), hoje o padrão do projeto.
- `SCAN_HASH_SALT` na Vercel (texto aleatório longo; sem ele usa um padrão fixo).
- Feriado municipal de Indaiatuba (`EXTRA_HOLIDAYS` em `src/lib/business-hours.ts`).

## Funil por origem (consulta pronta; a tela de relatório fica para a Fase 4)

```sql
select coalesce(source, 'direto') as origem,
       count(*) filter (where type = 'produto_visto')       as viu_produto,
       count(*) filter (where type = 'conta_criada')        as contas,
       count(*) filter (where type = 'checkout_iniciado')   as checkouts,
       count(*) filter (where type = 'pagamento_iniciado')  as pagamentos_iniciados,
       count(*) filter (where type = 'pedido_pago')         as pagos
from public.events
where created_at >= now() - interval '30 days'
group by 1 order by pagos desc;
```

## Fora desta rodada

Fase 4 (tela única de admin e relatórios), restante da Fase 5 (testes automatizados de RLS, limite de requisições real, Sentry, aviso de domínio, backup) e a recorrência `gcard_plus`.
