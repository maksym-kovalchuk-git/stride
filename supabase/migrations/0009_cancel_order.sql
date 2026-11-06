-- Пошук прострочених резервів: лише pending card_online, за часом створення
create index idx_orders_pending_card_created
  on orders (created_at)
  where status = 'pending' and payment_method = 'card_online';

-- Скасування замовлення з поверненням залишку. Повертає true, якщо саме цей виклик скасував.
--
-- Правило 1 — статус першим. Умовний update рядка orders — єдиний вхід до повернення залишку.
-- Одночасні виклики (callback LiqPay, cron, адмін) упираються в row-lock цього рядка; після
-- коміту першого другий перечитує рядок, бачить 'cancelled', оновлює 0 рядків і виходить.
-- Тому залишок повертається рівно один раз.
--
-- Правило 2 — варіанти блокуються в порядку id, окремим запитом без join, так само, як
-- у create_order. Інакше скасування і створення замовлення з тими самими варіантами могли б
-- брати блокування в різному порядку і впасти в deadlock.
--
-- shipped і delivered не скасовуються: товар уже не на складі (повернення — окремий процес).
--
-- pg_temp останнім у search_path: інакше Postgres неявно шукає в ньому першим, і тимчасова
-- таблиця з іменем orders чи order_items могла б підмінити справжню в security definer функції.
create function public.cancel_order(p_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cancelled_id uuid;
  v_variant_ids uuid[];
  v_quantities int[];
begin
  update orders
  set status = 'cancelled'
  where id = p_order_id
    and status in ('pending', 'paid', 'processing')
  returning id into v_cancelled_id;

  if v_cancelled_id is null then
    return false;
  end if;

  select array_agg(s.variant_id order by s.variant_id), array_agg(s.qty order by s.variant_id)
  into v_variant_ids, v_quantities
  from (
    select oi.variant_id, sum(oi.quantity)::int as qty
    from order_items oi
    where oi.order_id = p_order_id
      and oi.variant_id is not null
    group by oi.variant_id
  ) s;

  -- Замовлення без позицій: скасовуємо, повертати нічого
  if v_variant_ids is null then
    return true;
  end if;

  perform 1
  from (
    select v.id
    from product_variants v
    where v.id = any(v_variant_ids)
    order by v.id
    for update
  ) locked;

  update product_variants v
  set stock = v.stock + i.qty
  from unnest(v_variant_ids, v_quantities) as i(variant_id, qty)
  where v.id = i.variant_id;

  return true;
end;
$$;

-- Скасування прострочених резервів card_online. Повертає кількість скасованих.
-- Кожне замовлення — у власному блоці begin/exception (subtransaction): помилка відкочує
-- лише його, а цикл іде далі.
create function public.cancel_expired_orders(p_minutes int)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_cancelled int := 0;
begin
  if p_minutes is null or p_minutes <= 0 then
    raise exception 'invalid_minutes';
  end if;

  for v_order_id in
    select o.id
    from orders o
    where o.status = 'pending'
      and o.payment_method = 'card_online'
      and o.created_at < now() - make_interval(mins => p_minutes)
    order by o.created_at
  loop
    begin
      if public.cancel_order(v_order_id) then
        v_cancelled := v_cancelled + 1;
      end if;
    exception when others then
      raise warning 'cancel_expired_orders: order % failed: %', v_order_id, sqlerrm;
    end;
  end loop;

  return v_cancelled;
end;
$$;

-- cancel_order викликатиме webhook через service_role
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid) to service_role;

-- grant не потрібен (cron працює від власника), але revoke потрібен: інакше будь-хто
-- з publishable-ключем викличе через PostgREST cancel_expired_orders(1)
-- і скасує всі pending-замовлення
revoke execute on function public.cancel_expired_orders(int) from public, anon, authenticated;

-- pg_cron має бути увімкнений у Dashboard → Database → Extensions.
-- Назване завдання: повторний schedule з тією ж назвою оновлює його, а не дублює
select cron.schedule(
  'cancel-expired-orders',
  '*/5 * * * *',
  $$select public.cancel_expired_orders(30)$$
);
