// Шлях збігається з LIQPAY_CALLBACK_PATH (features/checkout/config/payment.ts) — це server_url для LiqPay
import { NextResponse } from 'next/server'

import { verifyLiqpaySignature } from '@/features/checkout/lib/liqpaySign'
import { parseLiqpayOrderId } from '@/features/checkout/lib/parseLiqpayOrderId'
import { createAdminClient } from '@/shared/lib/supabase/admin'

type LiqpayCallbackData = {
  order_id?: unknown
  status?: unknown
  amount?: unknown
  currency?: unknown
  payment_id?: unknown
}

// Відповіді: 400 — не від LiqPay або зіпсоване; 200 — оброблено (зокрема розбіжності даних,
// які повтор того самого callback не виправить — їх видно в логах); 500 — збій нашої бази.
// Тіла LiqPay не чекає (документація про нього мовчить)
const ok = () => new NextResponse(null, { status: 200 })
const badRequest = () => new NextResponse(null, { status: 400 })
const serverError = () => new NextResponse(null, { status: 500 })

// Статус sandbox старі версії API повертали для тестових оплат; рахуємо його успіхом
// лише з sandbox-ключами, щоб із бойовими він ніколи не перевів замовлення в paid
function isSuccessStatus(status: string, publicKey: string): boolean {
  return status === 'success' || (status === 'sandbox' && publicKey.startsWith('sandbox_'))
}

// Гроші порівнюємо в копійках, щоб уникнути похибок float
const toKopecks = (value: number) => Math.round(value * 100)

export async function POST(request: Request) {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY
  const privateKey = process.env.LIQPAY_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.error('liqpay_callback: LIQPAY_PUBLIC_KEY or LIQPAY_PRIVATE_KEY is not set')
    return serverError()
  }

  // POST з полями data і signature; formData() читає і urlencoded, і multipart
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest()
  }
  const data = form.get('data')
  const signature = form.get('signature')
  if (typeof data !== 'string' || typeof signature !== 'string') {
    return badRequest()
  }

  // Невірний підпис — це не LiqPay: нічого не чіпаємо
  if (!verifyLiqpaySignature(data, signature, privateKey)) {
    return badRequest()
  }

  // Далі підпис вірний — повідомлення справді від LiqPay
  let payload: LiqpayCallbackData
  try {
    payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'))
  } catch {
    console.error('liqpay_callback: signed data is not valid base64 JSON')
    return badRequest()
  }

  const parsedId = typeof payload.order_id === 'string' ? parseLiqpayOrderId(payload.order_id) : null
  if (!parsedId || typeof payload.status !== 'string') {
    console.error('liqpay_callback: unexpected order_id or status', payload.order_id, payload.status)
    return badRequest()
  }

  const { orderId, attempt } = parsedId
  const liqpayStatus = payload.status
  const paymentId = payload.payment_id
  const supabase = createAdminClient()

  const { data: order, error: readError } = await supabase
    .from('orders')
    .select('id, total_amount, payment_attempts')
    .eq('id', orderId)
    .maybeSingle()

  if (readError) {
    console.error('liqpay_callback: failed to read order', orderId, readError)
    return serverError()
  }

  // Розбіжності з базою: повтор того самого callback не допоможе — 200 і гучний лог
  if (!order) {
    console.error('liqpay_callback: order not found', { orderId, liqpayStatus, paymentId })
    return ok()
  }
  // Більший номер за payment_attempts ми не видавали; менший — запізнілий callback, приймаємо
  if (attempt > order.payment_attempts) {
    console.error('liqpay_callback: attempt exceeds payment_attempts', {
      orderId, attempt, paymentAttempts: order.payment_attempts, paymentId,
    })
    return ok()
  }
  // amount може прийти числом чи рядком ("3199.00") — не вимагаємо typeof, а перетворюємо
  const amount = Number(payload.amount)
  if (
    !Number.isFinite(amount) ||
    toKopecks(amount) !== toKopecks(Number(order.total_amount)) ||
    payload.currency !== 'UAH'
  ) {
    console.error('liqpay_callback: amount or currency mismatch', {
      orderId, amount: payload.amount, currency: payload.currency, expected: order.total_amount, paymentId,
    })
    return ok()
  }

  if (isSuccessStatus(liqpayStatus, publicKey)) {
    // Умовний перехід pending → paid: повторний callback чи паралельна спроба не зроблять нічого
    const { data: paid, error: paidError } = await supabase
      .from('orders')
      .update({ status: 'paid', liqpay_status: 'success' })
      .eq('id', orderId)
      .eq('status', 'pending')
      .select('id')

    if (paidError) {
      console.error('liqpay_callback: failed to mark order paid', orderId, paidError)
      return serverError()
    }

    if (paid.length === 0) {
      // Замовлення вже не pending (скасоване за таймаутом або оплачене іншою спробою):
      // фіксуємо успішну оплату — гроші, ймовірно, треба повернути вручну (README)
      const { error: lateError } = await supabase
        .from('orders')
        .update({ liqpay_status: 'success' })
        .eq('id', orderId)
      if (lateError) {
        console.error('liqpay_callback: failed to record late success', orderId, lateError)
        return serverError()
      }
      console.warn('liqpay_callback: success on non-pending order, check refund', {
        orderId, attempt, paymentAttempts: order.payment_attempts, paymentId,
      })
    }

    return ok()
  }

  // reversed (повернення коштів) перекриває success; решта — лише якщо там ще не success,
  // щоб невдача іншої спроби не перезаписала успіх
  let update = supabase.from('orders').update({ liqpay_status: liqpayStatus }).eq('id', orderId)
  if (liqpayStatus !== 'reversed') {
    update = update.or('liqpay_status.is.null,liqpay_status.neq.success')
  }
  const { error: statusError } = await update
  if (statusError) {
    console.error('liqpay_callback: failed to record status', orderId, statusError)
    return serverError()
  }

  return ok()
}
