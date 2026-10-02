-- WhatsApp v2: textos curtos, menu que sempre oferece o próximo passo, fotos dos modelos
-- e etiquetas automáticas de contato (compraram, pararam no pagamento, etc.), puxando os pedidos do site.
-- Rode DEPOIS de 20261002000000_whatsapp_inbox.sql. Substitui o fluxo "Menu inicial" e as 6 respostas rápidas
-- originais (pelo título): se você editou esses no painel, as edições voltam ao padrão.

-- ---------------------------------------------------------------------------
-- 1) Respostas rápidas curtas. {{fotos}} = manda foto + preço de cada modelo.
-- ---------------------------------------------------------------------------
UPDATE public.wa_quick_replies SET
  keywords = ARRAY['valor','valores','preço','preco','quanto custa','quanto é','quanto e','orçamento','orcamento','tabela'],
  body = E'💰 *Valores* (frete grátis, sem mensalidade)\n\n{{precos}}\n\nRevenda (10+ un) tem valor menor: me diga a quantidade.'
WHERE title = 'Valores';

UPDATE public.wa_quick_replies SET
  keywords = ARRAY['modelo','modelos','catálogo','catalogo','cartão','cartao','placa','plaquinha','fotos','foto'],
  body = E'Nossos modelos 👇\n{{fotos}}'
WHERE title = 'Modelos';

UPDATE public.wa_quick_replies SET
  body = E'🚚 Produção + envio: *5 a 10 dias úteis*, frete grátis pra todo o Brasil.\n\n📍 Me manda seu *CEP* que calculo o prazo até você.'
WHERE title = 'Prazo de entrega';

UPDATE public.wa_quick_replies SET
  body = E'Somos a *Marusso Produções* (CNPJ 68.194.199/0001-70, Indaiatuba/SP), fornecedor direto. Sem mensalidade, pagamento seguro (Mercado Pago/Pix) e rastreio por e-mail.\nInstagram: @gcardpro.oficial'
WHERE title = 'Confiabilidade';

UPDATE public.wa_quick_replies SET
  body = E'Placa pra você: já vai *pronta* com o link do seu Google.\nPra trocar o link: escaneie o QR (mostra o código) → gcardpro.com.br/ativar.\n▶️ https://youtube.com/shorts/zeA8QT-3Ltc'
WHERE title = 'Como configurar QR Code';

UPDATE public.wa_quick_replies SET
  body = E'É só *aproximar o celular* da placa/cartão e a avaliação abre (iPhone XS+ e maioria dos Androids).\n▶️ https://youtube.com/shorts/q8W2ojaF5vE'
WHERE title = 'Como configurar NFC';

-- ---------------------------------------------------------------------------
-- 2) Fluxo "Menu inicial": botões, sempre volta ao menu, "menu/opções" reabre a qualquer hora.
-- ---------------------------------------------------------------------------
UPDATE public.wa_flows SET
  trigger = '{"type":"first_message","keywords":["menu","opcoes","opções","mais opcoes","mais opções","ajuda","inicio","início","voltar"]}'::jsonb,
  start = 'n1',
  nodes = '{
    "n1": {"type":"buttons","text":"Oi! 👋 Sou o assistente da GCard-PRÓ. Como posso ajudar?","buttons":[
      {"id":"b_valores","title":"Valores","next":"n2"},
      {"id":"b_modelos","title":"Modelos","next":"n3"},
      {"id":"b_mais","title":"Mais opções","next":"n4"}]},
    "n2": {"type":"text","text":"💰 *Valores* (frete grátis, sem mensalidade)\n\n{{precos}}\n\nRevenda (10+ un) tem valor menor: me diga a quantidade.","next":"nfim"},
    "n3": {"type":"models","text":"Nossos modelos 👇","next":"nfim"},
    "n4": {"type":"buttons","text":"Mais opções:","buttons":[
      {"id":"b_prazo","title":"Prazo de entrega","next":"n5"},
      {"id":"b_config","title":"Configurar QR/NFC","next":"n6"},
      {"id":"b_outras","title":"Outras opções","next":"n8"}]},
    "n5": {"type":"cep","text":"Me manda o seu *CEP* que calculo o prazo saindo de Indaiatuba/SP 📍","next":"nfim"},
    "n6": {"type":"text","text":"Placa pra você: já vai *pronta* com o link do seu Google.\nPra trocar o link: escaneie o QR (mostra o código) → gcardpro.com.br/ativar.\n▶️ QR: https://youtube.com/shorts/zeA8QT-3Ltc\n▶️ NFC: https://youtube.com/shorts/q8W2ojaF5vE","next":"nfim"},
    "n7": {"type":"handoff","text":"Certo! Já chamei alguém da equipe 🙂"},
    "n8": {"type":"buttons","text":"Mais opções:","buttons":[
      {"id":"b_conf","title":"É confiável?","next":"n9"},
      {"id":"b_atend2","title":"Falar c/ atendente","next":"n7"},
      {"id":"b_inicio","title":"Voltar ao início","next":"ngo"}]},
    "n9": {"type":"text","text":"Somos a *Marusso Produções* (CNPJ 68.194.199/0001-70, Indaiatuba/SP), fornecedor direto. Sem mensalidade, pagamento seguro e rastreio por e-mail.\nInstagram: @gcardpro.oficial","next":"nfim"},
    "ngo": {"type":"goto","target":"start"},
    "nfim": {"type":"buttons","text":"Posso ajudar em mais alguma coisa?","buttons":[
      {"id":"b_menu","title":"Ver menu","next":"ngo"},
      {"id":"b_atend","title":"Falar c/ atendente","next":"n7"}]}
  }'::jsonb
WHERE name = 'Menu inicial (primeira mensagem)';

-- ---------------------------------------------------------------------------
-- 3) Contatos + etiquetas
--    phone_key = DDD + últimos 8 dígitos (tolera o 9º dígito que o WhatsApp às vezes omite).
--    auto_labels = calculadas pelo sistema; labels = manuais (nunca são sobrescritas).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_contacts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_key        TEXT NOT NULL UNIQUE,
  wa_id            TEXT,
  name             TEXT,
  email            TEXT,
  auto_labels      TEXT[] NOT NULL DEFAULT '{}',
  labels           TEXT[] NOT NULL DEFAULT '{}',
  paid_orders      INTEGER NOT NULL DEFAULT 0,
  paid_total_cents BIGINT  NOT NULL DEFAULT 0,
  last_paid_at     TIMESTAMPTZ,
  pending_orders   INTEGER NOT NULL DEFAULT 0,
  last_order_at    TIMESTAMPTZ,
  last_order_status TEXT,
  is_revenda       BOOLEAN NOT NULL DEFAULT false,
  source           TEXT NOT NULL DEFAULT 'site',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_contacts TO authenticated;
GRANT ALL ON public.wa_contacts TO service_role;
DROP POLICY IF EXISTS "wa contacts team" ON public.wa_contacts;
CREATE POLICY "wa contacts team" ON public.wa_contacts FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

CREATE OR REPLACE FUNCTION public.wa_sync_contacts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total integer;
BEGIN
  -- Chamada pelo painel precisa ser da equipe; service_role (cron/servidor) não tem auth.uid().
  IF auth.uid() IS NOT NULL AND NOT app_private.is_team(auth.uid()) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  -- 1) Pedidos do site -> contatos (estatísticas por telefone).
  WITH ord AS (
    SELECT
      CASE
        WHEN length(d) IN (10, 11) THEN '55' || d
        WHEN d LIKE '55%' AND length(d) IN (12, 13) THEN d
        ELSE NULL
      END AS phone_full,
      customer_name, customer_email, payment_status::text AS status, kind::text AS kind,
      total_cents, created_at, paid_at
    FROM (
      SELECT *, regexp_replace(coalesce(customer_phone, ''), '\D', '', 'g') AS d FROM public.orders
    ) o
  ), ordk AS (
    SELECT substr(phone_full, 3, 2) || right(phone_full, 8) AS pk, * FROM ord WHERE phone_full IS NOT NULL
  ), agg AS (
    SELECT
      pk,
      (array_agg(phone_full ORDER BY created_at DESC))[1]           AS wa_id,
      (array_agg(customer_name ORDER BY created_at DESC))[1]  AS name,
      (array_agg(customer_email ORDER BY created_at DESC))[1] AS email,
      count(*) FILTER (WHERE status = 'pago')                  AS paid_orders,
      coalesce(sum(total_cents) FILTER (WHERE status = 'pago'), 0) AS paid_total,
      max(coalesce(paid_at, created_at)) FILTER (WHERE status = 'pago') AS last_paid_at,
      count(*) FILTER (WHERE status = 'pendente')              AS pending_orders,
      max(created_at)                                          AS last_order_at,
      (array_agg(status ORDER BY created_at DESC))[1]          AS last_status,
      coalesce(bool_or(kind = 'revenda' AND status = 'pago'), false) AS revenda
    FROM ordk
    GROUP BY pk
  )
  INSERT INTO public.wa_contacts AS c
    (phone_key, wa_id, name, email, paid_orders, paid_total_cents, last_paid_at,
     pending_orders, last_order_at, last_order_status, is_revenda, source)
  SELECT pk, wa_id, name, email, paid_orders, paid_total, last_paid_at,
         pending_orders, last_order_at, last_status, revenda, 'site'
  FROM agg
  ON CONFLICT (phone_key) DO UPDATE SET
    wa_id = EXCLUDED.wa_id,
    name = coalesce(c.name, EXCLUDED.name),
    email = EXCLUDED.email,
    paid_orders = EXCLUDED.paid_orders,
    paid_total_cents = EXCLUDED.paid_total_cents,
    last_paid_at = EXCLUDED.last_paid_at,
    pending_orders = EXCLUDED.pending_orders,
    last_order_at = EXCLUDED.last_order_at,
    last_order_status = EXCLUDED.last_order_status,
    is_revenda = EXCLUDED.is_revenda;

  -- 2) Quem já falou no WhatsApp e ainda não existe como contato vira lead.
  INSERT INTO public.wa_contacts (phone_key, wa_id, name, source)
  SELECT substr(v.wa_id, 3, 2) || right(v.wa_id, 8), v.wa_id, v.name, 'whatsapp'
  FROM public.wa_conversations v
  WHERE length(v.wa_id) >= 12
  ON CONFLICT (phone_key) DO NOTHING;

  -- 3) Etiquetas automáticas (recalculadas por inteiro a cada sincronização).
  UPDATE public.wa_contacts c
  SET auto_labels = x.labels, updated_at = now()
  FROM (
    SELECT
      k.id,
      array_remove(ARRAY[
        CASE WHEN k.paid_orders >= 1 THEN 'Cliente' END,
        CASE WHEN k.paid_orders >= 2 THEN 'Cliente recorrente' END,
        CASE WHEN k.is_revenda THEN 'Revenda' END,
        CASE WHEN k.paid_orders = 0 AND k.last_order_status = 'pendente'
                  AND k.last_order_at < now() - interval '2 hours' THEN 'Parou no pagamento' END,
        CASE WHEN k.paid_orders = 0 AND k.last_order_status = 'pendente'
                  AND k.last_order_at >= now() - interval '2 hours' THEN 'Aguardando pagamento' END,
        CASE WHEN k.paid_orders = 0 AND k.last_order_status IN ('recusado', 'cancelado') THEN 'Pagamento falhou' END,
        CASE WHEN k.paid_orders >= 1 AND k.last_paid_at < now() - interval '90 days' THEN 'Cliente inativo (90d+)' END,
        CASE WHEN v.id IS NOT NULL AND k.paid_orders = 0 AND k.last_order_at IS NULL THEN 'Lead' END,
        CASE WHEN v.id IS NOT NULL AND k.paid_orders = 0 AND v.last_inbound_at < now() - interval '48 hours'
                  AND v.last_message_at > v.last_inbound_at THEN 'Parou de responder' END,
        CASE WHEN v.id IS NOT NULL THEN 'Falou no WhatsApp' END
      ], NULL) AS labels
    FROM public.wa_contacts k
    LEFT JOIN public.wa_conversations v
      ON length(v.wa_id) >= 12 AND (substr(v.wa_id, 3, 2) || right(v.wa_id, 8)) = k.phone_key
  ) x
  WHERE x.id = c.id;

  SELECT count(*) INTO total FROM public.wa_contacts;
  RETURN total;
END;
$$;
REVOKE ALL ON FUNCTION public.wa_sync_contacts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_sync_contacts() TO authenticated, service_role;

-- Primeira carga: todos os pedidos do site viram contatos já etiquetados.
SELECT public.wa_sync_contacts();
