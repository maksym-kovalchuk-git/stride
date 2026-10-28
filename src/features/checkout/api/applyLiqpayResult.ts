import 'server-only'

import { createAdminClient } from '@/shared/lib/supabase/admin'

import { isAcceptedStatus } from '../model/orderStatus'

// Результат LiqPay для однієї спроби оплати.
type LiqpayResultInput = {
  orderId: string
  attempt: number
  status: string
  amount: unknown
  currency: unknown
  paymentId: unknown
}

export type ApplyResult =
  | 'paid'          // pending → paid
  | 'late_success'  // успіх на скасованому/оплаченому іншим платежем — потрібна перевірка повернення
  | 'recorded'      // записали невдалий статус
  | 'ignored'       // розбіжність з базою: не знайдено, номер спроби, сума чи валюта

// Статус sandbox старі версії API повертали для тестових оплат; рахуємо його успіхом
// лише з sandbox-ключами, щоб із бойовими він ніколи не перевів замовлення в paid
function isSuccessStatus(status: string, publicKey: string): boolean {
  return status === 'success' || (status === 'sandbox' && publicKey.startsWith('sandbox_'))
}

// Гроші порівнюємо в копійках, щоб уникнути похибок float
const toKopecks = (value: number) => Math.round(value * 100)

export async function applyLiqpayResult(input: LiqpayResultInput, publicKey: string): Promise<ApplyResult> {
  const { orderId, attempt, status: liqpayStatus, paymentId } = input
  // == null ловить і null, і undefined — щоб не записати в базу рядок "undefined"
  const paymentIdText = paymentId == null ? null : String(paymentId)
  const supabase = createAdminClient()

  const { data: order, error: readError } = await supabase
    .from('orders')
    .select('id, total_amount, payment_attempts')
    .eq('id', orderId)
    .maybeSingle()

  if (readError) {
    throw new Error(`applyLiqpayResult: failed to read order ${orderId}`, { cause: readError })
  }

  // Розбіжності з базою: повтор того самого результату не допоможе — лише гучний лог
  if (!order) {
    console.error('applyLiqpayResult: order not found', { orderId, liqpayStatus, paymentId })
    return 'ignored'
  }
  // Більший номер за payment_attempts ми не видавали; менший — запізнілий результат, приймаємо
  if (attempt > order.payment_attempts) {
    console.error('applyLiqpayResult: attempt exceeds payment_attempts', {
      orderId, attempt, paymentAttempts: order.payment_attempts, paymentId,
    })
    return 'ignored'
  }
  // amount може прийти числом чи рядком ("3199.00") — не вимагаємо typeof, а перетворюємо
  const amount = Number(input.amount)
  if (
    !Number.isFinite(amount) ||
    toKopecks(amount) !== toKopecks(Number(order.total_amount)) ||
    input.currency !== 'UAH'
  ) {
    console.error('applyLiqpayResult: amount or currency mismatch', {
      orderId, amount: input.amount, currency: input.currency, expected: order.total_amount, paymentId,
    })
    return 'ignored'
  }

  if (isSuccessStatus(liqpayStatus, publicKey)) {
    // Умовний перехід pending → paid: повторний callback чи паралельна спроба не зроблять нічого
    const { data: paid, error: paidError } = await supabase
      .from('orders')
      .update({ status: 'paid', liqpay_status: 'success', liqpay_payment_id: paymentIdText })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')

    if (paidError) {
      throw new Error(`applyLiqpayResult: failed to mark order ${orderId} paid`, { cause: paidError })
    }

    if (paid.length > 0) {
      return 'paid'
    }

    // Перечитуємо, а не беремо з першого читання: два одночасні повтори обидва прочитали б pending
    const { data: current, error: rereadError } = await supabase
      .from('orders')
      .select('status, liqpay_payment_id')
      .eq('id', orderId)
      .single()

    if (rereadError) {
      throw new Error(`applyLiqpayResult: failed to reread order ${orderId}`, { cause: rereadError })
    }

    // Повтор того самого callback: цей платіж і перевів замовлення в paid
    if (
      isAcceptedStatus(current.status) &&
      paymentIdText !== null &&
      current.liqpay_payment_id === paymentIdText
    ) {
      return 'paid'
    }

    // Замовлення скасоване за таймаутом або оплачене іншим платежем: гроші треба повернути
    // вручну (README). liqpay_payment_id не чіпаємо — він вказує на платіж, що оплатив замовлення
    const { error: lateError } = await supabase
      .from('orders')
      .update({ liqpay_status: 'success' })
      .eq('id', orderId)
    if (lateError) {
      throw new Error(`applyLiqpayResult: failed to record late success for ${orderId}`, { cause: lateError })
    }
    console.warn('applyLiqpayResult: success on non-pending order, check refund', {
      orderId, attempt, paymentAttempts: order.payment_attempts, paymentId,
    })
    return 'late_success'
  }

  // reversed (повернення коштів) перекриває success; решта — лише якщо там ще не success,
  // щоб невдача іншої спроби не перезаписала успіх
  let update = supabase.from('orders').update({ liqpay_status: liqpayStatus }).eq('id', orderId)
  if (liqpayStatus !== 'reversed') {
    update = update.or('liqpay_status.is.null,liqpay_status.neq.success')
  }
  const { error: statusError } = await update
  if (statusError) {
    throw new Error(`applyLiqpayResult: failed to record status for ${orderId}`, { cause: statusError })
  }

  return 'recorded'
}
