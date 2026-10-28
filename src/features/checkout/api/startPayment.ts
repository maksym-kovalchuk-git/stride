import { createAdminClient } from '@/shared/lib/supabase/admin'

import { LIQPAY_API_VERSION, liqpaySign } from '../lib/liqpaySign'
import { fetchLiqpayStatus } from '../lib/liqpayStatus'
import { isFailedLiqpayStatus, isSuccessStatus } from '../lib/liqpayStatuses'
import { parseLiqpayOrderId } from '../lib/parseLiqpayOrderId'
import { applyLiqpayResult } from './applyLiqpayResult'
import {
  LIQPAY_CALLBACK_PATH,
  PAYMENT_MAX_ATTEMPTS,
  PAYMENT_MIN_REMAINING_SECONDS,
  PAYMENT_WINDOW_MINUTES,
} from '../config/payment'

type StartPaymentParams = {
  orderId: string
  userId: string | null
  // Куди LiqPay поверне браузер (той самий origin, з якого прийшов запит)
  appOrigin: string
  // Публічна адреса для webhook — тунель або деплой (APP_URL)
  serverBaseUrl: string
  publicKey: string
  privateKey: string
}

type StartPaymentRow = {
  liqpay_order_id: string
  amount: number
  expires_at: string
}

// Коди з raise exception у start_payment_attempt (0012) і їхній HTTP-статус.
// order_not_found — і для чужого замовлення. Решта (invalid_payment_params, ...) — баг у нашому коді, 500
const PAYMENT_ERROR_STATUS: Record<string, 404 | 409> = {
  order_not_found: 404,
  order_not_payable: 409,
  order_already_paid: 409,
  order_cancelled: 409,
  payment_window_closed: 409,
  too_many_attempts: 409,
}

export class PaymentError extends Error {
  constructor(code: string, readonly status: 404 | 409 | 503) {
    super(code)
  }
}

// Попередня спроба могла пройти в LiqPay, а callback не дійти (немає тунелю, збій webhook).
// Нову спробу даємо, лише коли LiqPay підтвердив, що попередня не списала гроші й не в процесі
async function checkPreviousAttempt(params: StartPaymentParams): Promise<void> {
  const supabase = createAdminClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('status, user_id, payment_attempts, liqpay_order_id')
    .eq('id', params.orderId)
    .maybeSingle()

  if (error) {
    throw new Error(`startPayment: failed to read order ${params.orderId}`, { cause: error })
  }

  // Не знайдене чи чуже — відповідь дасть start_payment_attempt (order_not_found)
  if (!order || (order.user_id !== null && order.user_id !== params.userId)) return
  // Не pending — RPC однаково відмовить; скасоване з успішною оплатою знайде звірка
  if (order.status !== 'pending' || order.payment_attempts === 0 || !order.liqpay_order_id) return

  const parsedId = parseLiqpayOrderId(order.liqpay_order_id)
  if (!parsedId || parsedId.orderId !== params.orderId) {
    console.error('startPayment: unexpected liqpay_order_id', params.orderId, order.liqpay_order_id)
    throw new PaymentError('payment_status_unavailable', 503)
  }

  const result = await fetchLiqpayStatus(order.liqpay_order_id, params.publicKey, params.privateKey)

  if (result.kind === 'unavailable') {
    throw new PaymentError('payment_status_unavailable', 503)
  }
  if (result.kind === 'not_found' || isFailedLiqpayStatus(result.status)) return

  if (isSuccessStatus(result.status, params.publicKey)) {
    await applyLiqpayResult({
      orderId: params.orderId,
      attempt: parsedId.attempt,
      status: result.status,
      amount: result.amount,
      currency: result.currency,
      paymentId: result.paymentId,
    }, params.publicKey)
    // Навіть при 'ignored': LiqPay каже, що гроші списано, розбіжність уже в логах
    throw new PaymentError('order_already_paid', 409)
  }

  throw new PaymentError('payment_processing', 409)
}

// LiqPay чекає UTC у форматі "YYYY-MM-DD HH:mm:ss"
function toLiqpayDate(value: string): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

export async function startPayment(params: StartPaymentParams): Promise<{ data: string; signature: string }> {
  await checkPreviousAttempt(params)

  const supabase = createAdminClient()

  // Власник, статус, вікно й ліміт перевіряються і лічильник збільшується в одному update
  const { data, error } = await supabase.rpc('start_payment_attempt', {
    p_order_id: params.orderId,
    p_user_id: params.userId,
    p_max_attempts: PAYMENT_MAX_ATTEMPTS,
    p_window_minutes: PAYMENT_WINDOW_MINUTES,
    p_min_remaining_seconds: PAYMENT_MIN_REMAINING_SECONDS,
  })

  if (error) {
    if (Object.hasOwn(PAYMENT_ERROR_STATUS, error.message)) {
      throw new PaymentError(error.message, PAYMENT_ERROR_STATUS[error.message])
    }
    console.error('Error starting payment attempt:', error)
    throw new Error('Failed to start payment attempt')
  }

  // returns table → масив рядків; клієнт без типів БД цього не знає, тож приводимо явно
  const row = (data as StartPaymentRow[] | null)?.[0]
  if (!row) {
    throw new Error('start_payment_attempt returned no rows')
  }

  // Сума й order_id — лише з бази, нічого платіжного від клієнта
  return liqpaySign(
    {
      public_key: params.publicKey,
      version: LIQPAY_API_VERSION,
      action: 'pay',
      amount: Number(row.amount),
      currency: 'UAH',
      description: `Замовлення ${params.orderId.slice(0, 8)}`,
      order_id: row.liqpay_order_id,
      expired_date: toLiqpayDate(row.expires_at),
      // orderId в адресі безпечний: сторінка успіху сама читає статус із бази, а не вірить переходу
      result_url: `${params.appOrigin}/checkout/success?orderId=${params.orderId}`,
      server_url: `${params.serverBaseUrl}${LIQPAY_CALLBACK_PATH}`,
      language: 'uk',
    },
    params.privateKey
  )
}
