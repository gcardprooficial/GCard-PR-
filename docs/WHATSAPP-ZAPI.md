# WhatsApp no GCard com Z-API (guia atual)

Painel: `/painel/whatsapp` — **Conversas**, **Fluxos** (estilo n8n), **Respostas automáticas**, **IA e conhecimento**.
Este guia substitui o `WHATSAPP.md` (que descrevia só a API oficial da Meta).

## Como o bot decide (ordem)

1. Equipe assumiu a conversa (`Atendente`)? Bot fica quieto até "Devolver ao bot". Se você responder pelo celular, a conversa também vira `Atendente` sozinha.
2. Cliente estava num fluxo (escolheu uma opção / respondeu pergunta / mandou CEP)? Continua o fluxo.
3. Áudio/imagem: fluxo com esse gatilho; sem fluxo, passa pra equipe.
4. Pediu "atendente / humano / vendedor": passa pra equipe.
5. Mandou um CEP: calcula o prazo saindo de Indaiatuba/SP (cotação real do Melhor Envio; **nunca mostra preço de frete**).
6. Fluxo com gatilho de palavra-chave ou botão.
7. Resposta automática por palavra-chave (Valores, Modelos, Prazo, Confiabilidade, QR, NFC).
8. Fluxo de primeira mensagem / "qualquer texto" (o menu inicial é este).
9. IA responde só com o catálogo ao vivo + fatos da empresa + respostas que a equipe ensinou. Não sabe = chama a equipe.

Preço e modelos nunca ficam fixos no texto: `{{precos}}` e `{{modelos}}` são preenchidos do banco na hora do envio.

## Conectar o número

1. Rode no Supabase (SQL Editor), nesta ordem: `20261002000000_whatsapp_inbox.sql` e depois `20261002010000_whatsapp_v2_etiquetas.sql` (textos curtos, menu novo e etiquetas; já importa todos os clientes do site).
2. Na Z-API crie uma **instância nova** pro número da GCard e leia o QR Code (WhatsApp → Aparelhos conectados).
3. Pegue na instância: **ID da instância** → `ZAPI_INSTANCE_ID`, **Token** → `ZAPI_TOKEN`, e o **Token de segurança da conta** → `ZAPI_CLIENT_TOKEN`.
4. Invente uma senha longa qualquer → `ZAPI_WEBHOOK_SECRET`.
5. Na instância, aba **Webhooks e configurações**:
   - **Ao receber** → `https://www.gcardpro.com.br/api/webhooks/zapi?secret=SUA_SENHA_DO_PASSO_4`
   - Ligue **Notificar as enviadas por mim**: quando você responder pelo celular, o bot cala naquela conversa.
6. Vercel → Environment Variables: `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY` (IA) e, opcional, `ADMIN_NOTIFY_EMAIL` (e-mail quando uma conversa pedir atendente). Redeploy.
7. De outro celular, mande "Oi vim pelo site" pro número: a conversa aparece em `/painel/whatsapp`.

## Etiquetas de contato (aba "Contatos e etiquetas")

Automáticas, calculadas dos pedidos do site e das conversas: **Cliente**, **Cliente recorrente**, **Revenda**, **Aguardando pagamento** (pedido há menos de 2 h), **Parou no pagamento**, **Pagamento falhou**, **Cliente inativo (90d+)**, **Lead**, **Parou de responder** (48 h sem resposta) e **Falou no WhatsApp**. O número é casado pelo DDD + últimos 8 dígitos, então funciona mesmo quando o WhatsApp omite o 9º dígito. Atualiza todo dia (cron), quando alguém novo chama e no botão "Sincronizar". Etiquetas manuais (com contorno) nunca são apagadas.

## Botões e fotos

- Por padrão os botões dos fluxos viram lista numerada. Pra testar botões nativos da Z-API, crie `ZAPI_NATIVE_BUTTONS=true` na Vercel e redeploy (se não aparecerem no celular do cliente, apague a variável).
- "Modelos" manda uma foto de cada produto com nome e preço (fotos em `public/wa/`, servidas pelo site).

## Cuidados

- Botão nativo é instável na Z-API: os botões dos fluxos viram **lista numerada** ("1 - Valores, 2 - Modelos…") e o cliente responde o número ou o nome.
- Z-API não é canal oficial do WhatsApp. Só responda quem chamou (o sistema já faz isso) e não dispare mensagem em massa. O freio anti-loop passa a conversa pra equipe se o bot responder 25 vezes em 10 min.
- Áudio: `.ogg` (opus), `.mp3`, `.m4a`, `.aac` ou `.amr`. `.webm`/`.wav` não funcionam.
- Se a Z-API mandar um formato que o sistema não reconheça, o erro aparece no log da Vercel (`Erro no webhook da Z-API`).

## Avisos de pedido por WhatsApp (espelho dos e-mails)

Tudo que o cliente recebe por e-mail também vai por WhatsApp, no mesmo momento, com as mesmas informações e links: pedido recebido, link/lembrete de pagamento, pagamento confirmado, lote pronto (código do lote + códigos das placas), em produção, enviado (transportadora, rastreio e link) e entregue (com o convite do vídeo no Instagram). O link de pagamento enviado à mão pelo painel também vai pelo WhatsApp.

Só funciona com Z-API (na API oficial da Meta aviso proativo exige template aprovado). Regras que protegem o número:
- 1 aviso por pedido + evento (o botão de reenviar do painel força o reenvio);
- só pra quem informou telefone no checkout, e só se o número tiver WhatsApp (a Z-API confere antes);
- limite de 80 avisos por dia (`WA_NOTIFY_DAILY_CAP` muda o valor);
- quem responder **PARAR** recebe a etiqueta "Sem avisos" e nunca mais recebe (os e-mails continuam);
- o resultado de cada aviso (enviado, pulado e por quê, falhou) fica na tabela `wa_order_notifications`.

Se o cliente responder o aviso, a conversa aparece normalmente no painel.

## Pesquisa "por onde chegou até nós"

Fluxo "Pesquisa de origem (manual)": lista numerada (Instagram, YouTube, Google / Site, Indicação de amigo/parceiro, ChatGPT / Inteligência Artificial, Outro). A resposta (número ou nome) vira a etiqueta **Origem: …** no contato e o cliente recebe o agradecimento. Dispara quando você clica **Perguntar origem** na conversa e automaticamente ao clicar **Resolver** (se o contato ainda não tem origem). Dá pra editar as opções e o texto na aba **Fluxos**.

## Alternativa: API oficial da Meta

Usada só se `ZAPI_INSTANCE_ID` **não** estiver definida (veja `WHATSAPP.md`).
