import { z } from 'zod'
import { NextResponse } from 'next/server'

import { startPayment, PaymentError } from '@/features/checkout/api/startPayment'
import { createClient } from '@/shared/lib/supabase/server'

const bodySchema = z.object({
  orderId: z.uuid(),
})

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 })
  }

  const publicKey = process.env.LIQPAY_PUBLIC_KEY
  const privateKey = process.env.LIQPAY_PRIVATE_KEY
  const serverBaseUrl = process.env.APP_URL
  if (!publicKey || !privateKey || !serverBaseUrl) {
    console.error('payment route: LIQPAY_PUBLIC_KEY, LIQPAY_PRIVATE_KEY or APP_URL is not set')
    return NextResponse.json({ error: 'Failed to start payment' }, { status: 500 })
  }

  // userId лише із сесії: власника звіряє start_payment_attempt
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    const { data, signature } = await startPayment({
      orderId: parsed.data.orderId,
      userId: user?.id ?? null,
      // result_url — туди, звідки прийшов браузер; server_url — публічна адреса з APP_URL
      appOrigin: new URL(request.url).origin,
      serverBaseUrl,
      publicKey,
      privateKey,
    })
    // Лише data і signature: про замовлення клієнт нічого більше не дізнається
    return NextResponse.json({ data, signature })
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('payment route failed:', error)
    return NextResponse.json({ error: 'Failed to start payment' }, { status: 500 })
  }
}
