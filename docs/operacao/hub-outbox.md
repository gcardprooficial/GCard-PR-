# Outbox de eventos para o hub (contrato v1)

O GCard empurra eventos assinados ao hub (`POST /api/ingest/gcard`). **Desligado por padrão**: com `HUB_OUTBOX_ENABLED` desligado o outbox só acumula e nada é enviado.

## Como funciona
1. Todo evento novo em `public.events` (e todo registro em `public.consent_records`) gera, por gatilho, uma linha em `public.hub_outbox` com o envelope do contrato. O gatilho engole qualquer erro: **nunca** impede o evento, o cadastro, o consentimento nem o descadastro.
2. A rota `GET /api/cron/hub-outbox` (cabeçalho `Authorization: Bearer $CRON_SECRET`) retira até 50 itens vencidos (`FOR UPDATE SKIP LOCKED`, com aluguel de 5 min), assina (HMAC-SHA256 de `"<timestamp>.<corpo>"`) e envia, com timeout de 10 s e 5 envios em paralelo.
3. Resultado: 200/202 → `enviado`; 400/401/404/413/422 (e qualquer outro 4xx) → `morto` + alerta no Sentry; 429, 5xx, rede e tempo esgotado → nova tentativa em 1 min, 5 min, 30 min, 2 h, 12 h; na 8ª falha → `morto` + alerta.
4. `consentimento_revogado` tem prioridade 10: sai antes dos demais, e se ficar `morto` o alerta diz "REVOGAÇÃO DE CONSENTIMENTO".
5. Sem PII em log: só tipo do evento e código de erro (`http_500`, `rede`, `timeout`).

## Ligar (nesta ordem)
1. Rodar a migração `supabase/migrations/20261018000000_hub_outbox.sql`.
2. Rodar `docs/operacao/teste-hub-outbox.sql` (termina em ROLLBACK): todas as linhas `ok = true`.
3. Vercel → variáveis (só servidor): `HUB_INGEST_URL` (`https://<hub>/api/ingest/gcard`), `HUB_INGEST_SECRET` (32+ caracteres, o mesmo do `HUB_SECRET_GCARD` do hub) e `HUB_OUTBOX_ENABLED=true`. Redeploy.
4. Agendar a rota a cada minuto (abaixo).

## Agendador (pg_cron + pg_net, a cada minuto)
O cron da Vercel do projeto é diário; para ficar perto de tempo real usamos o banco chamando a rota. Habilite as extensões `pg_cron`, `pg_net` e `supabase_vault` (Supabase → Database → Extensions).

**1) Guarde o `CRON_SECRET` no Vault** (nome `gcard_cron_secret`). Prefira pela tela: Supabase → Integrations → Vault → *Add new secret*, nome `gcard_cron_secret`; assim o segredo não passa pelo histórico do SQL Editor. Se for por SQL, troque o texto no próprio editor (nunca em chat nem em commit) e depois apague o snippet do histórico:

```sql
select vault.create_secret('COLE_AQUI_O_CRON_SECRET', 'gcard_cron_secret', 'CRON_SECRET do GCard para o agendador do outbox');
```

**2) Agende lendo o segredo do Vault** (o comando agendado não contém o segredo em texto):

```sql
select cron.schedule('hub-outbox', '* * * * *', $$
  select net.http_get(
    url := 'https://www.gcardpro.com.br/api/cron/hub-outbox',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'gcard_cron_secret')
    ),
    timeout_milliseconds := 55000
  );
$$);
```
Parar: `select cron.unschedule('hub-outbox');`
Trocar o segredo depois: `select vault.update_secret((select id from vault.secrets where name = 'gcard_cron_secret'), 'NOVO_VALOR');` (e o mesmo valor na Vercel).
Conferir (sem mostrar o segredo): `select name, length(decrypted_secret) as tamanho from vault.decrypted_secrets where name = 'gcard_cron_secret';`

**Custo e cuidados:** as extensões não têm custo extra no Supabase (não verificado no seu plano). Cada minuto é 1 chamada à Vercel: cerca de 1.440 por dia, 43 mil por mês; com o outbox desligado a chamada responde na hora. Com o Vault, o segredo **não** fica em texto na tabela `cron.job` (o comando só consulta o Vault na hora de chamar). Ele continua sendo o mesmo `CRON_SECRET` da Vercel; trocar um exige trocar o outro.

## Reverter
```sql
select cron.unschedule('hub-outbox');
DROP TRIGGER IF EXISTS hub_outbox_events_trg ON public.events;
DROP TRIGGER IF EXISTS hub_outbox_consent_trg ON public.consent_records;
DROP FUNCTION IF EXISTS public.hub_outbox_from_events();
DROP FUNCTION IF EXISTS public.hub_outbox_from_consent();
DROP FUNCTION IF EXISTS public.hub_outbox_claim(INTEGER);
DROP TABLE IF EXISTS public.hub_outbox;
```
Só desligar o envio, sem reverter: `HUB_OUTBOX_ENABLED=false` (o outbox continua acumulando).

## Decisões que fogem do texto do pedido (para você confirmar)
1. **`produto_visto` de visitante anônimo não entra no outbox** (nem como `sem_email`). É o evento mais frequente e nunca seria enviado; guardá-lo só incharia a tabela. Os demais sem e-mail entram como `sem_email`.
2. **`event_id` do consentimento** é `gcard:consent:<id do registro>` (o contrato só define `gcard:<id do evento>`).
3. **Consentimento:** `consentimento_dado` sai para `accepted = true` em qualquer origem. `consentimento_revogado` sai **somente** com `accepted = false` **e** `source = 'sair'` (descadastro). `accepted = false` vindo de cadastro, checkout ou gerador é só caixa não marcada: **não enfileira nenhum evento**.
4. **`person.phone` e `person.name` não são enviados** (minimização); o CSV de Clientes cobre.
5. **`context.origin`** leva só as 5 chaves do contrato (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `ref`); `landing`, `referrer_host` e `ts` ficam de fora.
6. **`pedido_pago` ganhou `order_number`** (o evento do banco não o trazia; o gatilho completa a partir do pedido).
7. **`qr_baixado`** leva só `slug` (hoje o evento não traz `slug`, então vai com `data` vazio).
8. Coluna extra `priority` e função `hub_outbox_claim` (aluguel de 5 min) no outbox.

## Riscos
- A tabela `hub_outbox` cresce (um item por evento). Itens `enviado` antigos podem ser apagados depois (ex.: mais de 90 dias); não incluído agora.
- O alerta de item `morto` depende do Sentry estar ligado (`VITE_SENTRY_DSN`); sem ele só sai no log do servidor.
- Hub fora do ar por muito tempo: itens viram `morto` depois da 8ª falha (cerca de 1 dia e meio). Para reenfileirar: `update public.hub_outbox set status='pendente', attempts=0, next_attempt_at=now() where status='morto';`

## Perguntas do pedido
- **Há caminho que insere em `events` sem passar por `track_event`?** Não. O único `INSERT INTO public.events` do código e das migrações está dentro de `track_event()`; os gatilhos de pedido, placa, cadastro e confirmação e o servidor (`trackEvent`) chamam essa função. O consentimento tem 3 caminhos de escrita (cadastro por gatilho, `upsertCustomerConsent`, descadastro), todos inserindo em `consent_records`, que tem o próprio gatilho.
- **Qual agendador e custo?** `pg_cron` + `pg_net` a cada minuto (acima).
- **`marketing_contacts`, `consent_records` e `consent_texts` estão em produção?** Há evidência de que sim (consentimentos gravados em 15/10 e a tela Clientes lendo descadastros sem erro), mas confirme com `select to_regclass('public.marketing_contacts') is not null, to_regclass('public.consent_records') is not null, to_regclass('public.consent_texts') is not null;`

---

# Carga diária de contas e eventos de suporte

## Carga diária de contas (`POST /api/sync/gcard`)
- Roda dentro do cron diário existente (`/api/cron/daily`), **depois** de tudo o que ele já faz, e **não pode derrubá-lo** (erro é capturado).
- Lê `people_summary()` e envia em lotes de até 300 (`{ "records": [...] }`), assinando com a **mesma função e o mesmo segredo** do outbox (`X-Hub-Timestamp`, `X-Hub-Signature`). O endereço sai do `HUB_INGEST_URL` (origem do hub + `/api/sync/gcard`).
- Colunas (e-mail obrigatório; vazio vai `null`): `email`, `nome`, `celular` (só dígitos), `origem`, `primeiro_contato`, `pedidos`, `pedidos_pagos`, `total_pago_reais`, `ultimo_pagamento`, `codigos_ativados`, `tem_conta`, `email_confirmado`, `aceite_em`, `descadastrado_em`. Nunca CPF, CNPJ, senha, token, endereço ou pagamento.
- Respostas: 200 aplicado; **429** espera (5 s, depois 20 s, ou o `Retry-After`) e repete o mesmo lote, no máximo 2 vezes; **401, 413, 422** (e outros 4xx) param a execução e alertam, sem reenviar; **5xx e rede** param e tentam de novo no dia seguinte. O hub soma e nunca apaga.
- **Interruptor `HUB_SYNC_ENABLED`** (padrão desligado). É a **única variável nova** (o segredo e o endereço são os do outbox). Existe para a carga completa **não rodar antes** de você conferir o teste.
- **Teste:** Painel → Integrações → **Hub** → *Testar envio (2 contas fictícias)* (`teste-sync-gcard-1@example.com` e `-2@`). Esperado: "Hub respondeu ok: 2 linha(s)". Funciona mesmo com a carga diária desligada.
- Log só com contagens (`registros`, `lotes`, `aplicados`, `linhas`, `parou`); sem e-mail e sem corpo. Se parar por erro, vai ao Sentry.

## Eventos de suporte (`suporte_mensagem`, `suporte_resposta`)
- Migração `20261019000000_hub_suporte_eventos.sql`: gatilhos em `wa_messages` (WhatsApp) e `chat_messages` (chat do site, se a tabela existir), pelo mesmo outbox.
- `suporte_mensagem`: mensagem de **texto** de cliente **identificado**; `data: { conversa, texto (até 300), canal }`. `suporte_resposta`: resposta **humana** da equipe; `data: { conversa }`.
- `event_id` = `gcard:suporte:<id da mensagem>` (determinístico, sem duplicar).
- **Nunca** entram: visitante/contato sem e-mail, anexos (áudio, imagem), respostas do bot.
- **Identificação no WhatsApp:** o e-mail vem de `wa_contacts` (ligado pelo telefone ao pedido). Quem ainda não comprou não tem e-mail e não gera evento.
- **Proteção do texto:** números longos (9+ dígitos com pontos, traços ou espaços: CPF, cartão, telefone, data completa) são trocados por `[número removido]` antes de cortar em 300 caracteres.
- **`canal`:** `whatsapp` para o WhatsApp e `chat` para o chat do site. Os eventos do pedido citam só `"chat"`; **confirme na seção 7 do contrato do hub que `whatsapp` é aceito**, senão o hub responde 422 e o item vira `morto`.
- Reverter: ver o cabeçalho da migração.

## Decisões e riscos desta parte
1. `canal = "whatsapp"` para o WhatsApp (acima, a confirmar).
2. Redução de números longos no texto (não pedida, por privacidade).
3. A resposta de equipe só leva a conversa; resposta humana com anexo também gera `suporte_resposta` (sem conteúdo).
4. O `chat_messages` não tem nenhum código que escreva nele hoje (o suporte do site usa um widget externo); o gatilho fica pronto caso volte a ser usado.
5. O e-mail do WhatsApp pode estar desatualizado (último pedido daquele telefone).
6. Se o hub ainda não estiver pronto, deixe `HUB_OUTBOX_ENABLED` desligado: os eventos só acumulam.
