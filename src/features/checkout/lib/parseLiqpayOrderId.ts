// liqpay_order_id = '<orders.id>-<номер спроби>' (start_payment_attempt, 0011).
// UUID сам містить дефіси, тож не ділимо по '-', а беремо суворий шаблон: рівно uuid, '-', число
const LIQPAY_ORDER_ID_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([1-9]\d{0,5})$/i

// Повертає null для всього, що не відповідає формату. Номер спроби звіряє webhook:
// більший за payment_attempts у базі — відхилити, менший — запізнілий callback, приймається
export function parseLiqpayOrderId(value: string): { orderId: string; attempt: number } | null {
  const match = LIQPAY_ORDER_ID_PATTERN.exec(value)
  if (!match) return null
  return { orderId: match[1].toLowerCase(), attempt: Number(match[2]) }
}
