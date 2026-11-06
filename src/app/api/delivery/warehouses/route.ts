import { NextResponse } from 'next/server'
import { getWarehouses } from '@/entities/delivery/api/getWarehouses'

export async function POST(request: Request) {
  let cityRef: unknown
  try {
    cityRef = (await request.json()).cityRef
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof cityRef !== 'string' || cityRef === '') {
    return NextResponse.json({ error: 'cityRef is required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getWarehouses(cityRef))
  } catch (error) {
    // 502: збій на боці Нової Пошти, а не в нашому запиті
    console.error('delivery/warehouses failed:', error)
    return NextResponse.json({ error: 'Failed to load warehouses' }, { status: 502 })
  }
}
