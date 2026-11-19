create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  phone_number text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 30),
  recipient_name text not null check (char_length(recipient_name) between 1 and 80),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  address text not null check (char_length(address) between 1 and 300),
  city text not null check (char_length(city) between 1 and 80),
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  personalized_recommendations boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null check (char_length(name) between 1 and 60),
  slug text not null unique check (char_length(slug) between 1 and 100),
  image_url text not null default '',
  image_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category_id text not null references public.categories (id) on update cascade on delete restrict,
  brand text not null default '' check (char_length(brand) <= 80),
  description text not null default '' check (char_length(description) <= 1000),
  mrp numeric(12, 2) not null check (mrp > 0),
  price numeric(12, 2) not null check (price > 0 and price <= mrp),
  discount integer not null default 0 check (discount between 0 and 100),
  weight text not null check (char_length(weight) between 1 and 40),
  stock_quantity integer not null default 0 check (stock_quantity between 0 and 1000000),
  status text not null default 'active' check (status in ('active', 'inactive')),
  featured boolean not null default false,
  image_url text not null default '',
  image_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key default 'store' check (id = 'store'),
  store_name text not null default 'Inder General Store',
  address text not null default 'KH-1047, Kadipur, New Delhi, Delhi, 110036, India',
  phone text not null default '9289648518',
  alternate_phone text not null default '8882494580',
  email text not null default 'itsshalini007@gmail.com',
  opening_days text not null default 'Monday to Sunday',
  opening_time text not null default '6:00 AM',
  closing_time text not null default '10:00 PM',
  delivery_available boolean not null default true,
  delivery_area text not null default 'Kadipur and nearby areas',
  delivery_charge numeric(12, 2) check (delivery_charge is null or delivery_charge >= 0),
  minimum_order numeric(12, 2) check (minimum_order is null or minimum_order >= 0),
  delivery_schedule text not null default 'Same-day delivery',
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id)
values ('store')
on conflict (id) do nothing;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  mobile_number text not null check (char_length(mobile_number) between 8 and 20),
  delivery_address jsonb not null check (jsonb_typeof(delivery_address) = 'object'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_charge numeric(12, 2) not null default 0 check (delivery_charge >= 0),
  total numeric(12, 2) not null check (total >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'processing', 'out for delivery', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity between 1 and 1000),
  unit_price numeric(12, 2) not null check (unit_price > 0),
  weight text not null default ''
);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_public_catalog_idx on public.products (status, name);
create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists addresses_user_id_idx on public.addresses (user_id);

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;

create or replace function public.sync_auth_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.phone, '')
  )
  on conflict (id) do update
  set display_name = case
        when coalesce(new.raw_user_meta_data ->> 'display_name', '') <> ''
          then new.raw_user_meta_data ->> 'display_name'
        else profiles.display_name
      end,
      phone_number = excluded.phone_number,
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
  after insert or update on auth.users
  for each row execute function public.sync_auth_profile();

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.customer_preferences enable row level security;
alter table public.admin_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Profiles readable by owner or admin" on public.profiles;
create policy "Profiles readable by owner or admin"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_store_admin()));

drop policy if exists "Customers update own display name" on public.profiles;
create policy "Customers update own display name"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

drop policy if exists "Customers manage their own addresses" on public.addresses;
create policy "Customers manage their own addresses"
  on public.addresses for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.addresses from public, anon, authenticated;
grant select, insert, update, delete on public.addresses to authenticated;

drop policy if exists "Customers manage their own preferences" on public.customer_preferences;
create policy "Customers manage their own preferences"
  on public.customer_preferences for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.customer_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.customer_preferences to authenticated;

drop policy if exists "Admins can view admin assignments" on public.admin_users;
create policy "Admins can view admin assignments"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_store_admin()));
revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to authenticated;

drop policy if exists "Categories are publicly readable" on public.categories;
create policy "Categories are publicly readable"
  on public.categories for select to anon, authenticated
  using (true);
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
  on public.categories for all to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
revoke all on public.categories from public, anon, authenticated;
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

drop policy if exists "Active products are publicly readable" on public.products;
create policy "Active products are publicly readable"
  on public.products for select to anon, authenticated
  using (status = 'active' or (select public.is_store_admin()));
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
  on public.products for all to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
revoke all on public.products from public, anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

drop policy if exists "Store settings are publicly readable" on public.store_settings;
create policy "Store settings are publicly readable"
  on public.store_settings for select to anon, authenticated
  using (id = 'store');
drop policy if exists "Admins manage store settings" on public.store_settings;
create policy "Admins manage store settings"
  on public.store_settings for all to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
revoke all on public.store_settings from public, anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant insert, update, delete on public.store_settings to authenticated;

drop policy if exists "Customers and admins read orders" on public.orders;
create policy "Customers and admins read orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_store_admin()));
drop policy if exists "Admins update order status" on public.orders;
create policy "Admins update order status"
  on public.orders for update to authenticated
  using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
revoke all on public.orders from public, anon, authenticated;
grant select on public.orders to authenticated;
grant update (status, updated_at) on public.orders to authenticated;

drop policy if exists "Customers and admins read order items" on public.order_items;
create policy "Customers and admins read order items"
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and (orders.user_id = (select auth.uid()) or (select public.is_store_admin()))
    )
  );
revoke all on public.order_items from public, anon, authenticated;
grant select on public.order_items to authenticated;

create or replace function public.place_store_order(
  p_customer_name text,
  p_mobile_number text,
  p_delivery_address jsonb,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order_id uuid := gen_random_uuid();
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(12, 2) := 0;
  v_delivery_charge numeric(12, 2) := 0;
  v_minimum_order numeric(12, 2);
  v_delivery_available boolean;
begin
  if v_user_id is null then
    raise exception 'Sign in is required to place an order.';
  end if;
  if char_length(trim(p_customer_name)) not between 1 and 80
    or char_length(trim(p_mobile_number)) not between 8 and 20
    or jsonb_typeof(p_delivery_address) <> 'object'
    or char_length(trim(coalesce(p_delivery_address ->> 'address', ''))) not between 1 and 300
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 100 then
    raise exception 'Order details are invalid.';
  end if;

  select delivery_available, delivery_charge, minimum_order
    into v_delivery_available, v_delivery_charge, v_minimum_order
    from public.store_settings
    where id = 'store';
  if not found or not v_delivery_available then
    raise exception 'Home delivery is currently unavailable.';
  end if;
  v_delivery_charge := coalesce(v_delivery_charge, 0);

  insert into public.orders (
    id, user_id, customer_name, mobile_number, delivery_address,
    subtotal, delivery_charge, total
  ) values (
    v_order_id, v_user_id, trim(p_customer_name), trim(p_mobile_number),
    p_delivery_address, 0, v_delivery_charge, v_delivery_charge
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if not (v_item ? 'product_id') or not (v_item ? 'quantity') then
      raise exception 'An order item is missing required details.';
    end if;
    if (v_item ->> 'quantity') !~ '^[0-9]{1,4}$' then
      raise exception 'An order quantity is invalid.';
    end if;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 1000 then
      raise exception 'An order quantity is outside the allowed range.';
    end if;

    select * into v_product
      from public.products
      where id = (v_item ->> 'product_id')::uuid
      for update;
    if not found or v_product.status <> 'active' or v_product.stock_quantity < v_quantity then
      raise exception 'A product is unavailable or has insufficient stock.';
    end if;

    update public.products
      set stock_quantity = stock_quantity - v_quantity,
          updated_at = now()
      where id = v_product.id;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);

    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price, weight
    ) values (
      v_order_id, v_product.id, v_product.name, v_quantity, v_product.price, v_product.weight
    );
  end loop;

  if v_minimum_order is not null and v_subtotal < v_minimum_order then
    raise exception 'The order does not meet the current minimum order amount.';
  end if;

  update public.orders
    set subtotal = v_subtotal,
        total = v_subtotal + v_delivery_charge
    where id = v_order_id;

  return v_order_id;
end;
$$;

revoke all on function public.place_store_order(text, text, jsonb, jsonb) from public;
grant execute on function public.place_store_order(text, text, jsonb, jsonb) to authenticated;
revoke all on function public.sync_auth_profile() from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');
drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_store_admin())
    and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
  );
drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_store_admin()))
  with check (
    bucket_id = 'product-images'
    and (select public.is_store_admin())
    and coalesce((metadata ->> 'size')::bigint, 0) <= 5242880
  );
drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_store_admin()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
  ) then
    alter publication supabase_realtime add table public.categories;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'store_settings'
  ) then
    alter publication supabase_realtime add table public.store_settings;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
