-- people_summary(): corrige "column reference "email" is ambiguous".
-- A coluna de saída "email" (RETURNS TABLE) colidia com lower(email) das consultas de dentro da função (auth.users,
-- tool_leads, marketing_contacts). A única mudança em relação à migração 20261015020000 é a linha
-- "#variable_conflict use_column" logo depois do AS $$: mesmas colunas de saída, mesma checagem de permissão,
-- mesmo SECURITY DEFINER e search_path.
-- Produção JÁ tem esta correção (aplicada à mão); esta migração a deixa no repositório. Idempotente:
-- CREATE OR REPLACE, e rodar de novo não muda nada.
--
-- Conferir que o arquivo é igual à produção (rode ANTES e DEPOIS desta migração; os dois valores têm de ser iguais):
--   select md5(pg_get_functiondef('public.people_summary()'::regprocedure));

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
#variable_conflict use_column
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
