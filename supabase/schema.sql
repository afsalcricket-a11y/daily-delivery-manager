-- Daily Delivery Manager – Stage 1 schema. Run once in Supabase > SQL Editor.
-- Every row carries business_id = the owner's auth user id, and RLS restricts
-- each table to that business only.

create table public.businesses (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'My Business',
  phone text,
  currency text not null default 'INR',
  theme text not null default 'light' check (theme in ('light','dark')),
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default auth.uid() references public.businesses(id) on delete cascade,
  name text not null,
  unit text not null default 'unit',
  price numeric(10,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, name)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default auth.uid() references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);

-- Customer-specific rate overrides (falls back to products.price when absent)
create table public.customer_rates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default auth.uid(),
  customer_id uuid not null,
  product_id uuid not null,
  rate numeric(10,2) not null check (rate >= 0),
  unique (customer_id, product_id),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete cascade,
  foreign key (product_id, business_id) references public.products(id, business_id) on delete cascade
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default auth.uid(),
  customer_id uuid not null,
  product_id uuid not null,
  delivery_date date not null default current_date,
  quantity numeric(10,2) not null check (quantity > 0),
  rate numeric(10,2) not null check (rate >= 0),
  amount numeric(12,2) generated always as (quantity * rate) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete restrict,
  foreign key (product_id, business_id) references public.products(id, business_id) on delete restrict
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null default auth.uid(),
  customer_id uuid not null,
  payment_date date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','upi','bank')),
  notes text,
  created_at timestamptz not null default now(),
  foreign key (customer_id, business_id) references public.customers(id, business_id) on delete restrict
);

-- Indexes
create index on public.customers (business_id, name);
create index on public.deliveries (business_id, delivery_date);
create index on public.deliveries (customer_id, delivery_date);
create index on public.payments (business_id, payment_date);
create index on public.payments (customer_id, payment_date);
create index on public.customer_rates (customer_id);

-- Keep updated_at fresh on delivery corrections
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger deliveries_touch before update on public.deliveries
  for each row execute function public.touch_updated_at();

-- Outstanding balance per customer (runs with the caller's RLS)
create view public.customer_balances with (security_invoker = true) as
select c.id as customer_id, c.business_id,
  coalesce((select sum(d.amount) from public.deliveries d where d.customer_id = c.id), 0) as billed,
  coalesce((select sum(p.amount) from public.payments p where p.customer_id = c.id), 0) as paid,
  coalesce((select sum(d.amount) from public.deliveries d where d.customer_id = c.id), 0)
  - coalesce((select sum(p.amount) from public.payments p where p.customer_id = c.id), 0) as balance
from public.customers c;

-- Row Level Security: a business only sees and changes its own rows
alter table public.businesses enable row level security;
create policy "own business" on public.businesses
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['products','customers','customer_rates','deliveries','payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all to authenticated
                    using (business_id = auth.uid()) with check (business_id = auth.uid())', t);
  end loop;
end $$;

-- On sign-up: create the business and seed Water Can + Milk
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.businesses (id, name, phone)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'business_name',''), 'My Business'),
          new.raw_user_meta_data->>'phone');
  insert into public.products (business_id, name, unit, price) values
    (new.id, 'Water Can', 'can', 30),
    (new.id, 'Milk', 'litre', 60);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
