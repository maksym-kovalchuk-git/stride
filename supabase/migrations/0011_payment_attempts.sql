-- Лічильник спроб оплати: LiqPay не приймає повторно order_id навіть після невдалої оплати,
-- тож кожна спроба отримує свій liqpay_order_id = '<orders.id>-<номер спроби>'.
-- orders.liqpay_order_id тримає останню спробу. UUID сам містить дефіси, тож webhook розбирає
-- id суворим регулярним виразом (parseLiqpayOrderId.ts): uuid, '-', номер спроби; номер більший
-- за payment_attempts відхиляє, менший приймає (запізнілий callback попередньої спроби)
begin;

alter table orders
  add column payment_attempts int not null default 0,
  add constraint orders_payment_attempts_nonnegative check (payment_attempts >= 0);

-- Нова спроба оплати. Перевірка й збільшення — в одному update: два паралельні виклики
-- серіалізуються row-lock-ом рядка orders, і другий перевіряє умови вже на оновленому лічильнику.
--
-- Вікно оплати рахується від created_at, а не від now(): повторна спроба не продовжує резерв.
-- Якщо до кінця вікна лишилось менше p_min_remaining_seconds, нову спробу не даємо —
-- користувач не встигне оплатити, а cron скасує замовлення.
--
-- Параметри (ліміт спроб, вікно, запас) приходять з TS — правило живе в одному місці, як MAX_QUANTITY.
--
-- Route → 409: order_already_paid, order_cancelled, payment_window_closed, too_many_attempts,
-- order_not_payable (замовлення є, але after_delivery — карткою не платиться).
-- Route → 404: order_not_found.
-- Причина визначається окремим читанням ПІСЛЯ невдалого update — лише для повідомлення;
-- саме рішення «давати спробу чи ні» вже прийняв атомарний update.
--
-- Перевірку власника замовлення додано в 0012 (нова сигнатура з p_user_id)
create function public.start_payment_attempt(
  p_order_id uuid,
  p_max_attempts int,
  p_window_minutes int,
  p_min_remaining_seconds int
)
returns table (liqpay_order_id text, amount numeric, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- liqpay_order_id — вихідна змінна й водночас колонка orders; при збігу беремо колонку
#variable_conflict use_column
declare
  v_liqpay_order_id text;
  v_amount numeric(10,2);
  v_expires_at timestamptz;
  v_status text;
  v_payment_method text;
  v_attempts int;
begin
  if p_max_attempts is null or p_max_attempts <= 0
    or p_window_minutes is null or p_window_minutes <= 0
    or p_min_remaining_seconds is null or p_min_remaining_seconds < 0 then
    raise exception 'invalid_payment_params';
  end if;

  -- set бачить старі значення рядка, тож номер спроби в id і новий лічильник збігаються
  update orders o
  set payment_attempts = o.payment_attempts + 1,
      liqpay_order_id = o.id::text || '-' || (o.payment_attempts + 1)
  where o.id = p_order_id
    and o.payment_method = 'card_online'
    and o.status = 'pending'
    and o.payment_attempts < p_max_attempts
    and now() < o.created_at
      + make_interval(mins => p_window_minutes)
      - make_interval(secs => p_min_remaining_seconds)
  returning o.liqpay_order_id, o.total_amount, o.created_at + make_interval(mins => p_window_minutes)
  into v_liqpay_order_id, v_amount, v_expires_at;

  if found then
    return query select v_liqpay_order_id, v_amount, v_expires_at;
    return;
  end if;

  -- Спробу не дано — з'ясовуємо чому, лише для повідомлення клієнту
  select o.status, o.payment_method, o.payment_attempts
  into v_status, v_payment_method, v_attempts
  from orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'order_not_found';
  end if;

  if v_payment_method <> 'card_online' then
    raise exception 'order_not_payable';
  end if;

  if v_status in ('paid', 'processing', 'shipped', 'delivered') then
    raise exception 'order_already_paid';
  end if;

  if v_status = 'cancelled' then
    raise exception 'order_cancelled';
  end if;

  if v_attempts >= p_max_attempts then
    raise exception 'too_many_attempts';
  end if;

  raise exception 'payment_window_closed';
end;
$$;

-- Викликатиме route підпису через service_role
revoke execute on function public.start_payment_attempt(uuid, int, int, int)
  from public, anon, authenticated;
grant execute on function public.start_payment_attempt(uuid, int, int, int)
  to service_role;

-- Те саме завдання, що в 0009 (назване — schedule оновлює, а не дублює); перереєстроване тут,
-- щоб інваріант стояв поруч із кодом:
-- ІНВАРІАНТ: вікно оплати + запас (features/checkout/config/payment.ts: 25 хв, 120 с)
-- мають бути меншими за таймаут скасування (30 хв тут) з урахуванням інтервалу cron (5 хв).
-- Змінюєш одне — перевір інше, інакше оплата частіше прилітатиме на вже скасоване замовлення
select cron.schedule(
  'cancel-expired-orders',
  '*/5 * * * *',
  $$select public.cancel_expired_orders(30)$$
);

commit;
