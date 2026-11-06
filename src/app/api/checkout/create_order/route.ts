import { createOrder, OrderValidationError } from '@/features/checkout/api/createOrder'
import { createOrderSchema } from '@/features/checkout/model/schema'
import { getNextStep } from '@/features/checkout/model/getNextStep'
import { createClient } from '@/shared/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid order data', issues: parsed.error.issues }, { status: 400 })
  }

  // userId беремо лише із сесії, ніколи з body
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    const { orderId, totalAmount, status } = await createOrder({ ...parsed.data, userId: user?.id ?? null })
    // Що робити далі, вирішує сервер за статусом із create_order; клієнт лише виконує
    return NextResponse.json({ orderId, totalAmount, nextStep: getNextStep(status) })
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('create_order route failed:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
