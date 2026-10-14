import { MAX_QUANTITY } from '@/features/add-to-cart/model/constants'

// Коди помилок create_order (див. CLIENT_ERROR_STATUS у createOrder.ts) → текст для користувача
export const ORDER_ERROR_MESSAGES: Record<string, string> = {
  out_of_stock: 'Деяких товарів уже немає в потрібній кількості. Перевірте кошик.',
  variant_unavailable: 'Один із товарів більше недоступний. Видаліть його з кошика.',
  quantity_limit: `Не більше ${MAX_QUANTITY} шт. одного товару в замовленні.`,
  idempotency_conflict: 'Дані замовлення змінилися під час оформлення. Перевірте форму й натисніть ще раз.',
}

export const DEFAULT_ORDER_ERROR = 'Не вдалося оформити замовлення. Спробуйте ще раз.'

export function getOrderErrorMessage(code: unknown): string {
  return typeof code === 'string' && Object.hasOwn(ORDER_ERROR_MESSAGES, code)
    ? ORDER_ERROR_MESSAGES[code]
    : DEFAULT_ORDER_ERROR
}
