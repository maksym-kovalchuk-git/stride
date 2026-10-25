// Відповідь GET /api/orders/[id]/status — лише те, що потрібно сторінці успіху й банеру
export type OrderStatusResponse = {
  status: string
  liqpayStatus: string | null
  amount: number
  // Чи можна зараз почати нову спробу оплати (сервер однаково перевірить у start_payment_attempt)
  canPay: boolean
}

// Замовлення прийняте: оплачене карткою або накладений платіж
const ACCEPTED_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered'])

// Фінальні неуспішні статуси LiqPay. Скасування користувачем може взагалі не дати callback,
// тож відсутність liqpay_status не означає, що оплата ще йде
const FAILED_LIQPAY_STATUSES = new Set(['failure', 'error', 'reversed'])

export function isAcceptedStatus(status: string): boolean {
  return ACCEPTED_STATUSES.has(status)
}

export function isFailedLiqpayStatus(liqpayStatus: string | null): boolean {
  return liqpayStatus !== null && FAILED_LIQPAY_STATUSES.has(liqpayStatus)
}

export type FetchOrderStatusResult =
  | { kind: 'ok'; data: OrderStatusResponse }
  | { kind: 'not_found' }
  | { kind: 'error' }

export async function fetchOrderStatus(orderId: string): Promise<FetchOrderStatusResult> {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, { cache: 'no-store' })
    if (res.status === 404 || res.status === 400) return { kind: 'not_found' }
    if (!res.ok) return { kind: 'error' }
    return { kind: 'ok', data: (await res.json()) as OrderStatusResponse }
  } catch {
    return { kind: 'error' }
  }
}
