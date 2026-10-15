-- Fase 4: relatórios do admin (funil por origem, contas sem compra) e Fase 5: limite de requisições compartilhado.
-- Tudo só da equipe (service_role ou is_team). Idempotente. Reversível: DROP das funções/tabelas criadas aqui.

-- 1) Contas internas/teste: ficam fora das listas e do funil -------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_accounts (
  email      TEXT PRIMARY KEY CHECK (email = lower(email)),
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.internal_accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.internal_accounts TO authenticated;
GRANT ALL ON public.internal_accounts TO service_role;
DROP POLICY IF EXISTS "internal accounts team all" ON public.internal_accounts;
CREATE POLICY "internal accounts team all" ON public.internal_accounts FOR ALL TO authenticated
  USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

-- Interna = e-mail de teste (+teste1@...), marcada à mão, ou quem é da equipe (admin/staff).
CREATE OR REPLACE FUNCTION public.is_internal_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT _email IS NOT NULL AND (
    lower(_email) ~ '\+teste[0-9]*@'
    OR EXISTS (SELECT 1 FROM public.internal_accounts i WHERE i.email = lower(_email))
    OR EXISTS (SELECT 1 FROM auth.users u JOIN public.user_roles r ON r.user_id = u.id
               WHERE lower(u.email) = lower(_email) AND r.role IN ('admin', 'staff'))
  );
$$;
REVOKE ALL ON FUNCTION public.is_internal_email(TEXT) FROM PUBLIC, anon, authenticated;

-- 2) Contas e engajamento -------------------------------------------------------------------------
-- quente = e-mail confirmado e voltou depois do cadastro; morno = confirmou e não voltou; nao_confirmado.
CREATE OR REPLACE FUNCTION public.accounts_report()
RETURNS TABLE (
  user_id UUID, email TEXT, created_at TIMESTAMPTZ, confirmed BOOLEAN, last_sign_in_at TIMESTAMPTZ,
  source TEXT, consented BOOLEAN, orders_count BIGINT, paid_orders BIGINT, is_internal BOOLEAN, engagement TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR app_private.is_team(auth.uid())) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::TEXT, u.created_at, (u.email_confirmed_at IS NOT NULL), u.last_sign_in_at,
         COALESCE(p.first_touch ->> 'utm_source', p.first_touch ->> 'referrer_host', 'direto'),
         (mc.marketing_consent_at IS NOT NULL AND mc.marketing_unsubscribed_at IS NULL),
         count(o.id), count(o.id) FILTER (WHERE o.payment_status = 'pago'),
         public.is_internal_email(u.email),
         CASE
           WHEN u.email_confirmed_at IS NULL THEN 'nao_confirmado'
           WHEN u.last_sign_in_at IS NOT NULL AND u.last_sign_in_at > u.email_confirmed_at + interval '30 minutes' THEN 'quente'
           ELSE 'morno'
         END
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.marketing_contacts mc ON lower(mc.email) = lower(u.email)
  LEFT JOIN public.orders o ON lower(o.customer_email) = lower(u.email)
  WHERE u.email IS NOT NULL
  GROUP BY u.id, p.first_touch, mc.marketing_consent_at, mc.marketing_unsubscribed_at
  ORDER BY u.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.accounts_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accounts_report() TO authenticated, service_role;

-- 3) Funil por origem (contagem de eventos no período) --------------------------------------------
CREATE OR REPLACE FUNCTION public.funnel_report(_from DATE, _to DATE, _include_internal BOOLEAN DEFAULT false)
RETURNS TABLE (
  source TEXT, viu_produto BIGINT, contas BIGINT, confirmados BIGINT, checkouts BIGINT,
  pagamentos_iniciados BIGINT, pagos BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT (auth.role() = 'service_role' OR app_private.is_team(auth.uid())) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  RETURN QUERY
  SELECT COALESCE(e.source, 'direto'),
         count(*) FILTER (WHERE e.type = 'produto_visto'),
         count(*) FILTER (WHERE e.type = 'conta_criada'),
         count(*) FILTER (WHERE e.type = 'email_confirmado'),
         count(*) FILTER (WHERE e.type = 'checkout_iniciado'),
         count(*) FILTER (WHERE e.type = 'pagamento_iniciado'),
         count(*) FILTER (WHERE e.type = 'pedido_pago')
  FROM public.events e
  WHERE e.created_at >= _from::timestamptz AND e.created_at < (_to + 1)::timestamptz
    AND (_include_internal OR e.email IS NULL OR NOT public.is_internal_email(e.email))
  GROUP BY 1
  ORDER BY 7 DESC, 2 DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.funnel_report(DATE, DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.funnel_report(DATE, DATE, BOOLEAN) TO authenticated, service_role;

-- 4) Limite de requisições compartilhado entre instâncias (para endpoints sensíveis, não para o /r) ---
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;   -- sem policy: só o servidor (service_role) acessa
GRANT ALL ON public.rate_limits TO service_role;

-- Janela fixa. Devolve true se ainda pode. Apaga janelas velhas de vez em quando.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(_key TEXT, _max INTEGER, _window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / _window_seconds) * _window_seconds);
  n INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  INSERT INTO public.rate_limits (key, window_start, hits) VALUES (_key, w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = public.rate_limits.hits + 1
  RETURNING hits INTO n;
  IF random() < 0.01 THEN DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day'; END IF;
  RETURN n <= _max;
END;
$$;
REVOKE ALL ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(TEXT, INTEGER, INTEGER) TO service_role;
