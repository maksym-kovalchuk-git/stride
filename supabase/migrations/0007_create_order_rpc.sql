-- Остання страховка: залишок не може піти в мінус, хоч би що зламалось у логіці
alter table product_variants
  add constraint product_variants_stock_nonnegative check (stock >= 0);

-- Створення замовлення в одній транзакції: резерв залишку + адреса + замовлення + позиції.
-- Ціна = coalesce(price_override, base_price) — та сама формула, що в getVariantPrice.ts, змінювати разом.
-- Помилки клієнта (route → 400): variant_unavailable, out_of_stock, quantity_limit.
-- Помилки нашого коду (route → 500): empty_order, invalid_item, invalid_max_quantity, invalid_payment_method.
create or replace function public.create_order(
  p_user_id uuid,
  p_items jsonb,
  p_max_quantity int,
  p_payment_method text,
  p_recipient_first_name text,
  p_recipient_last_name text,
  p_phone text,
  p_np_city_ref text,
  p_np_city_name text,
  p_np_branch_ref text,
  p_np_branch_name text
)
returns table (order_id uuid, total_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
-- order_id і total_amount — вихідні змінні й водночас імена колонок; при збігу беремо колонку
#variable_conflict use_column
declare
  v_variant_ids uuid[];
  v_quantities int[];
  v_count int;
  v_total numeric(10,2);
  v_status text;
  v_address_id uuid;
  v_order_id uuid;
begin
  -- Захисні перевірки: Zod ловить це раніше, тож сюди доходить лише баг у нашому коді
  if p_max_quantity is null or p_max_quantity <= 0 then
    raise exception 'invalid_max_quantity';
  end if;

  if p_payment_method is null or p_payment_method not in ('card_online', 'after_delivery') then
    raise exception 'invalid_payment_method';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;

  -- Від'ємна кількість у stock - q збільшила б залишок, тому перевіряємо кожен рядок до злиття
  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity int)
    where x.variant_id is null or x.quantity is null or x.quantity <= 0
  ) then
    raise exception 'invalid_item';
  end if;

  -- 1. Злити дублікати: масиви id та кількостей, відсортовані за id
  select array_agg(s.variant_id order by s.variant_id), array_agg(s.qty order by s.variant_id)
  into v_variant_ids, v_quantities
  from (
    select x.variant_id, sum(x.quantity)::int as qty
    from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity int)
    group by x.variant_id
  ) s;

  if exists (select 1 from unnest(v_quantities) as q where q > p_max_quantity) then
    raise exception 'quantity_limit';
  end if;

  -- 2. Заблокувати варіанти в порядку id (без join — інакше порядок блокувань непередбачуваний)
  select count(*) into v_count
  from (
    select v.id
    from product_variants v
    where v.id = any(v_variant_ids)
    order by v.id
    for update
  ) locked;

  if v_count <> cardinality(v_variant_ids) then
    raise exception 'variant_unavailable';
  end if;

  -- 3. Перевірки — рядки вже заблоковані, products читаємо окремо
  if exists (
    select 1
    from product_variants v
    left join products p on p.id = v.product_id
    where v.id = any(v_variant_ids)
      and (p.id is null or not coalesce(p.is_active, false))
  ) then
    raise exception 'variant_unavailable';
  end if;

  if exists (
    select 1
    from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
    join product_variants v on v.id = i.variant_id
    where v.stock < i.qty
  ) then
    raise exception 'out_of_stock';
  end if;

  select sum(coalesce(v.price_override, p.base_price) * i.qty)
  into v_total
  from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
  join product_variants v on v.id = i.variant_id
  join products p on p.id = v.product_id;

  -- 4. Списати залишок; умова stock >= qty — у самому update
  update product_variants v
  set stock = v.stock - i.qty
  from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
  where v.id = i.variant_id
    and v.stock >= i.qty;

  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_variant_ids) then
    raise exception 'out_of_stock';
  end if;

  -- Статус визначає функція, а не клієнт: накладений платіж не чекає LiqPay
  v_status := case p_payment_method when 'after_delivery' then 'processing' else 'pending' end;

  -- 5. Адреса, замовлення, позиції
  insert into addresses (
    user_id, recipient_first_name, recipient_last_name, phone,
    np_city_ref, np_city_name, np_branch_ref, np_branch_name
  )
  values (
    p_user_id, p_recipient_first_name, p_recipient_last_name, p_phone,
    p_np_city_ref, p_np_city_name, p_np_branch_ref, p_np_branch_name
  )
  returning id into v_address_id;

  insert into orders (user_id, address_id, status, payment_method, total_amount)
  values (p_user_id, v_address_id, v_status, p_payment_method, v_total)
  returning id into v_order_id;

  insert into order_items (order_id, variant_id, quantity, price_at_purchase)
  select v_order_id, i.variant_id, i.qty, coalesce(v.price_override, p.base_price)
  from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
  join product_variants v on v.id = i.variant_id
  join products p on p.id = v.product_id;

  -- 6. Результат (у supabase-js — data[0])
  return query select v_order_id, v_total;
end;
$$;

-- Нова функція за замовчуванням доступна PUBLIC, а Supabase ще й явно дає execute anon/authenticated
revoke execute on function public.create_order(uuid, jsonb, int, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, jsonb, int, text, text, text, text, text, text, text, text)
  to service_role;
