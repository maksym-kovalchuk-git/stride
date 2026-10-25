-- Дві діри в правах з 0001, знайдені під час рев'ю.
begin;

-- 1. Підвищення до адміна.
-- "Users can update own profile" (0001) дозволяє оновлювати власний рядок profiles, а role лежить
-- у тому самому рядку. RLS вирішує, ЯКІ РЯДКИ можна змінювати, але не ЯКІ КОЛОНКИ: будь-хто міг
-- з консолі браузера виконати update({ role: 'admin' }) і відкрити всі адмінські політики
-- (профілі й замовлення всіх користувачів, керування товарами).
-- Колонки обмежуються привілеями: забираємо update на всю таблицю й даємо лише на безпечні колонки.
-- RLS-політика лишається — вона й далі обмежує рядки власним профілем.
-- role тепер змінюється тільки з Supabase Dashboard або сервера з service-role ключем
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- 2. Замовлення в обхід create_order.
-- Політики insert з 0001 дозволяли напряму вставити в orders рядок зі status = 'paid' і будь-якою
-- сумою — без перевірки цін, залишків, ключа ідемпотентності й оплати; у майбутній адмінці таке
-- замовлення виглядало б оплаченим. create_order — security definer і працює в обхід RLS,
-- тож ці політики йому не потрібні: без них RLS забороняє будь-який insert від клієнта
drop policy "Users can create own orders" on public.orders;
drop policy "Users can create own order items" on public.order_items;

-- Друга лінія захисту: забираємо й сам привілей insert. Якщо колись хтось помилково додасть
-- дозвільну політику, клієнт однаково не зможе вставити замовлення.
-- service_role і власник security definer функцій цим не зачеплені
revoke insert on public.orders, public.order_items from anon, authenticated;

-- 3. Узгодження з правилом з 0009: pg_temp останнім у search_path security definer функцій.
-- handle_new_user (0001) search_path не мав зовсім, is_admin (0002) — без pg_temp.
-- Ризик низький (через Supabase API тимчасову таблицю не створити), але правило має бути одне
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.is_admin() set search_path = public, pg_temp;

commit;
