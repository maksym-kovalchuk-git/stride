import { z } from 'zod'
import { NextResponse } from 'next/server'

import {
  PAYMENT_MAX_ATTEMPTS,
  PAYMENT_MIN_REMAINING_SECONDS,
  PAYMENT_WINDOW_MINUTES,
} from '@/features/checkout/config/payment'
import { createAdminClient } from '@/shared/lib/supabase/admin'
import { createClient } from '@/shared/lib/supabase/server'

import type { OrderStatusResponse } from '@/features/checkout/model/orderStatus'

const notFound = () => NextResponse.json({ error: 'order_not_found' }, { status: 404 })

// Статус замовлення для сторінки успіху й банера «неоплачене замовлення».
// Віддає лише статус, liqpay_status, суму й canPay — жодних даних отримувача.
// Власник — як у start_payment_attempt: замовлення з user_id бачить лише власник,
// гостьове — будь-хто, хто знає uuid; чуже відповідає 404, як неіснуюче
export async function GET(_request: Request, ctx: RouteContext<'/api/orders/[id]/status'>) {
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: order, error } = await createAdminClient()
    .from('orders')
    .select('user_id, status, liqpay_status, total_amount, payment_method, payment_attempts, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('order status route failed:', id, error)
    return NextResponse.json({ error: 'Failed to load order status' }, { status: 500 })
  }
  if (!order || (order.user_id && order.user_id !== user?.id)) return notFound()

  // Ті самі умови й параметри, що в start_payment_attempt (0012) — лише щоб вирішити, чи показувати
  // кнопку оплати; саме рішення про спробу однаково приймає атомарний update у функції
  const windowEndsAt =
    new Date(order.created_at).getTime() + PAYMENT_WINDOW_MINUTES * 60_000 - PAYMENT_MIN_REMAINING_SECONDS * 1000
  const canPay =
    order.status === 'pending' &&
    order.payment_method === 'card_online' &&
    order.payment_attempts < PAYMENT_MAX_ATTEMPTS &&
    Date.now() < windowEndsAt

  const body: OrderStatusResponse = {
    status: order.status,
    liqpayStatus: order.liqpay_status,
    amount: Number(order.total_amount),
    canPay,
  }
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
}
