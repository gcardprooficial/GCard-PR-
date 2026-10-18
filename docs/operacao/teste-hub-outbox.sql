-- Teste do outbox do hub (rodar no SQL Editor do Supabase DEPOIS da migração 20261018000000).
-- Tudo dentro de transação com ROLLBACK: nada fica gravado. Esperado: todas as linhas com ok = true.
-- Usa um pedido e um usuário que já existem (só leitura deles); os eventos de teste somem no ROLLBACK.

BEGIN;

CREATE TEMP TABLE _res (teste TEXT, ok BOOLEAN);
GRANT ALL ON _res TO anon, authenticated;

DO $$
DECLARE
  ord UUID;  ord_mail TEXT; ord_num BIGINT;
  usr UUID;  usr_mail TEXT;
  e1 UUID := gen_random_uuid(); e2 UUID := gen_random_uuid(); e3 UUID := gen_random_uuid();
  e4 UUID := gen_random_uuid(); e5 UUID := gen_random_uuid(); e6 UUID := gen_random_uuid();
  c1 UUID := gen_random_uuid(); c2 UUID := gen_random_uuid();
  p JSONB; n INT;
BEGIN
  SELECT id, lower(customer_email), order_number INTO ord, ord_mail, ord_num FROM public.orders ORDER BY created_at DESC LIMIT 1;
  SELECT id, lower(email) INTO usr, usr_mail FROM auth.users WHERE email IS NOT NULL LIMIT 1;
  IF ord IS NULL OR usr IS NULL THEN INSERT INTO _res VALUES ('(precisa de ao menos 1 pedido e 1 usuário)', false); RETURN; END IF;

  -- 1) e-mail do próprio evento (minúsculo) + origem só com as 5 chaves do contrato
  INSERT INTO public.events (id, type, email, first_touch, data)
  VALUES (e1, 'checkout_iniciado', 'PESSOA@Exemplo.com',
          '{"utm_source":"youtube","utm_medium":"video","landing":"/comprar","referrer_host":"youtube.com","ts":"2026-10-17T00:00:00Z"}',
          '{"order_number":7,"total_cents":100,"kind":"individual","cpf":"123"}');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:' || e1;
  INSERT INTO _res VALUES ('1a e-mail do evento, minúsculo', p #>> '{person,email}' = 'pessoa@exemplo.com');
  INSERT INTO _res VALUES ('1b envelope: versão, origem, tipo', p ->> 'schema_version' = '1' AND p ->> 'source' = 'gcard' AND p ->> 'type' = 'checkout_iniciado');
  INSERT INTO _res VALUES ('1c occurred_at em UTC com Z', p ->> 'occurred_at' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$');
  INSERT INTO _res VALUES ('1d origem só com utm_*/ref (sem landing/referrer/ts)',
    p #> '{context,origin}' = '{"utm_source":"youtube","utm_medium":"video"}'::jsonb);
  INSERT INTO _res VALUES ('1e data sem chave fora do contrato (cpf some)', NOT (p -> 'data' ? 'cpf') AND p -> 'data' ->> 'order_number' = '7');
  INSERT INTO _res VALUES ('1f status pendente', (SELECT status FROM public.hub_outbox WHERE event_id = 'gcard:' || e1) = 'pendente');

  -- 2) sem e-mail no evento: vem do pedido; pedido_pago ganha o order_number
  INSERT INTO public.events (id, type, order_id, data) VALUES (e2, 'pedido_pago', ord, '{"total_cents":5,"provider":"pagarme","kind":"revenda"}');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:' || e2;
  INSERT INTO _res VALUES ('2a e-mail resolvido pelo pedido', p #>> '{person,email}' = ord_mail);
  INSERT INTO _res VALUES ('2b pedido_pago ganha order_number do pedido', (p -> 'data' ->> 'order_number')::BIGINT = ord_num);

  -- 3) só person_id: e-mail vem de auth.users; external_id preenchido
  INSERT INTO public.events (id, type, person_id, data) VALUES (e3, 'codigo_ativado', usr, '{"short_code":"GCARD-00001"}');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:' || e3;
  INSERT INTO _res VALUES ('3a e-mail resolvido pelo usuário', p #>> '{person,email}' = usr_mail);
  INSERT INTO _res VALUES ('3b external_id = id do usuário', p #>> '{person,external_id}' = usr::TEXT);

  -- 4) destino_alterado: só host, nunca a URL
  INSERT INTO public.events (id, type, person_id, data)
  VALUES (e4, 'destino_alterado', usr, '{"short_code":"GCARD-00001","host":"instagram.com","url":"https://instagram.com/segredo?x=1"}');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:' || e4;
  INSERT INTO _res VALUES ('4 destino_alterado leva host e NÃO leva url', p -> 'data' ->> 'host' = 'instagram.com' AND NOT (p -> 'data' ? 'url'));

  -- 5) sem e-mail resolvível: guarda como sem_email (não envia)
  INSERT INTO public.events (id, type, data) VALUES (e5, 'checkout_iniciado', '{}');
  INSERT INTO _res VALUES ('5 sem e-mail → sem_email', (SELECT status FROM public.hub_outbox WHERE event_id = 'gcard:' || e5) = 'sem_email');

  -- 6) visitante anônimo vendo produto: não entra no outbox
  INSERT INTO public.events (id, type, data) VALUES (e6, 'produto_visto', '{"slug":"x"}');
  INSERT INTO _res VALUES ('6 produto_visto anônimo não é guardado', NOT EXISTS (SELECT 1 FROM public.hub_outbox WHERE event_id = 'gcard:' || e6));

  -- 7) consentimento: dado e revogado, com prioridade para a revogação
  INSERT INTO public.consent_records (id, email, accepted, text_version, source)
  VALUES (c1, 'Aceitou@Exemplo.com', true, (SELECT version FROM public.consent_texts LIMIT 1), 'cadastro');
  INSERT INTO public.consent_records (id, email, accepted, text_version, source)
  VALUES (c2, 'aceitou@exemplo.com', false, (SELECT version FROM public.consent_texts LIMIT 1), 'sair');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:consent:' || c1;
  INSERT INTO _res VALUES ('7a consentimento_dado com versão e origem', p ->> 'type' = 'consentimento_dado' AND p #>> '{data,origem}' = 'cadastro' AND p #>> '{data,texto_versao}' IS NOT NULL);
  INSERT INTO _res VALUES ('7b e-mail do consentimento em minúsculo', p #>> '{person,email}' = 'aceitou@exemplo.com');
  SELECT payload INTO p FROM public.hub_outbox WHERE event_id = 'gcard:consent:' || c2;
  INSERT INTO _res VALUES ('7c consentimento_revogado (origem sair)', p ->> 'type' = 'consentimento_revogado' AND p #>> '{data,origem}' = 'sair');
  INSERT INTO _res VALUES ('7d revogação tem prioridade 10', (SELECT priority FROM public.hub_outbox WHERE event_id = 'gcard:consent:' || c2) = 10);

  -- 8) retirar o próximo lote: revogação sai primeiro e o item fica "alugado" (não sai de novo)
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  SELECT count(*) INTO n FROM public.hub_outbox_claim(1);
  INSERT INTO _res VALUES ('8a claim devolve 1 item', n = 1);
  INSERT INTO _res VALUES ('8b o item retirado foi a revogação',
    (SELECT next_attempt_at > now() FROM public.hub_outbox WHERE event_id = 'gcard:consent:' || c2));
  SELECT count(*) INTO n FROM public.hub_outbox_claim(500) o WHERE o.event_id = 'gcard:consent:' || c2;
  INSERT INTO _res VALUES ('8c item alugado não sai duas vezes', n = 0);
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM * FROM public.hub_outbox_claim(1);
    INSERT INTO _res VALUES ('8d sem service_role o claim é recusado', false);
  EXCEPTION WHEN OTHERS THEN INSERT INTO _res VALUES ('8d sem service_role o claim é recusado', true); END;
END $$;

-- 9) quem não é o servidor não enxerga nada do outbox
SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.hub_outbox;
    INSERT INTO _res VALUES ('9 anon NÃO lê hub_outbox', false);
  EXCEPTION WHEN insufficient_privilege THEN INSERT INTO _res VALUES ('9 anon NÃO lê hub_outbox', true); END;
END $$;
RESET ROLE;

SELECT teste, ok FROM _res ORDER BY ok, teste;
ROLLBACK;
