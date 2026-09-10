-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');
CREATE TYPE public.product_status AS ENUM ('ativo', 'em_breve', 'oculto');
CREATE TYPE public.order_kind AS ENUM ('individual', 'revenda');
CREATE TYPE public.payment_status AS ENUM ('pendente', 'pago', 'recusado', 'estornado', 'cancelado');
CREATE TYPE public.fulfillment_status AS ENUM ('recebido', 'em_producao', 'enviado', 'entregue', 'cancelado');
CREATE TYPE public.plate_status AS ENUM ('nao_ativada', 'ativada', 'bloqueada');
CREATE TYPE public.finance_kind AS ENUM ('entrada', 'saida');
CREATE TYPE public.batch_status AS ENUM ('rascunho', 'produzido', 'vendido');

-- HELPERS
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'staff')
  );
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_team(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "roles read own or team" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team(auth.uid()));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATALOG
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  status public.product_status NOT NULL DEFAULT 'ativo',
  price_delta_cents INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog public read" ON public.products FOR SELECT TO anon, authenticated
  USING (status <> 'oculto');
CREATE POLICY "catalog admin write" ON public.products FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  audience TEXT NOT NULL,
  description TEXT,
  unit_price_cents INTEGER NOT NULL,
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER,
  is_resale BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans public read" ON public.plans FOR SELECT TO anon, authenticated
  USING (is_active);
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));

CREATE TABLE public.plan_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  label TEXT NOT NULL,
  badge TEXT,
  note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_packages TO anon, authenticated;
GRANT ALL ON public.plan_packages TO service_role;
ALTER TABLE public.plan_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages public read" ON public.plan_packages FOR SELECT TO anon, authenticated
  USING (is_active);
CREATE POLICY "packages admin write" ON public.plan_packages FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));

-- BUSINESSES
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  google_place_id TEXT,
  review_url TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  category TEXT,
  rating NUMERIC(2,1),
  reviews_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses team read" ON public.businesses FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));
CREATE POLICY "businesses team write" ON public.businesses FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));

-- CHECKOUT SESSIONS
CREATE TABLE public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  step TEXT NOT NULL DEFAULT 'negocio',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_id UUID,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.checkout_sessions TO service_role;
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions team read" ON public.checkout_sessions FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGSERIAL,
  kind public.order_kind NOT NULL DEFAULT 'individual',
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_document TEXT,
  ship_zip TEXT,
  ship_street TEXT,
  ship_number TEXT,
  ship_complement TEXT,
  ship_district TEXT,
  ship_city TEXT,
  ship_state TEXT,
  business_id UUID REFERENCES public.businesses ON DELETE SET NULL,
  plan_id UUID REFERENCES public.plans ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'pendente',
  fulfillment_status public.fulfillment_status NOT NULL DEFAULT 'recebido',
  payment_provider TEXT NOT NULL DEFAULT 'mercadopago',
  external_reference TEXT UNIQUE,
  provider_payment_id TEXT,
  payment_method TEXT,
  tracking_code TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders team read" ON public.orders FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));
CREATE POLICY "orders team update" ON public.orders FOR UPDATE TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders ON DELETE CASCADE,
  product_id UUID REFERENCES public.products ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order items team read" ON public.order_items FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));

-- BATCHES (fase 2)
CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  status public.batch_status NOT NULL DEFAULT 'rascunho',
  owner_order_id UUID REFERENCES public.orders ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.batches TO authenticated;
GRANT ALL ON public.batches TO service_role;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "batches team all" ON public.batches FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));

-- PLATES
CREATE TABLE public.plates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  product_id UUID REFERENCES public.products ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders ON DELETE SET NULL,
  batch_id UUID REFERENCES public.batches ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses ON DELETE SET NULL,
  status public.plate_status NOT NULL DEFAULT 'nao_ativada',
  destination_url TEXT,
  activated_at TIMESTAMPTZ,
  last_scan_at TIMESTAMPTZ,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.plates TO authenticated;
GRANT ALL ON public.plates TO service_role;
ALTER TABLE public.plates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plates team read" ON public.plates FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));
CREATE POLICY "plates team update" ON public.plates FOR UPDATE TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));
CREATE TRIGGER plates_updated_at BEFORE UPDATE ON public.plates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.plate_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_id UUID REFERENCES public.plates ON DELETE CASCADE,
  token TEXT NOT NULL,
  country TEXT,
  device TEXT,
  referrer_host TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plate_scan_events_plate_idx ON public.plate_scan_events (plate_id, created_at DESC);
GRANT SELECT ON public.plate_scan_events TO authenticated;
GRANT ALL ON public.plate_scan_events TO service_role;
ALTER TABLE public.plate_scan_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scans team read" ON public.plate_scan_events FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));

-- FINANCE
CREATE TABLE public.finance_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  share_percent NUMERIC(5,2) NOT NULL DEFAULT 50,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_partners TO authenticated;
GRANT ALL ON public.finance_partners TO service_role;
ALTER TABLE public.finance_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partners team all" ON public.finance_partners FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));

CREATE TABLE public.finance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.finance_kind NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  partner_id UUID REFERENCES public.finance_partners ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders ON DELETE SET NULL,
  attachment_url TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence TEXT,
  created_by UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX finance_entries_date_idx ON public.finance_entries (entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance team all" ON public.finance_entries FOR ALL TO authenticated
  USING (public.is_team(auth.uid())) WITH CHECK (public.is_team(auth.uid()));
CREATE TRIGGER finance_entries_updated_at BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUDIT LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON public.audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit team read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_team(auth.uid()));
CREATE POLICY "audit team insert" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_team(auth.uid()));

-- SEED: produtos
INSERT INTO public.products (slug, name, format, tagline, description, status, price_delta_cents, sort_order) VALUES
('cartao-bolso', 'Cartão GCard-PRÓ', 'Cartão de bolso 8,5 x 5,4 cm', 'NFC + QR Code em PVC preto premium', 'O cartão que fica no bolso, na maquininha ou na recepção. O cliente aproxima o celular ou escaneia o QR e cai direto na tela de avaliação do seu Google.', 'ativo', 0, 1),
('plaquinha-10x10', 'Plaquinha de balcão 10x10', 'Plaquinha quadrada 10 x 10 cm', 'Fica de pé no balcão, pronta para o cliente', 'Placa quadrada de balcão com acabamento premium e base própria. Ideal para caixa, recepção e balcão de atendimento.', 'ativo', 1000, 2),
('plaquinha-10x15-l', 'Plaquinha de mesa 10x15 em "L"', 'Plaquinha 10 x 15 cm em "L"', 'Em breve', 'Formato em "L" para ficar em cima da mesa, pensado para restaurantes, bares e cafeterias.', 'em_breve', 0, 3);

-- SEED: planos
INSERT INTO public.plans (slug, name, audience, description, unit_price_cents, min_quantity, max_quantity, is_resale, sort_order) VALUES
('lojista', 'Plano Lojista', 'Para usar no seu próprio balcão', 'Você recebe tudo já configurado com o link de avaliação do seu negócio. Pode pedir quantas unidades quiser, sempre pelo mesmo valor por unidade.', 5990, 1, NULL, false, 1),
('renda-extra', 'Pack Renda Extra', 'Para começar a vender para outros negócios', 'Lote com preço de revenda para quem quer criar uma nova fonte de renda vendendo GCard-PRÓ na sua cidade.', 3490, 5, 9, true, 2),
('revenda-vip', 'Clube Revenda VIP', 'Agências, gestores de tráfego e alto volume', 'O melhor custo por unidade, pensado para quem atende carteira de clientes e trabalha com volume.', 2490, 10, NULL, true, 3);

-- SEED: pacotes
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 1, '1 unidade', NULL, 'Ideal para começar', 1 FROM public.plans WHERE slug = 'lojista';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 2, '2 unidades', NULL, 'Balcão e recepção', 2 FROM public.plans WHERE slug = 'lojista';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 3, '3 unidades', 'Mais escolhido', 'Cobre balcão, caixa e mesa', 3 FROM public.plans WHERE slug = 'lojista';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 6, '6 unidades', NULL, 'Para equipes com vários atendentes', 4 FROM public.plans WHERE slug = 'lojista';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 5, 'Lote de 5 unidades', 'Primeiro lote', 'Comece a revender com pouco investimento', 1 FROM public.plans WHERE slug = 'renda-extra';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 9, 'Lote de 9 unidades', 'Melhor giro', 'Estoque para fechar mais clientes', 2 FROM public.plans WHERE slug = 'renda-extra';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 10, 'Lote de 10 unidades', 'Entrada VIP', 'Menor preço por unidade', 1 FROM public.plans WHERE slug = 'revenda-vip';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 20, 'Lote de 20 unidades', 'Para carteira de clientes', 'Volume para agências e franquias', 2 FROM public.plans WHERE slug = 'revenda-vip';
INSERT INTO public.plan_packages (plan_id, quantity, label, badge, note, sort_order)
SELECT id, 50, 'Lote de 50 unidades', 'Operação', 'Escala máxima do clube', 3 FROM public.plans WHERE slug = 'revenda-vip';

-- SEED: sócios
INSERT INTO public.finance_partners (name, share_percent) VALUES
('Leonardo', 50),
('Sócio', 50);