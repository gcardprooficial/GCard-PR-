CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION app_private.is_team(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff')) $$;

REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_team(uuid) TO authenticated, service_role;

DROP POLICY "audit team insert" ON public.audit_log;
CREATE POLICY "audit team insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (app_private.is_team(auth.uid()));
DROP POLICY "audit team read" ON public.audit_log;
CREATE POLICY "audit team read" ON public.audit_log FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));

DROP POLICY "batches team all" ON public.batches;
CREATE POLICY "batches team all" ON public.batches FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "businesses team read" ON public.businesses;
CREATE POLICY "businesses team read" ON public.businesses FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));
DROP POLICY "businesses team write" ON public.businesses;
CREATE POLICY "businesses team write" ON public.businesses FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "sessions team read" ON public.checkout_sessions;
CREATE POLICY "sessions team read" ON public.checkout_sessions FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));

DROP POLICY "finance team all" ON public.finance_entries;
CREATE POLICY "finance team all" ON public.finance_entries FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "partners team all" ON public.finance_partners;
CREATE POLICY "partners team all" ON public.finance_partners FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "order items team read" ON public.order_items;
CREATE POLICY "order items team read" ON public.order_items FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));

DROP POLICY "orders team read" ON public.orders;
CREATE POLICY "orders team read" ON public.orders FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));
DROP POLICY "orders team update" ON public.orders;
CREATE POLICY "orders team update" ON public.orders FOR UPDATE TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "packages admin write" ON public.plan_packages;
CREATE POLICY "packages admin write" ON public.plan_packages FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "plans admin write" ON public.plans;
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "scans team read" ON public.plate_scan_events;
CREATE POLICY "scans team read" ON public.plate_scan_events FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));

DROP POLICY "plates team read" ON public.plates;
CREATE POLICY "plates team read" ON public.plates FOR SELECT TO authenticated USING (app_private.is_team(auth.uid()));
DROP POLICY "plates team update" ON public.plates;
CREATE POLICY "plates team update" ON public.plates FOR UPDATE TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "catalog admin write" ON public.products;
CREATE POLICY "catalog admin write" ON public.products FOR ALL TO authenticated USING (app_private.is_team(auth.uid())) WITH CHECK (app_private.is_team(auth.uid()));

DROP POLICY "own profile read" ON public.profiles;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()) OR app_private.is_team(auth.uid()));
DROP POLICY "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid()) OR app_private.has_role(auth.uid(), 'admin')) WITH CHECK ((id = auth.uid()) OR app_private.has_role(auth.uid(), 'admin'));

DROP POLICY "roles read own or team" ON public.user_roles;
CREATE POLICY "roles read own or team" ON public.user_roles FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR app_private.is_team(auth.uid()));

DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_team(uuid);