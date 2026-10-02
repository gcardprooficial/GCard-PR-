# WhatsApp no GCard (caixa de entrada + fluxos + IA)

Painel: `/painel/whatsapp` — **Conversas**, **Fluxos** (estilo n8n), **Respostas automáticas**, **IA e conhecimento**.

## Como o bot decide (ordem)

1. Equipe assumiu a conversa (`Atendente`)? Bot fica quieto até "Devolver ao bot".
2. Cliente estava num fluxo (clicou botão / respondeu pergunta / mandou CEP)? Continua o fluxo.
3. Áudio/imagem: fluxo com esse gatilho; sem fluxo, passa pra equipe.
4. Pediu "atendente / humano / vendedor": passa pra equipe.
5. Mandou um CEP: calcula o prazo saindo de Indaiatuba/SP (cotação real do Melhor Envio; **nunca mostra preço de frete**).
6. Fluxo com gatilho de palavra-chave ou botão.
7. Resposta automática por palavra-chave (Valores, Modelos, Prazo, Confiabilidade, QR, NFC).
8. Fluxo de primeira mensagem / "qualquer texto" (o menu inicial com botões é este).
9. IA responde só com o catálogo ao vivo + fatos da empresa + respostas que a equipe ensinou. Não sabe = chama a equipe.

Preço e modelos nunca ficam fixos no texto: `{{precos}}` e `{{modelos}}` são preenchidos do banco na hora do envio.

## Conectar o número (API oficial da Meta)

1. Rode a migração `supabase/migrations/20261002000000_whatsapp_inbox.sql` no Supabase (SQL Editor).
2. Número: um chip/linha **dedicado** à API. Um número que está no app WhatsApp/WhatsApp Business comum precisa ser migrado e deixa de funcionar nele (a Meta tem um modo de coexistência, mas confira a disponibilidade pro seu número antes de depender dele).
3. Em <https://business.facebook.com> crie/abra a conta comercial e verifique a empresa (CNPJ 68.194.199/0001-70).
4. Em <https://developers.facebook.com> crie um app tipo **Business**, adicione o produto **WhatsApp** e cadastre o número (código por SMS/ligação).
5. Pegue:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Token permanente** (Business Settings → System Users → gerar token com `whatsapp_business_messaging` e `whatsapp_business_management`) → `WHATSAPP_TOKEN`
   - **App Secret** (App → Settings → Basic) → `WHATSAPP_APP_SECRET`
6. Invente um texto qualquer como `WHATSAPP_VERIFY_TOKEN`.
7. No app → WhatsApp → Configuration → Webhook:
   - Callback URL: `https://www.gcardpro.com.br/api/webhooks/whatsapp`
   - Verify token: o mesmo do passo 6
   - Assine o campo **messages**.
8. Vercel → Settings → Environment Variables: as 4 variáveis acima + `ANTHROPIC_API_KEY` (IA) e, opcional, `ADMIN_NOTIFY_EMAIL` (e-mail quando uma conversa pedir atendente; usa o Resend que já existe).
9. Redeploy. Mande uma mensagem pro número: ela aparece em `/painel/whatsapp`.

## Regras da Meta que valem saber

- Mensagem livre só dentro de **24 h** depois da última mensagem do cliente (o painel avisa quando passar disso). Fora da janela só com *template* aprovado (ainda não implementado aqui).
- Botões: máximo 3 por mensagem, título até 20 caracteres.
- Áudio: `.ogg` (opus) chega como mensagem de voz; `.mp3`/`.m4a`/`.aac`/`.amr` chega como arquivo de áudio. `.webm`/`.wav` não são aceitos.
- Valores de cobrança por conversa mudam; confira a tabela atual da Meta antes de divulgar o número em escala.
