// Шлях збігається з LIQPAY_CALLBACK_PATH (features/checkout/config/payment.ts) — це server_url для LiqPay
import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

import { applyLiqpayResult } from '@/features/checkout/api/applyLiqpayResult'
import { verifyLiqpaySignature } from '@/features/checkout/lib/liqpaySign'
import { parseLiqpayOrderId } from '@/features/checkout/lib/parseLiqpayOrderId'

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

function isLegacySha1Signature(data: string, signature: string, privateKey: string): boolean {
  return createHash('sha1').update(privateKey + data + privateKey).digest('base64') === signature
}

export async function POST(request: Request) {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY
  const privateKey = process.env.LIQPAY_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.error('liqpay_callback: LIQPAY_PUBLIC_KEY or LIQPAY_PRIVATE_KEY is not set')
    return serverError()
  }

  // POST з полями data і signature; formData() читає і urlencoded, і multipart
  // 400-гілки логуємо: інакше відхилений callback LiqPay у терміналі не видно взагалі
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    console.warn('liqpay_callback: body is not form data', request.headers.get('content-type'))
    return badRequest()
  }
  const data = form.get('data')
  const signature = form.get('signature')
  if (typeof data !== 'string' || typeof signature !== 'string') {
    console.warn('liqpay_callback: missing data or signature', [...form.keys()])
    return badRequest()
  }

  // Невірний підпис — це не LiqPay: нічого не чіпаємо
  if (!verifyLiqpaySignature(data, signature, privateKey)) {
    // Діагностика: підпис старим SHA-1 не приймаємо, але кажемо про нього — це не підробка, а інший алгоритм
    console.warn('liqpay_callback: invalid signature', {
      signedWithSha1: isLegacySha1Signature(data, signature, privateKey),
    })
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

  // Будь-який результат — 200; збій бази — 500, і LiqPay повторить
  try {
    await applyLiqpayResult({
      orderId,
      attempt,
      status: payload.status,
      amount: payload.amount,
      currency: payload.currency,
      paymentId: payload.payment_id,
    }, publicKey)
    return ok()
  } catch (error) {
    console.error('liqpay_callback: failed to apply result', orderId, error)
    return serverError()
  }
}
