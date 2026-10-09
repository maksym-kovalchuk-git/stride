-- Адреса створюється нова під кожне замовлення, тож ім'я отримувача — частина знімка доставки
alter table addresses
  add column recipient_first_name text,
  add column recipient_last_name text;

alter table orders
  add column payment_method text check (payment_method in ('card_online', 'after_delivery'));

-- Старі (тестові) замовлення створювались лише під онлайн-оплату
update orders set payment_method = 'card_online' where payment_method is null;

alter table orders
  alter column payment_method set not null;
