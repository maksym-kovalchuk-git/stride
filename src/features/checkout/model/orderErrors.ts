import { MAX_QUANTITY } from '@/shared/config/cart'

// Коди помилок create_order (CLIENT_ERROR_STATUS і resolveDelivery у createOrder.ts) і start_payment_attempt
// (PAYMENT_ERROR_STATUS у startPayment.ts) → текст для користувача.
// order_already_paid тексту не має: форма веде на сторінку успіху
export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  out_of_stock: 'Деяких товарів уже немає в потрібній кількості. Перевірте кошик.',
  variant_unavailable: 'Один із товарів більше недоступний. Видаліть його з кошика.',
  quantity_limit: `Не більше ${MAX_QUANTITY} шт. одного товару в замовленні.`,
  invalid_delivery: 'Вибране відділення не знайдено в цьому місті. Виберіть місто й відділення ще раз.',
  idempotency_conflict: 'Дані замовлення змінилися під час оформлення. Перевірте форму й натисніть ще раз.',
  order_cancelled: 'Час на оплату минув, і замовлення скасовано. Натисніть «Оформити замовлення» ще раз.',
  payment_window_closed: 'Час на оплату цього замовлення минув. Натисніть «Оформити замовлення» ще раз.',
  too_many_attempts: 'Забагато спроб оплати цього замовлення. Натисніть «Оформити замовлення», щоб створити нове.',
  order_not_payable: 'Це замовлення оплачується при отриманні.',
  payment_processing: 'Оплата ще обробляється банком. Зачекайте хвилину й перевірте статус.',
  payment_status_unavailable: 'Не вдалося перевірити попередню оплату. Спробуйте за хвилину.',
}

export const DEFAULT_PAYMENT_ERROR = 'Не вдалося перейти до оплати. Спробуйте ще раз.'

export const DEFAULT_ORDER_ERROR = 'Не вдалося оформити замовлення. Спробуйте ще раз.'

export function getOrderErrorMessage(code: unknown, fallback: string = DEFAULT_ORDER_ERROR): string {
  return typeof code === 'string' && Object.hasOwn(ORDER_ERROR_MESSAGES, code)
    ? ORDER_ERROR_MESSAGES[code]
    : fallback
}
