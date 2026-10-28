import { LIQPAY_API_VERSION, liqpaySignature } from './liqpaySign'

const LIQPAY_STATUS_URL = 'https://www.liqpay.ua/api/request'

export type LiqpayStatusResult =
  | { kind: 'found'; status: string; amount: unknown; currency: unknown; paymentId: unknown }
  | { kind: 'not_found' }
  // мережа, таймаут, 5xx, незрозуміла відповідь
  | { kind: 'unavailable' }

export async function fetchLiqpayStatus(
  liqpayOrderId: string,
  publicKey: string,
  privateKey: string
): Promise<LiqpayStatusResult> {
  const params = { action: 'status', version: LIQPAY_API_VERSION, public_key: publicKey, order_id: liqpayOrderId }
  const data = Buffer.from(JSON.stringify(params)).toString('base64')

  let body: Record<string, unknown>
  try {
    const res = await fetch(LIQPAY_STATUS_URL, {
      method: 'POST',
      body: new URLSearchParams({ data, signature: liqpaySignature(data, privateKey) }),
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    if (!res.ok) return { kind: 'unavailable' }
    body = await res.json()
  } catch {
    return { kind: 'unavailable' }
  }

  if (body.err_code === 'payment_not_found') return { kind: 'not_found' }
  // Відповідь має бути саме про нашу спробу. Поле liqpay_order_id у відповіді — внутрішній id LiqPay,
  // з orders.liqpay_order_id воно не пов'язане: звіряємо order_id
  if (body.order_id !== liqpayOrderId || typeof body.status !== 'string') return { kind: 'unavailable' }
  return { kind: 'found', status: body.status, amount: body.amount, currency: body.currency, paymentId: body.payment_id }
}