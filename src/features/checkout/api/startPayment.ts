import { createAdminClient } from '@/shared/lib/supabase/admin'

import { liqpaySign } from '../lib/liqpaySign'
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
  constructor(code: string, readonly status: 404 | 409) {
    super(code)
  }
}

// LiqPay чекає UTC у форматі "YYYY-MM-DD HH:mm:ss"
function toLiqpayDate(value: string): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ')
}

export async function startPayment(params: StartPaymentParams): Promise<{ data: string; signature: string }> {
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
      version: 3,
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
