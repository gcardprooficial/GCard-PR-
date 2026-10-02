-- Caixa de entrada do WhatsApp (API oficial da Meta) + respostas automáticas + base da IA.

CREATE TABLE IF NOT EXISTS public.wa_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_id           TEXT NOT NULL UNIQUE,            -- telefone do cliente (só dígitos, com 55)
  name            TEXT,
  status          TEXT NOT NULL DEFAULT 'bot' CHECK (status IN ('bot', 'humano', 'resolvido')),
  unread_count    INTEGER NOT NULL DEFAULT 0,
  last_text       TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_inbound_at TIMESTAMPTZ,                      -- janela de 24h da Meta
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wa_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  sender          TEXT NOT NULL CHECK (sender IN ('cliente', 'bot', 'humano')),
  kind            TEXT NOT NULL DEFAULT 'text',     -- text | audio | image | other
  body            TEXT,
  media_path      TEXT,                             -- áudio pré-gravado enviado (bucket wa-audio)
  wa_message_id   TEXT UNIQUE,                      -- dedupe de reentrega do webhook
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_messages_conv_idx ON public.wa_messages (conversation_id, created_at);

-- Resposta rápida: se a mensagem do cliente contém alguma keyword, manda o texto (e o áudio, se tiver).
-- O texto aceita {{precos}} e {{modelos}} (preenchidos ao vivo com o catálogo do banco).
CREATE TABLE IF NOT EXISTS public.wa_quick_replies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  keywords   TEXT[] NOT NULL DEFAULT '{}',
  body       TEXT NOT NULL,
  audio_path TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O que a IA "aprendeu": pergunta/resposta aprovadas pela equipe.
CREATE TABLE IF NOT EXISTS public.wa_knowledge (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_knowledge     ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.wa_conversations TO authenticated;
GRANT SELECT ON public.wa_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_quick_replies TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.wa_knowledge TO authenticated;
GRANT ALL ON public.wa_conversations, public.wa_messages, public.wa_quick_replies, public.wa_knowledge TO service_role;

DROP POLICY IF EXISTS "wa conv team" ON public.wa_conversations;
CREATE POLICY "wa conv team" ON public.wa_conversations FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "wa msg team read" ON public.wa_messages;
CREATE POLICY "wa msg team read" ON public.wa_messages FOR SELECT TO authenticated
  USING (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "wa quick team" ON public.wa_quick_replies;
CREATE POLICY "wa quick team" ON public.wa_quick_replies FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));
DROP POLICY IF EXISTS "wa know team" ON public.wa_knowledge;
CREATE POLICY "wa know team" ON public.wa_knowledge FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

-- Realtime: painel recebe mensagem nova sem recarregar.
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;

-- Bucket privado dos áudios pré-gravados.
INSERT INTO storage.buckets (id, name, public) VALUES ('wa-audio', 'wa-audio', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "wa audio team" ON storage.objects;
CREATE POLICY "wa audio team" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'wa-audio' AND app_private.is_team(auth.uid()))
  WITH CHECK (bucket_id = 'wa-audio' AND app_private.is_team(auth.uid()));

-- IA liga/desliga (padrão: ligada)
INSERT INTO public.app_settings (key, value) VALUES ('wa_ai', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Respostas iniciais (só fatos já publicados no site). Preço/modelo vêm do catálogo ao vivo.
INSERT INTO public.wa_quick_replies (title, keywords, body, sort_order) VALUES
('Valores', ARRAY['valor','valores','preço','preco','quanto custa','quanto é','quanto e','orçamento','orcamento','tabela'],
 E'Oi! Aqui estão os valores 👇\n\n{{precos}}\n\n✅ Frete grátis pra todo o Brasil\n✅ Sem mensalidade: você paga uma vez e usa pra sempre\n\nQuer que eu te explique qual modelo combina mais com o seu negócio?', 1),
('Modelos', ARRAY['modelo','modelos','catálogo','catalogo','opções','opcoes','tipos','cartão','cartao','placa','plaquinha'],
 E'Temos estes modelos 👇\n\n{{modelos}}\n\nTodos levam o link de avaliação do SEU Google: o cliente aproxima o celular (NFC) ou escaneia o QR Code e já cai na tela de avaliação.\n\nSe quiser comprar: https://www.gcardpro.com.br/comprar', 2),
('Prazo de entrega', ARRAY['prazo','entrega','demora','quanto tempo','chega','envio','frete','rastreio','rastreamento','correios','cep'],
 E'O prazo de produção + envio é de 5 a 10 dias úteis, com frete grátis pra todo o Brasil 🚚\nEnviamos pelos Correios (PAC ou Sedex, conforme o prazo disponível). Assim que o pedido sai, você recebe o código de rastreio por e-mail.\n\n📍 Quer saber quanto tempo leva até você? Me manda o seu *CEP* que eu calculo o prazo saindo de Indaiatuba/SP.', 3),
('Confiabilidade', ARRAY['confiável','confiavel','confiança','confianca','golpe','seguro','segurança','seguranca','existe','empresa','cnpj','é de verdade','e de verdade','funciona mesmo'],
 E'Pode ficar tranquilo(a) 😊 Somos a Marusso Produções, CNPJ 68.194.199/0001-70, de Indaiatuba/SP, fornecedor direto. Não tem mensalidade, e você acompanha tudo pelo site e pelo nosso Instagram: https://instagram.com/gcardpro.oficial\nO pagamento é feito pelo Mercado Pago ou Pix, e o rastreio chega no seu e-mail.', 4),
('Como configurar QR Code', ARRAY['configurar','configuro','ativar','ativo','como faço','como faco','como usar','como funciona','qr','qrcode','qr code','link da avaliação','trocar link','configurar qr','configurar o qr','configurar qr code','como configurar qr'],
 E'É bem simples! Na compra de uma placa pra você, nós já gravamos o link do seu negócio antes de enviar. Se for revenda ou precisar trocar o link:\n1) Escaneie o QR da placa e veja o código dela (ex.: GCARD-00061)\n2) Entre em https://www.gcardpro.com.br/ativar com o e-mail da compra\n3) Ache a placa pelo código e cole o link de avaliação do Google\n\nVídeo passo a passo do QR Code (1 min): https://youtube.com/shorts/zeA8QT-3Ltc\nO QR é dinâmico: dá pra trocar o link quando quiser, sem reimprimir nada.', 5),
('Como configurar NFC', ARRAY['nfc','aproximação','aproximacao','aproximar','chip','tag','configurar nfc','configurar o nfc','ativar nfc','como configurar nfc','como configurar o nfc'],
 E'O NFC funciona por aproximação: o cliente encosta o celular na placa/cartão e a avaliação do Google abre sozinha (iPhone XS ou mais novo e a maioria dos Androids compatíveis).\nVídeo passo a passo da configuração do NFC: https://youtube.com/shorts/q8W2ojaF5vE', 6)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- FLUXOS (estilo n8n): gatilho + nós encadeados. nodes = { "<id>": { type, ... } }, start = id do 1º nó.
-- Estado da conversa dentro do fluxo: flow_node = nó esperando resposta (botão/pergunta).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wa_flows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  trigger    JSONB NOT NULL DEFAULT '{"type":"keyword","keywords":[]}'::jsonb,
  start      TEXT,
  nodes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wa_flows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_flows TO authenticated;
GRANT ALL ON public.wa_flows TO service_role;
DROP POLICY IF EXISTS "wa flows team" ON public.wa_flows;
CREATE POLICY "wa flows team" ON public.wa_flows FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS flow_id   UUID REFERENCES public.wa_flows ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flow_node TEXT,
  ADD COLUMN IF NOT EXISTS vars      JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Fluxo inicial: menu com botões na primeira mensagem.
INSERT INTO public.wa_flows (name, trigger, start, nodes, sort_order) VALUES (
  'Menu inicial (primeira mensagem)',
  '{"type":"first_message"}'::jsonb,
  'n1',
  '{
    "n1": {"type":"buttons","text":"Oi! 👋 Eu sou o assistente da GCard-PRÓ. Como posso te ajudar?","buttons":[
      {"id":"b_valores","title":"Valores","next":"n2"},
      {"id":"b_modelos","title":"Modelos","next":"n3"},
      {"id":"b_mais","title":"Mais opções","next":"n4"}]},
    "n2": {"type":"text","text":"{{precos}}\n\n✅ Frete grátis pra todo o Brasil\n✅ Sem mensalidade","next":null},
    "n3": {"type":"text","text":"{{modelos}}\n\nPra comprar: https://www.gcardpro.com.br/comprar","next":null},
    "n4": {"type":"buttons","text":"Escolha uma opção:","buttons":[
      {"id":"b_prazo","title":"Prazo de entrega","next":"n5"},
      {"id":"b_config","title":"Configurar QR/NFC","next":"n6"},
      {"id":"b_atend","title":"Falar c/ atendente","next":"n7"}]},
    "n5": {"type":"cep","text":"Me manda o seu CEP que eu calculo o prazo saindo de Indaiatuba/SP 📍","next":null},
    "n6": {"type":"text","text":"Escaneie o QR da placa pra ver o código, entre em https://www.gcardpro.com.br/ativar e cole o link de avaliação do Google.\n\n▶️ QR Code: https://youtube.com/shorts/zeA8QT-3Ltc\n▶️ NFC: https://youtube.com/shorts/q8W2ojaF5vE","next":null},
    "n7": {"type":"handoff","text":"Certo! Já chamei alguém da equipe pra te responder por aqui 🙂"}
  }'::jsonb,
  1
);
