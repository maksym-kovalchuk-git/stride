// Параметри start_payment_attempt (0012) і expired_date для LiqPay.
// ІНВАРІАНТ: PAYMENT_WINDOW_MINUTES + запас мають бути меншими за таймаут скасування резерву —
// cancel_expired_orders(30) у cron.schedule (supabase/migrations/0011_payment_attempts.sql).
// Змінюєш одне — перевір інше, інакше оплата частіше прилітатиме на вже скасоване замовлення
export const PAYMENT_MAX_ATTEMPTS = 5

// Вікно від створення замовлення; воно ж expired_date форми LiqPay
export const PAYMENT_WINDOW_MINUTES = 25

// Якщо до кінця вікна лишилось менше — нову спробу не даємо, користувач не встигне оплатити
export const PAYMENT_MIN_REMAINING_SECONDS = 120

// Куди браузер надсилає форму з data і signature
export const LIQPAY_CHECKOUT_URL = 'https://www.liqpay.ua/api/3/checkout'

// server_url для LiqPay. Має збігатися з розташуванням route:
// src/app/api/checkout/liqpay_callback/route.ts — інакше callback отримає 404
export const LIQPAY_CALLBACK_PATH = '/api/checkout/liqpay_callback'
