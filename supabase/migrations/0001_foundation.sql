-- =============================================================================
-- orbita — fundação (2026-09-10)
-- Negócio de placas físicas com QR/NFC pra avaliação Google. Sociedade 50/50.
-- Adaptado do módulo que foi tirado do Toqy (prefixo toqy_plate_ -> plate_).
--
-- Blocos:
--   A) profiles + papéis (admin / staff / customer)
--   B) módulo de placas (catálogo, pedidos, lotes, unidades, ativação, redirect)
--   C) módulo financeiro (sócios, lançamentos entrada/saída, fechamento)
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- A) PROFILES
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'customer' check (role in ('admin', 'staff', 'customer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select using (id = auth.uid());

-- staff/admin veem todos os profiles
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'staff')));

-- Cria profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: o usuário atual é admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff_or_admin()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'staff'));
$$;

-- ---------------------------------------------------------------------------
-- B) MÓDULO DE PLACAS
-- ---------------------------------------------------------------------------
create table if not exists public.plate_product_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  format text not null check (format in ('business_card', 'square_10', 'l_stand_10x15', 'other')),
  technology text not null default 'qr_nfc' check (technology in ('qr', 'nfc', 'qr_nfc')),
  unit_price numeric not null default 0,
  unit_cost numeric not null default 0,        -- custo de fabricação (usado no financeiro)
  active boolean not null default true,
  coming_soon boolean not null default false,
  stock_quantity integer,
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.plate_product_types enable row level security;
grant select on public.plate_product_types to anon, authenticated;
grant all on public.plate_product_types to service_role;
drop policy if exists plate_product_types_public_read on public.plate_product_types;
create policy plate_product_types_public_read on public.plate_product_types for select using (active = true);

create table if not exists public.plate_orders (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles(id) on delete set null,
  customer_email text,
  customer_name text,
  order_type text not null check (order_type in ('individual', 'reseller')),
  status text not null default 'draft' check (status in ('draft','pending_payment','paid','processing','manufacturing','ready_to_ship','shipped','delivered','completed','cancelled','refunded')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  subtotal numeric not null default 0,
  shipping_cost numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  shipping_snapshot jsonb,
  customer_notes text,
  provider text,
  provider_order_id text,
  tracking_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plate_orders_owner_idx on public.plate_orders (owner_profile_id);
create index if not exists plate_orders_provider_idx on public.plate_orders (provider, provider_order_id);
alter table public.plate_orders enable row level security;
grant select on public.plate_orders to authenticated;
grant all on public.plate_orders to service_role;
drop policy if exists plate_orders_read on public.plate_orders;
create policy plate_orders_read on public.plate_orders for select
  using (owner_profile_id = auth.uid() or public.is_staff_or_admin());

create table if not exists public.plate_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.plate_orders(id) on delete cascade,
  product_type_id uuid not null references public.plate_product_types(id),
  quantity integer not null check (quantity > 0),
  unit_price_snapshot numeric not null,
  batch_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists plate_order_items_order_idx on public.plate_order_items (order_id);
alter table public.plate_order_items enable row level security;
grant select on public.plate_order_items to authenticated;
grant all on public.plate_order_items to service_role;
drop policy if exists plate_order_items_read on public.plate_order_items;
create policy plate_order_items_read on public.plate_order_items for select
  using (order_id in (select id from public.plate_orders where owner_profile_id = auth.uid()) or public.is_staff_or_admin());

create table if not exists public.plate_batches (
  id uuid primary key default gen_random_uuid(),
  batch_code text not null unique,
  buyer_profile_id uuid references public.profiles(id) on delete set null,
  order_id uuid not null references public.plate_orders(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  activated_quantity integer not null default 0,
  status text not null default 'reserved' check (status in ('reserved','manufacturing','in_stock','shipped','delivered','cancelled')),
  generated_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists plate_batches_order_uidx on public.plate_batches (order_id);
create index if not exists plate_batches_buyer_idx on public.plate_batches (buyer_profile_id);
alter table public.plate_batches enable row level security;
grant select on public.plate_batches to authenticated;
grant all on public.plate_batches to service_role;
drop policy if exists plate_batches_read on public.plate_batches;
create policy plate_batches_read on public.plate_batches for select
  using (buyer_profile_id = auth.uid() or public.is_staff_or_admin());

create table if not exists public.plate_units (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.plate_batches(id) on delete cascade,
  order_id uuid not null references public.plate_orders(id) on delete cascade,
  product_type_id uuid not null references public.plate_product_types(id),
  internal_serial integer not null,
  public_token text not null unique,
  activation_code_hash text,
  activation_code_last4 text,
  status text not null default 'reserved' check (status in ('reserved','manufacturing','in_stock','shipped','available_for_activation','activated','suspended','cancelled','blocked')),
  activated_at timestamptz,
  activated_by_profile_id uuid references public.profiles(id),
  final_business_id uuid,
  failed_activation_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plate_units_batch_idx on public.plate_units (batch_id);
create index if not exists plate_units_order_idx on public.plate_units (order_id);
create index if not exists plate_units_token_idx on public.plate_units (public_token);
alter table public.plate_units enable row level security;
grant select on public.plate_units to authenticated;
grant all on public.plate_units to service_role;
drop policy if exists plate_units_read on public.plate_units;
create policy plate_units_read on public.plate_units for select
  using (order_id in (select id from public.plate_orders where owner_profile_id = auth.uid()) or public.is_staff_or_admin());

create table if not exists public.plate_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  google_place_id text,
  google_business_name text,
  google_review_url text,
  business_name text not null,
  category text,
  logo_url text,
  phone text,
  whatsapp text,
  address text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists plate_businesses_owner_idx on public.plate_businesses (owner_profile_id);
alter table public.plate_businesses enable row level security;
grant select on public.plate_businesses to authenticated;
grant all on public.plate_businesses to service_role;
drop policy if exists plate_businesses_read on public.plate_businesses;
create policy plate_businesses_read on public.plate_businesses for select
  using (owner_profile_id = auth.uid() or public.is_staff_or_admin());

create table if not exists public.plate_destinations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.plate_units(id) on delete cascade,
  destination_url text not null,
  destination_type text not null default 'google_review' check (destination_type in ('google_review','custom')),
  is_active boolean not null default true,
  changed_by_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists plate_destinations_unit_idx on public.plate_destinations (unit_id);
create index if not exists plate_destinations_active_idx on public.plate_destinations (unit_id) where is_active = true;
alter table public.plate_destinations enable row level security;
grant select on public.plate_destinations to authenticated;
grant all on public.plate_destinations to service_role;
drop policy if exists plate_destinations_read on public.plate_destinations;
create policy plate_destinations_read on public.plate_destinations for select
  using (unit_id in (select u.id from public.plate_units u join public.plate_orders o on o.id = u.order_id where o.owner_profile_id = auth.uid()) or public.is_staff_or_admin());

create table if not exists public.plate_activations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.plate_units(id) on delete cascade,
  business_id uuid not null references public.plate_businesses(id),
  reseller_profile_id uuid references public.profiles(id),
  activation_code_last4 text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists plate_activations_unit_idx on public.plate_activations (unit_id);
alter table public.plate_activations enable row level security;
grant select on public.plate_activations to authenticated;
grant all on public.plate_activations to service_role;
drop policy if exists plate_activations_read on public.plate_activations;
create policy plate_activations_read on public.plate_activations for select
  using (reseller_profile_id = auth.uid() or public.is_staff_or_admin());

create table if not exists public.plate_scan_events (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.plate_units(id) on delete cascade,
  event_type text not null check (event_type in ('qr_scan','nfc_open','redirect','activation_page_view')),
  referrer text,
  device_type text,
  created_at timestamptz not null default now()
);
create index if not exists plate_scan_events_unit_idx on public.plate_scan_events (unit_id, created_at);
alter table public.plate_scan_events enable row level security;
grant all on public.plate_scan_events to service_role;

create table if not exists public.plate_funnel_events (
  id uuid primary key default gen_random_uuid(),
  session_key text,
  event_type text not null,
  profile_id uuid references public.profiles(id),
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists plate_funnel_events_type_idx on public.plate_funnel_events (event_type, created_at);
alter table public.plate_funnel_events enable row level security;
grant all on public.plate_funnel_events to service_role;

create table if not exists public.plate_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index if not exists plate_audit_log_entity_idx on public.plate_audit_log (entity_type, entity_id, created_at);
alter table public.plate_audit_log enable row level security;
grant select on public.plate_audit_log to authenticated;
grant all on public.plate_audit_log to service_role;
drop policy if exists plate_audit_log_admin_read on public.plate_audit_log;
create policy plate_audit_log_admin_read on public.plate_audit_log for select using (public.is_staff_or_admin());

create or replace function public.plate_audit_status_change()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.plate_audit_log (entity_type, entity_id, action, before, after)
    values (tg_argv[0], new.id, 'status_change', jsonb_build_object('status', old.status), jsonb_build_object('status', new.status));
  end if;
  return new;
end;
$$;
drop trigger if exists plate_orders_audit on public.plate_orders;
create trigger plate_orders_audit after update on public.plate_orders for each row execute function public.plate_audit_status_change('order');
drop trigger if exists plate_units_audit on public.plate_units;
create trigger plate_units_audit after update on public.plate_units for each row execute function public.plate_audit_status_change('unit');
drop trigger if exists plate_batches_audit on public.plate_batches;
create trigger plate_batches_audit after update on public.plate_batches for each row execute function public.plate_audit_status_change('batch');

create or replace function public.generate_plate_batch(p_order_id uuid, p_quantity integer, p_product_type_id uuid)
returns table (internal_serial integer, activation_code text, public_token text)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_order public.plate_orders%rowtype;
  v_batch_id uuid;
  v_batch_code text;
  v_token text;
  v_code text;
  i integer;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  select * into v_order from public.plate_orders where id = p_order_id;
  if not found then raise exception 'pedido % nao existe', p_order_id; end if;
  if v_order.order_type <> 'reseller' then raise exception 'pedido % nao e reseller', p_order_id; end if;
  if v_order.payment_status <> 'paid' then raise exception 'pedido % nao esta pago', p_order_id; end if;
  if exists (select 1 from public.plate_batches where order_id = p_order_id) then raise exception 'pedido % ja tem lote gerado', p_order_id; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then raise exception 'quantidade invalida: %', p_quantity; end if;

  loop
    v_batch_code := 'LOTE-' || (select string_agg(substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(v_alphabet)), 1), '') from generate_series(1, 8));
    exit when not exists (select 1 from public.plate_batches where batch_code = v_batch_code);
  end loop;

  insert into public.plate_batches (batch_code, buyer_profile_id, order_id, quantity, status, generated_at)
  values (v_batch_code, v_order.owner_profile_id, p_order_id, p_quantity, 'manufacturing', now())
  returning id into v_batch_id;

  for i in 1..p_quantity loop
    loop
      v_token := (select string_agg(substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(v_alphabet)), 1), '') from generate_series(1, 20));
      v_code := (select string_agg(substr(v_alphabet, 1 + (get_byte(gen_random_bytes(1), 0) % length(v_alphabet)), 1), '') from generate_series(1, 8));
      begin
        insert into public.plate_units (batch_id, order_id, product_type_id, internal_serial, public_token, activation_code_hash, activation_code_last4, status)
        values (v_batch_id, p_order_id, p_product_type_id, i, v_token, crypt(v_code, gen_salt('bf')), right(v_code, 4), 'available_for_activation');
        exit;
      exception when unique_violation then
      end;
    end loop;
    internal_serial := i;
    activation_code := v_code;
    public_token := v_token;
    return next;
  end loop;
end;
$$;
revoke all on function public.generate_plate_batch(uuid, integer, uuid) from public;
grant execute on function public.generate_plate_batch(uuid, integer, uuid) to service_role;

insert into public.plate_product_types (name, slug, description, format, technology, unit_price, active, coming_soon)
values
  ('Cartão de visita', 'cartao-de-visita', 'Cartão no tamanho de cartão de visita, com QR Code e chip NFC pra avaliação no Google.', 'business_card', 'qr_nfc', 0, true, false),
  ('Plaquinha quadrada 10x10', 'plaquinha-quadrada-10x10', 'Adesiva, 10x10 cm, pra colar no balcão ou parede. QR Code + NFC.', 'square_10', 'qr_nfc', 0, true, false),
  ('Plaquinha 10x15 em L', 'plaquinha-l-10x15', 'De mesa, formato L, 10x15 cm. QR Code + NFC.', 'l_stand_10x15', 'qr_nfc', 0, true, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- C) MÓDULO FINANCEIRO (só admin)
-- ---------------------------------------------------------------------------
create table if not exists public.finance_partners (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  share_percent numeric not null default 50 check (share_percent >= 0 and share_percent <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.finance_partners enable row level security;
grant select on public.finance_partners to authenticated;
grant all on public.finance_partners to service_role;
drop policy if exists finance_partners_admin on public.finance_partners;
create policy finance_partners_admin on public.finance_partners for select using (public.is_admin());

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('in', 'out')),
  category text not null check (category in (
    'venda', 'materia_prima', 'embalagem', 'impressao', 'nfc_chip', 'frete',
    'taxa_pagamento', 'api_google', 'api_claude', 'api_outro', 'anuncio',
    'ferramenta_software', 'pro_labore', 'imposto', 'outro'
  )),
  amount numeric not null check (amount >= 0),
  description text not null,
  entry_date date not null default current_date,
  paid_by_partner_id uuid references public.finance_partners(id) on delete set null,
  order_id uuid references public.plate_orders(id) on delete set null,   -- liga uma venda/custo a um pedido
  attachment_url text,                                                   -- nota/comprovante
  is_recurring boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists finance_entries_date_idx on public.finance_entries (entry_date);
create index if not exists finance_entries_kind_cat_idx on public.finance_entries (kind, category);
alter table public.finance_entries enable row level security;
grant select on public.finance_entries to authenticated;
grant all on public.finance_entries to service_role;
drop policy if exists finance_entries_admin on public.finance_entries;
create policy finance_entries_admin on public.finance_entries for select using (public.is_admin());

create table if not exists public.finance_closings (
  id uuid primary key default gen_random_uuid(),
  period_month date not null unique,          -- primeiro dia do mês fechado
  total_in numeric not null default 0,
  total_out numeric not null default 0,
  profit numeric not null default 0,
  settled boolean not null default false,
  settled_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.finance_closings enable row level security;
grant select on public.finance_closings to authenticated;
grant all on public.finance_closings to service_role;
drop policy if exists finance_closings_admin on public.finance_closings;
create policy finance_closings_admin on public.finance_closings for select using (public.is_admin());

comment on table public.finance_entries is 'Toda movimentação financeira do negócio (entrada/saída). Só admin lê. Escrita via service_role (rotas de API validam papel).';
comment on table public.finance_partners is 'Sócios e o % de participação no lucro. Fechamento mensal usa isso pra dividir.';
