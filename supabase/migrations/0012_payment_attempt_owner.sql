-- start_payment_attempt звіряє власника замовлення з сесією.
-- Нова сигнатура (+ p_user_id): create or replace створив би перевантаження, і стара версія
-- без перевірки власника лишилась би доступною — тому drop і create заново.
-- Транзакція: між drop і create функції немає; якщо create впаде, відкотиться і drop
begin;

drop function public.start_payment_attempt(uuid, int, int, int);

-- Як у 0011, плюс власник: p_user_id — із сесії (null для гостя). Замовлення з user_id платить
-- лише його власник; гостьове (user_id is null) — будь-хто, хто знає uuid. Перевірка — в тому ж
-- update, тож чужа спроба не збільшить лічильник.
--
-- Route → 409: order_already_paid, order_cancelled, payment_window_closed, too_many_attempts,
-- order_not_payable (замовлення є, але after_delivery — карткою не платиться).
-- Route → 404: order_not_found — і для неіснуючого, і для чужого замовлення: не розкриваємо,
-- що замовлення з таким id існує.
-- Причина визначається окремим читанням ПІСЛЯ невдалого update — лише для повідомлення;
-- саме рішення «давати спробу чи ні» вже прийняв атомарний update.
create function public.start_payment_attempt(
  p_order_id uuid,
  p_user_id uuid,
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
  v_owner_id uuid;
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
    -- null = p_user_id дає null, тож гість не пройде на замовлення з власником
    and (o.user_id is null or o.user_id = p_user_id)
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
  select o.status, o.payment_method, o.payment_attempts, o.user_id
  into v_status, v_payment_method, v_attempts, v_owner_id
  from orders o
  where o.id = p_order_id;

  -- Чуже замовлення — так само, як неіснуюче
  if not found or (v_owner_id is not null and v_owner_id is distinct from p_user_id) then
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

-- Supabase знову видає execute anon/authenticated на нову функцію — відкликаємо для нової сигнатури
revoke execute on function public.start_payment_attempt(uuid, uuid, int, int, int)
  from public, anon, authenticated;
grant execute on function public.start_payment_attempt(uuid, uuid, int, int, int)
  to service_role;

commit;
