import { createOrder } from '@/features/checkout/api/createOrder'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const body = await request.json()

  try {
    const result = await createOrder(body)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}