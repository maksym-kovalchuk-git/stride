import 'server-only'

import { createAdminClient } from '@/shared/lib/supabase/admin'

import { fetchLiqpayStatus } from '../lib/liqpayStatus'
import { parseLiqpayOrderId } from '../lib/parseLiqpayOrderId'
import { applyLiqpayResult, type ApplyResult } from './applyLiqpayResult'

export type ReconcileResult =
  // liqpayStatus потрібен викликачу: 'recorded' однаково і для відмови, і для «ще обробляється»
  | { kind: 'applied'; result: ApplyResult; liqpayStatus: string }
  | { kind: 'not_found' }
  // LiqPay недоступний або дані в базі не дають його спитати
  | { kind: 'unavailable' }
  // не картка або спроб оплати ще не було
  | { kind: 'skipped' }

// Звіряє останню спробу оплати з LiqPay і записує відповідь, як записав би callback.
// Статус замовлення не фільтрує: що звіряти, вирішує викликач
export async function reconcileOrder(orderId: string, publicKey: string, privateKey: string): Promise<ReconcileResult> {
  const supabase = createAdminClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('payment_method, payment_attempts, liqpay_order_id')
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw new Error(`reconcileOrder: failed to read order ${orderId}`, { cause: error })
  }

  if (
    !order ||
    order.payment_method !== 'card_online' ||
    order.payment_attempts === 0 ||
    !order.liqpay_order_id
  ) {
    return { kind: 'skipped' }
  }

  const parsedId = parseLiqpayOrderId(order.liqpay_order_id)
  if (!parsedId || parsedId.orderId !== orderId) {
    console.error('reconcileOrder: unexpected liqpay_order_id', orderId, order.liqpay_order_id)
    return { kind: 'unavailable' }
  }

  const status = await fetchLiqpayStatus(order.liqpay_order_id, publicKey, privateKey)
  if (status.kind !== 'found') return { kind: status.kind }

  const result = await applyLiqpayResult({
    orderId,
    attempt: parsedId.attempt,
    status: status.status,
    amount: status.amount,
    currency: status.currency,
    paymentId: status.paymentId,
  }, publicKey)

  return { kind: 'applied', result, liqpayStatus: status.status }
}
