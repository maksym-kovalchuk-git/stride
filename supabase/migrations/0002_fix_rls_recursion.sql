-- Функція для перевірки адмінської ролі (обходить рекурсію RLS)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Видаляємо старі політики, що спричиняли рекурсію
drop policy if exists "Admins can view all profiles" on profiles;
drop policy if exists "Admins can manage products" on products;
drop policy if exists "Admins can manage variants" on product_variants;
drop policy if exists "Admins can manage product images" on product_images;
drop policy if exists "Admins can manage categories" on categories;
drop policy if exists "Admins can manage brands" on brands;
drop policy if exists "Admins can view all orders" on orders;
drop policy if exists "Admins can update orders" on orders;

-- Створюємо заново, вже через is_admin()
create policy "Admins can view all profiles"
on profiles for select
using (public.is_admin());

create policy "Admins can manage products"
on products for all
using (public.is_admin());

create policy "Admins can manage variants"
on product_variants for all
using (public.is_admin());

create policy "Admins can manage product images"
on product_images for all
using (public.is_admin());

create policy "Admins can manage categories"
on categories for all
using (public.is_admin());

create policy "Admins can manage brands"
on brands for all
using (public.is_admin());

create policy "Admins can view all orders"
on orders for select
using (public.is_admin());

create policy "Admins can update orders"
on orders for update
using (public.is_admin());