-- create_order повертає статус замовлення, а повтор на скасоване замовлення кидає order_cancelled.
-- Тип результату змінюється, а create or replace цього не дозволяє — тому drop і create заново.
-- Транзакція: між drop і create функції немає; якщо create впаде, відкотиться і drop
begin;

drop function public.create_order(uuid, uuid, jsonb, int, text, text, text, text, text, text, text, text);

-- Як у 0008, плюс:
-- Результат містить status; перетворення статусу на nextStep — лише в TS (getNextStep.ts).
-- Помилка клієнта (route → 409): order_cancelled — повтор з тим самим ключем на скасоване замовлення.
-- Ціна = coalesce(price_override, base_price) — та сама формула, що в getVariantPrice.ts, змінювати разом.
-- pg_temp останнім у search_path — як у cancel_order (0009).
create function public.create_order(
  p_user_id uuid,
  p_idempotency_key uuid,
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
returns table (order_id uuid, total_amount numeric, status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- order_id, total_amount і status — вихідні змінні й водночас імена колонок; при збігу беремо колонку
#variable_conflict use_column
declare
  v_variant_ids uuid[];
  v_quantities int[];
  v_request_hash text;
  v_existing_id uuid;
  v_existing_total numeric(10,2);
  v_existing_hash text;
  v_existing_status text;
  v_count int;
  v_total numeric(10,2);
  v_status text;
  v_address_id uuid;
  v_order_id uuid;
begin
  -- Валідація параметрів: Zod ловить це раніше, тож сюди доходить лише баг у нашому коді
  -- unique по nullable колонці пропускає скільки завгодно NULL — без ключа дубль можливий
  if p_idempotency_key is null then
    raise exception 'missing_idempotency_key';
  end if;

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

  -- Злити дублікати й відсортувати за id — потрібно і для хешу, і для порядку блокувань.
  -- Злиття не читає БД, тож повтор через нього не отримає out_of_stock
  select array_agg(s.variant_id order by s.variant_id), array_agg(s.qty order by s.variant_id)
  into v_variant_ids, v_quantities
  from (
    select x.variant_id, sum(x.quantity)::int as qty
    from jsonb_to_recordset(p_items) as x(variant_id uuid, quantity int)
    group by x.variant_id
  ) s;

  -- Хеш із jsonb: порядок ключів нормалізований, роздільники однозначні.
  -- user_id у хеші: чужий ключ з іншим користувачем дає idempotency_conflict, а не чуже замовлення
  v_request_hash := encode(sha256(convert_to(jsonb_build_object(
    'user_id', p_user_id,
    'items', (
      select jsonb_agg(jsonb_build_object('variant_id', i.variant_id, 'quantity', i.qty) order by i.variant_id)
      from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
    ),
    'payment_method', p_payment_method,
    'recipient_first_name', p_recipient_first_name,
    'recipient_last_name', p_recipient_last_name,
    'phone', p_phone,
    'np_city_ref', p_np_city_ref,
    'np_city_name', p_np_city_name,
    'np_branch_ref', p_np_branch_ref,
    'np_branch_name', p_np_branch_name
  )::text, 'UTF8')), 'hex');

  -- Серіалізує одночасні запити з одним ключем; відпускається в кінці транзакції
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  -- Пошук за ключем — до перевірок залишку: інакше повтор на останню пару
  -- отримав би out_of_stock через власний же резерв
  select o.id, o.total_amount, o.request_hash, o.status
  into v_existing_id, v_existing_total, v_existing_hash, v_existing_status
  from orders o
  where o.idempotency_key = p_idempotency_key;

  if found then
    -- Спершу хеш, потім статус: користувач, що змінив дані після таймауту,
    -- має побачити конфлікт, а не «замовлення скасовано»
    if v_existing_hash is distinct from v_request_hash then
      raise exception 'idempotency_conflict';
    end if;
    -- Резерв скасованого замовлення вже повернуто — з цим ключем далі йти нікуди
    if v_existing_status = 'cancelled' then
      raise exception 'order_cancelled';
    end if;
    return query select v_existing_id, v_existing_total, v_existing_status;
    return;
  end if;

  if exists (select 1 from unnest(v_quantities) as q where q > p_max_quantity) then
    raise exception 'quantity_limit';
  end if;

  -- Заблокувати варіанти в порядку id (без join — інакше порядок блокувань непередбачуваний)
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

  -- Перевірки — рядки вже заблоковані, products читаємо окремо
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

  -- Списати залишок; умова stock >= qty — у самому update
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

  insert into addresses (
    user_id, recipient_first_name, recipient_last_name, phone,
    np_city_ref, np_city_name, np_branch_ref, np_branch_name
  )
  values (
    p_user_id, p_recipient_first_name, p_recipient_last_name, p_phone,
    p_np_city_ref, p_np_city_name, p_np_branch_ref, p_np_branch_name
  )
  returning id into v_address_id;

  insert into orders (user_id, address_id, status, payment_method, total_amount, idempotency_key, request_hash)
  values (p_user_id, v_address_id, v_status, p_payment_method, v_total, p_idempotency_key, v_request_hash)
  returning id into v_order_id;

  insert into order_items (order_id, variant_id, quantity, price_at_purchase)
  select v_order_id, i.variant_id, i.qty, coalesce(v.price_override, p.base_price)
  from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
  join product_variants v on v.id = i.variant_id
  join products p on p.id = v.product_id;

  -- У supabase-js — data[0]
  return query select v_order_id, v_total, v_status;
end;
$$;

-- Supabase знову видає execute anon/authenticated на нову функцію — відкликаємо для нової сигнатури
revoke execute on function public.create_order(uuid, uuid, jsonb, int, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, uuid, jsonb, int, text, text, text, text, text, text, text, text)
  to service_role;

commit;
