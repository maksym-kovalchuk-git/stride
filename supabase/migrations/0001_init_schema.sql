-- ============================================
-- 1. ТАБЛИЦІ
-- ============================================

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz default now()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null
);

create table products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id),
  category_id uuid references categories(id),
  name text not null,
  slug text unique not null,
  description text,
  base_price numeric(10,2) not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  size numeric(3,1) not null,
  color text not null,
  sku text unique not null,
  stock integer default 0 not null,
  price_override numeric(10,2),
  created_at timestamptz default now()
);

create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  variant_id uuid references product_variants(id),
  url text not null,
  position integer default 0,
  created_at timestamptz default now()
);

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  city text not null,
  street text not null,
  postal_code text,
  is_default boolean default false
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  address_id uuid references addresses(id),
  status text default 'pending' check (
    status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')
  ),
  total_amount numeric(10,2) not null,
  liqpay_order_id text,
  liqpay_status text,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  variant_id uuid references product_variants(id),
  quantity integer not null,
  price_at_purchase numeric(10,2) not null,
  created_at timestamptz default now()
);

-- ============================================
-- 2. ТРИГЕР: автостворення profile при реєстрації
-- ============================================

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- 3. RLS: увімкнення
-- ============================================

alter table profiles enable row level security;
alter table addresses enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_images enable row level security;
alter table categories enable row level security;
alter table brands enable row level security;

-- ============================================
-- 4. RLS: policies — каталог (публічне читання)
-- ============================================

create policy "Anyone can view active products"
on products for select
using (is_active = true);

create policy "Admins can manage products"
on products for all
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

create policy "Anyone can view variants"
on product_variants for select
using (true);

create policy "Admins can manage variants"
on product_variants for all
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

create policy "Anyone can view product images"
on product_images for select
using (true);

create policy "Admins can manage product images"
on product_images for all
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

create policy "Anyone can view categories"
on categories for select
using (true);

create policy "Admins can manage categories"
on categories for all
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

create policy "Anyone can view brands"
on brands for select
using (true);

create policy "Admins can manage brands"
on brands for all
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

-- ============================================
-- 5. RLS: policies — profiles
-- ============================================

create policy "Users can view own profile"
on profiles for select
using (auth.uid() = id);

create policy "Users can update own profile"
on profiles for update
using (auth.uid() = id);

create policy "Admins can view all profiles"
on profiles for select
using (exists (
  select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
));

-- ============================================
-- 6. RLS: policies — addresses
-- ============================================

create policy "Users can manage own addresses"
on addresses for all
using (auth.uid() = user_id);

-- ============================================
-- 7. RLS: policies — orders
-- ============================================

create policy "Users can view own orders"
on orders for select
using (auth.uid() = user_id);

create policy "Users can create own orders"
on orders for insert
with check (auth.uid() = user_id);

create policy "Admins can view all orders"
on orders for select
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

create policy "Admins can update orders"
on orders for update
using (exists (
  select 1 from profiles where id = auth.uid() and role = 'admin'
));

-- ============================================
-- 8. RLS: policies — order_items
-- ============================================

create policy "Users can view own order items"
on order_items for select
using (exists (
  select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid()
));

create policy "Users can create own order items"
on order_items for insert
with check (exists (
  select 1 from orders where orders.id = order_items.order_id and orders.user_id = auth.uid()
));

-- ============================================
-- 9. Індекси
-- ============================================

create index idx_products_category on products(category_id);
create index idx_variants_product on product_variants(product_id);
create index idx_orders_user on orders(user_id);
create index idx_order_items_order on order_items(order_id);
create index idx_profiles_role on profiles(role);