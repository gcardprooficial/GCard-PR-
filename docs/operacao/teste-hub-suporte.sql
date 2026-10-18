-- Teste dos eventos de suporte do hub (rodar DEPOIS da migração 20261019000000).
-- Tudo dentro de transação com ROLLBACK: nada fica gravado. Esperado: todas as linhas com ok = true.
-- Cria conversa, contato e mensagens de teste (somem no ROLLBACK).

BEGIN;

CREATE TEMP TABLE _res (teste TEXT, ok BOOLEAN);

DO $$
DECLARE
  conv UUID := gen_random_uuid(); conv2 UUID := gen_random_uuid();
  m1 UUID := gen_random_uuid(); m2 UUID := gen_random_uuid(); m3 UUID := gen_random_uuid();
  m4 UUID := gen_random_uuid(); m5 UUID := gen_random_uuid(); m6 UUID := gen_random_uuid();
  m7 UUID := gen_random_uuid(); m8 UUID := gen_random_uuid();
  p JSONB;
BEGIN
  -- conversa identificada: o contato do WhatsApp tem e-mail (ligado pelo telefone: DDD + últimos 8 dígitos)
  INSERT INTO public.wa_conversations (id, wa_id) VALUES (conv, '5519999990001');
  INSERT INTO public.wa_contacts (phone_key, wa_id, email) VALUES ('1999990001', '5519999990001', 'Suporte-Teste@Exemplo.com');
  -- conversa sem e-mail conhecido
  INSERT INTO public.wa_conversations (id, wa_id) VALUES (conv2, '5519999990002');

  -- 1) mensagem de texto do cliente identificado → suporte_mensagem (texto cortado, canal whatsapp)
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body)
  VALUES (m1, conv, 'in', 'cliente', 'text', 'Oi, meu pedido não chegou. ' || repeat('a', 400));
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || m1;
  INSERT INTO _res VALUES ('1a suporte_mensagem enfileirada', p ->> 'type' = 'suporte_mensagem' AND p ->> 'source' = 'gcard');
  INSERT INTO _res VALUES ('1b e-mail do contato, minúsculo', p #>> '{person,email}' = 'suporte-teste@exemplo.com');
  INSERT INTO _res VALUES ('1c texto cortado em 300', length(p #>> '{data,texto}') = 300);
  INSERT INTO _res VALUES ('1d data com conversa, texto e canal', p -> 'data' ->> 'conversa' = conv::TEXT AND p -> 'data' ->> 'canal' = 'whatsapp');

  -- 2) número longo digitado pelo cliente (CPF, cartão, telefone) é removido do texto
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body)
  VALUES (m2, conv, 'in', 'cliente', 'text', 'meu cpf é 123.456.789-09 e cartão 4111 1111 1111 1111, pedido 112');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || m2;
  INSERT INTO _res VALUES ('2a CPF e cartão removidos', p #>> '{data,texto}' NOT LIKE '%123%' AND p #>> '{data,texto}' NOT LIKE '%4111%');
  INSERT INTO _res VALUES ('2b número curto (pedido 112) permanece', p #>> '{data,texto}' LIKE '%pedido 112%');

  -- 3) resposta da equipe → suporte_resposta só com a conversa (sem texto)
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body)
  VALUES (m3, conv, 'out', 'humano', 'text', 'Vamos verificar agora.');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || m3;
  INSERT INTO _res VALUES ('3a suporte_resposta enfileirada', p ->> 'type' = 'suporte_resposta');
  INSERT INTO _res VALUES ('3b resposta só com a conversa (sem texto)', p -> 'data' = jsonb_build_object('conversa', conv));

  -- 4) bot não conta; anexo do cliente (áudio/imagem) não vai
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body) VALUES (m4, conv, 'out', 'bot', 'text', 'Olá!');
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body) VALUES (m5, conv, 'in', 'cliente', 'audio', NULL);
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body) VALUES (m6, conv, 'in', 'cliente', 'image', 'legenda');
  INSERT INTO _res VALUES ('4 bot, áudio e imagem NÃO enfileiram',
    NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE event_id IN ('gcard:suporte:' || m4, 'gcard:suporte:' || m5, 'gcard:suporte:' || m6)));

  -- 5) conversa sem e-mail conhecido: nada (nem mensagem, nem resposta)
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body) VALUES (m7, conv2, 'in', 'cliente', 'text', 'oi');
  INSERT INTO public.wa_messages (id, conversation_id, direction, sender, kind, body) VALUES (m8, conv2, 'out', 'humano', 'text', 'olá');
  INSERT INTO _res VALUES ('5 sem e-mail conhecido: nada enfileirado',
    NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE event_id IN ('gcard:suporte:' || m7, 'gcard:suporte:' || m8)));

  -- 6) event_id determinístico: gcard:suporte:<id da mensagem>
  INSERT INTO _res VALUES ('6 event_id = gcard:suporte:<id da mensagem>', (SELECT event_id FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || m1) = 'gcard:suporte:' || m1);

  -- 7) chat do site (só se a tabela existe neste banco)
  IF to_regclass('public.chat_messages') IS NOT NULL THEN
    DECLARE
      c1 UUID := gen_random_uuid(); c2 UUID := gen_random_uuid();
      x1 UUID := gen_random_uuid(); x2 UUID := gen_random_uuid(); x3 UUID := gen_random_uuid();
    BEGIN
      INSERT INTO public.chat_conversations (id, visitor_token, visitor_email) VALUES (c1, 'tok-' || c1, 'Chat-Teste@Exemplo.com');
      INSERT INTO public.chat_conversations (id, visitor_token) VALUES (c2, 'tok-' || c2);
      INSERT INTO public.chat_messages (id, conversation_id, sender_type, body) VALUES (x1, c1, 'visitor', 'preciso de ajuda');
      INSERT INTO public.chat_messages (id, conversation_id, sender_type, body) VALUES (x2, c1, 'staff', 'já vamos ver');
      INSERT INTO public.chat_messages (id, conversation_id, sender_type, body) VALUES (x3, c2, 'visitor', 'oi (visitante sem e-mail)');
      SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || x1;
      INSERT INTO _res VALUES ('7a chat: visitante com e-mail → suporte_mensagem (canal chat)', p ->> 'type' = 'suporte_mensagem' AND p -> 'data' ->> 'canal' = 'chat' AND p #>> '{person,email}' = 'chat-teste@exemplo.com');
      SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || x2;
      INSERT INTO _res VALUES ('7b chat: equipe → suporte_resposta', p ->> 'type' = 'suporte_resposta');
      INSERT INTO _res VALUES ('7c chat: visitante sem e-mail NÃO enfileira', NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE event_id = 'gcard:suporte:' || x3));
    END;
  ELSE
    INSERT INTO _res VALUES ('7 (tabela chat_messages não existe neste banco: ignorado)', true);
  END IF;
END $$;

SELECT teste, ok FROM _res ORDER BY ok, teste;
ROLLBACK;
