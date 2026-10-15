-- Fase 2: origem (first-touch), eventos do funil, consentimento versionado, e-mail normalizado
-- e visão de pessoas por e-mail. Tudo com IF NOT EXISTS e RLS ligada em tabela nova.
-- Não mexe na cobrança: os eventos de pagamento saem de gatilhos idempotentes (dedupe_key).

-- 1) Origem first-touch -------------------------------------------------------------------------
ALTER TABLE public.orders      ADD COLUMN IF NOT EXISTS first_touch JSONB;
ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS first_touch JSONB;
ALTER TABLE public.tool_leads  ADD COLUMN IF NOT EXISTS first_touch JSONB;
ALTER TABLE public.tool_leads  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users ON DELETE SET NULL;
ALTER TABLE public.tool_leads  ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.tool_leads  ADD COLUMN IF NOT EXISTS email_consent_at TIMESTAMPTZ;

-- Só chaves conhecidas, texto curto: o cookie vem do navegador e nunca é confiável.
CREATE OR REPLACE FUNCTION public.clean_first_touch(_j JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN _j IS NULL OR jsonb_typeof(_j) <> 'object' THEN NULL ELSE
    NULLIF(jsonb_strip_nulls(jsonb_build_object(
      'utm_source',   lower(left(_j ->> 'utm_source', 60)),
      'utm_medium',   lower(left(_j ->> 'utm_medium', 60)),
      'utm_campaign', lower(left(_j ->> 'utm_campaign', 80)),
      'utm_content',  lower(left(_j ->> 'utm_content', 80)),
      'ref',          lower(left(_j ->> 'ref', 60)),
      'landing',      left(_j ->> 'landing', 120),
      'referrer_host',lower(left(_j ->> 'referrer_host', 80)),
      'ts',           left(_j ->> 'ts', 40)
    )), '{}'::jsonb) END;
$$;

-- 2) Eventos do funil ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN (
                'conta_criada', 'email_confirmado', 'produto_visto', 'checkout_iniciado',
                'pagamento_iniciado', 'pedido_pago', 'codigo_ativado', 'destino_alterado', 'qr_baixado')),
  person_id   UUID REFERENCES auth.users ON DELETE SET NULL,
  email       TEXT,
  order_id    UUID REFERENCES public.orders ON DELETE SET NULL,
  plate_id    UUID REFERENCES public.plates ON DELETE SET NULL,
  source      TEXT,                           -- utm_source do first-touch (atalho para filtrar)
  first_touch JSONB,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key  TEXT UNIQUE,                    -- o mesmo evento chegando duas vezes não duplica
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_type_created_idx ON public.events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS events_person_idx ON public.events (person_id);
CREATE INDEX IF NOT EXISTS events_email_idx ON public.events (lower(email));
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
DROP POLICY IF EXISTS "events team read" ON public.events;
CREATE POLICY "events team read" ON public.events FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));

-- Função única de registro. Ninguém de fora chama direto: só gatilhos e o servidor (service_role).
CREATE OR REPLACE FUNCTION public.track_event(
  _type TEXT, _person_id UUID, _email TEXT, _order_id UUID, _plate_id UUID,
  _first_touch JSONB, _data JSONB, _dedupe TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ft JSONB := public.clean_first_touch(_first_touch);
BEGIN
  INSERT INTO public.events (type, person_id, email, order_id, plate_id, source, first_touch, data, dedupe_key)
  VALUES (_type, _person_id, lower(_email), _order_id, _plate_id, ft ->> 'utm_source', ft, COALESCE(_data, '{}'::jsonb), _dedupe)
  ON CONFLICT (dedupe_key) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.track_event(TEXT, UUID, TEXT, UUID, UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_event(TEXT, UUID, TEXT, UUID, UUID, JSONB, JSONB, TEXT) TO service_role;

-- Pedido criado = checkout iniciado; pagamento escolhido; pedido pago. Qualquer caminho (webhook, retorno, manual).
CREATE OR REPLACE FUNCTION public.orders_track_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.track_event('checkout_iniciado', NULL, NEW.customer_email, NEW.id, NULL, NEW.first_touch,
      jsonb_build_object('order_number', NEW.order_number, 'total_cents', NEW.total_cents, 'kind', NEW.kind),
      'checkout_iniciado:' || NEW.id);
    RETURN NEW;
  END IF;
  IF NEW.payment_provider IS NOT NULL AND NEW.payment_provider IS DISTINCT FROM OLD.payment_provider THEN
    PERFORM public.track_event('pagamento_iniciado', NULL, NEW.customer_email, NEW.id, NULL, NEW.first_touch,
      jsonb_build_object('provider', NEW.payment_provider), 'pagamento_iniciado:' || NEW.id || ':' || NEW.payment_provider);
  END IF;
  IF NEW.payment_status = 'pago' AND OLD.payment_status IS DISTINCT FROM 'pago' THEN
    PERFORM public.track_event('pedido_pago', NULL, NEW.customer_email, NEW.id, NULL, NEW.first_touch,
      jsonb_build_object('total_cents', NEW.total_cents, 'provider', NEW.payment_provider, 'kind', NEW.kind),
      'pedido_pago:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS orders_track_events_ins ON public.orders;
CREATE TRIGGER orders_track_events_ins AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_track_events();
DROP TRIGGER IF EXISTS orders_track_events_upd ON public.orders;
CREATE TRIGGER orders_track_events_upd AFTER UPDATE OF payment_status, payment_provider ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_track_events();

-- Código ativado / destino alterado (só o host do destino, nunca a URL inteira).
CREATE OR REPLACE FUNCTION public.plates_track_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE who UUID := auth.uid();
BEGIN
  IF NEW.status = 'ativada' AND OLD.status IS DISTINCT FROM 'ativada' THEN
    PERFORM public.track_event('codigo_ativado', who, NULL, NEW.order_id, NEW.id, NULL,
      jsonb_build_object('short_code', NEW.short_code), NULL);
  END IF;
  IF NEW.destination_url IS DISTINCT FROM OLD.destination_url AND NEW.destination_url IS NOT NULL AND OLD.destination_url IS NOT NULL THEN
    PERFORM public.track_event('destino_alterado', who, NULL, NEW.order_id, NEW.id, NULL,
      jsonb_build_object('short_code', NEW.short_code, 'host', substring(NEW.destination_url FROM '^https://([^/?#]*)')), NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS plates_track_events_trg ON public.plates;
CREATE TRIGGER plates_track_events_trg AFTER UPDATE ON public.plates
  FOR EACH ROW EXECUTE FUNCTION public.plates_track_events();

-- 3) Consentimento versionado -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consent_texts (
  version    TEXT PRIMARY KEY,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.consent_texts (version, text) VALUES
  ('2026-10-v1',
   'Quero receber novidades e ofertas dos produtos da Marusso Produções (GCard-PRÓ e TOQY) por e-mail. Posso cancelar quando quiser.')
ON CONFLICT (version) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.consent_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  user_id      UUID REFERENCES auth.users ON DELETE SET NULL,
  order_id     UUID REFERENCES public.orders ON DELETE SET NULL,
  accepted     BOOLEAN NOT NULL,
  text_version TEXT NOT NULL REFERENCES public.consent_texts (version),
  source       TEXT NOT NULL CHECK (source IN ('cadastro', 'checkout', 'gerador', 'sair')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS consent_records_email_idx ON public.consent_records (lower(email), created_at DESC);
ALTER TABLE public.consent_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.consent_texts TO anon, authenticated;
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_texts, public.consent_records TO service_role;
DROP POLICY IF EXISTS "consent texts public" ON public.consent_texts;
CREATE POLICY "consent texts public" ON public.consent_texts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "consent records team read" ON public.consent_records;
CREATE POLICY "consent records team read" ON public.consent_records FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));

-- 4) E-mail "parecido": gmail ignora ponto e +etiqueta, os demais só +etiqueta -------------------
CREATE OR REPLACE FUNCTION public.normalize_email_key(_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(lower(trim(_email)), '@', 2) IN ('gmail.com', 'googlemail.com')
      THEN replace(split_part(split_part(lower(trim(_email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    ELSE split_part(split_part(lower(trim(_email)), '@', 1), '+', 1) || '@' || split_part(lower(trim(_email)), '@', 2)
  END;
$$;

-- Já existe OUTRA conta com e-mail quase igual? (service_role: chamada só pelo servidor, com limite de requisições)
CREATE OR REPLACE FUNCTION public.similar_account_exists(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE public.normalize_email_key(u.email) = public.normalize_email_key(_email)
      AND lower(u.email) <> lower(trim(_email))
  );
$$;
REVOKE ALL ON FUNCTION public.similar_account_exists(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.similar_account_exists(TEXT) TO service_role;

-- 5) Cadastro: guarda origem, registra evento e consentimento vindos do metadata -----------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ft JSONB := public.clean_first_touch(NEW.raw_user_meta_data -> 'first_touch');
  consent_ok BOOLEAN := COALESCE((NEW.raw_user_meta_data ->> 'marketing_consent') = 'true', false);
  consent_ver TEXT := NEW.raw_user_meta_data ->> 'consent_version';
BEGIN
  INSERT INTO public.profiles (id, full_name, email, first_touch)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, ft)
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.track_event('conta_criada', NEW.id, NEW.email, NULL, NULL, ft, '{}'::jsonb, 'conta_criada:' || NEW.id);

  -- Registra a escolha (aceitou ou não) com a versão do texto exibido. Versão desconhecida = não registra.
  IF consent_ver IS NOT NULL AND EXISTS (SELECT 1 FROM public.consent_texts WHERE version = consent_ver) THEN
    INSERT INTO public.consent_records (email, user_id, accepted, text_version, source)
    VALUES (lower(NEW.email), NEW.id, consent_ok, consent_ver, 'cadastro');
    IF consent_ok THEN
      INSERT INTO public.marketing_contacts (email, full_name, marketing_consent_at)
      VALUES (lower(NEW.email), NEW.raw_user_meta_data ->> 'full_name', now())
      ON CONFLICT (email) DO UPDATE SET marketing_consent_at = now(), marketing_unsubscribed_at = NULL, updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_user_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.track_event('email_confirmado', NEW.id, NEW.email, NULL, NULL,
      (SELECT first_touch FROM public.profiles WHERE id = NEW.id), '{}'::jsonb, 'email_confirmado:' || NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_confirmed();

-- 6) Pessoas por e-mail (Fase 3, só a visão + exportação). Sem CPF/CNPJ. Equipe ou service_role. ----
CREATE OR REPLACE FUNCTION public.people_summary()
RETURNS TABLE (
  email TEXT, name TEXT, phone TEXT, first_source TEXT, first_seen TIMESTAMPTZ,
  orders_count BIGINT, paid_orders BIGINT, paid_total_cents BIGINT, last_paid_at TIMESTAMPTZ,
  plates_activated BIGINT, has_account BOOLEAN, email_confirmed BOOLEAN,
  marketing_consent_at TIMESTAMPTZ, marketing_unsubscribed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR app_private.is_team(auth.uid())) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  WITH emails AS (
    SELECT lower(customer_email) AS e FROM public.orders
    UNION SELECT lower(email) FROM auth.users WHERE email IS NOT NULL
    UNION SELECT lower(email) FROM public.tool_leads WHERE email IS NOT NULL
    UNION SELECT lower(email) FROM public.marketing_contacts
  ),
  o AS (
    SELECT lower(customer_email) AS e,
           max(customer_name) AS nm, max(customer_phone) AS ph,
           count(*) AS n, count(*) FILTER (WHERE payment_status = 'pago') AS np,
           COALESCE(sum(total_cents) FILTER (WHERE payment_status = 'pago'), 0)::BIGINT AS tot,
           max(paid_at) AS lp, min(created_at) AS fs,
           (array_agg(first_touch ->> 'utm_source' ORDER BY created_at) FILTER (WHERE first_touch ->> 'utm_source' IS NOT NULL))[1] AS src
    FROM public.orders GROUP BY 1
  ),
  pl AS (
    SELECT lower(o2.customer_email) AS e, count(*) AS na
    FROM public.plates p JOIN public.orders o2 ON o2.id = p.order_id
    WHERE p.status = 'ativada' GROUP BY 1
  )
  SELECT em.e,
         COALESCE(o.nm, pr.full_name, mc.full_name),
         COALESCE(o.ph, pr.phone),
         COALESCE(pr.first_touch ->> 'utm_source', o.src),
         LEAST(o.fs, u.created_at),
         COALESCE(o.n, 0), COALESCE(o.np, 0), COALESCE(o.tot, 0), o.lp,
         COALESCE(pl.na, 0),
         u.id IS NOT NULL,
         COALESCE(u.email_confirmed_at IS NOT NULL, false),
         mc.marketing_consent_at, mc.marketing_unsubscribed_at
  FROM emails em
  LEFT JOIN o ON o.e = em.e
  LEFT JOIN pl ON pl.e = em.e
  LEFT JOIN auth.users u ON lower(u.email) = em.e
  LEFT JOIN public.profiles pr ON pr.id = u.id
  LEFT JOIN public.marketing_contacts mc ON lower(mc.email) = em.e
  WHERE em.e IS NOT NULL
  ORDER BY COALESCE(LEAST(o.fs, u.created_at), u.created_at, o.fs) DESC NULLS LAST;
END;
$$;
REVOKE ALL ON FUNCTION public.people_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.people_summary() TO authenticated, service_role;
