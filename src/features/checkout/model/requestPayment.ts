import { redirectToLiqpay } from '../lib/redirectToLiqpay'
import { getOrderErrorMessage, DEFAULT_PAYMENT_ERROR } from './orderErrors'
import { clearPendingOrder, setPendingOrder } from './pendingOrder'

export type PaymentRequestResult =
  // браузер іде на LiqPay
  | { kind: 'redirected' }
  // оплату вже підтвердив webhook — показати сторінку успіху
  | { kind: 'already_paid' }
  // попередня спроба ще в банку — нову не даємо, замовлення живе далі
  | { kind: 'processing'; message: string }
  // це замовлення оплатити вже не вийде (скасоване, час минув, забагато спроб, не знайдене)
  | { kind: 'closed'; message: string }
  // тимчасовий збій (мережа, 500): повтор із тим самим замовленням має сенс
  | { kind: 'error'; message: string }

// Нова спроба оплати наявного замовлення: підпис на сервері, потім форма на LiqPay.
// Спільна для форми оформлення, сторінки успіху й банера неоплаченого замовлення
export async function requestPayment(orderId: string): Promise<PaymentRequestResult> {
  let res: Response
  try {
    res = await fetch('/api/checkout/payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
    })
  } catch {
    return { kind: 'error', message: DEFAULT_PAYMENT_ERROR }
  }

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    if (body?.error === 'order_already_paid') return { kind: 'already_paid' }
    // До гілки 409: замовлення не закрите, clearPendingOrder тут не можна
    if (body?.error === 'payment_processing') {
      return { kind: 'processing', message: getOrderErrorMessage(body.error, DEFAULT_PAYMENT_ERROR) }
    }
    if (res.status === 409 || res.status === 404) {
      clearPendingOrder(orderId)
      return { kind: 'closed', message: getOrderErrorMessage(body?.error, DEFAULT_PAYMENT_ERROR) }
    }
    return { kind: 'error', message: getOrderErrorMessage(body?.error, DEFAULT_PAYMENT_ERROR) }
  }

  if (typeof body?.data !== 'string' || typeof body?.signature !== 'string') {
    return { kind: 'error', message: DEFAULT_PAYMENT_ERROR }
  }

  // Запам'ятовуємо до переходу: після «Назад» чи закритої вкладки банер запропонує це замовлення
  setPendingOrder(orderId)
  redirectToLiqpay(body.data, body.signature)
  return { kind: 'redirected' }
}
