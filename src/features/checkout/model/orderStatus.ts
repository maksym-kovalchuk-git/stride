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

export function isAcceptedStatus(status: string): boolean {
  return ACCEPTED_STATUSES.has(status)
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
