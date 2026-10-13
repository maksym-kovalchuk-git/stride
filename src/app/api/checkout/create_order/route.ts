import { createOrder, OrderValidationError } from '@/features/checkout/api/createOrder'
import { createOrderSchema } from '@/features/checkout/model/schema'
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
    const result = await createOrder({ ...parsed.data, userId: user?.id ?? null })
    // Що робити далі, вирішує сервер; клієнт лише виконує.
    // Та сама відповідність paymentMethod → статус є в create_order (0008) — змінювати разом
    const nextStep = parsed.data.formData.paymentMethod === 'card_online' ? 'pay' : 'success'
    return NextResponse.json({ ...result, nextStep })
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
