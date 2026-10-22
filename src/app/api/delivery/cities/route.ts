import { NextResponse } from 'next/server'
import { getCities } from '@/entities/delivery/api/getCities'

export async function POST(request: Request) {
  let query: unknown
  try {
    query = (await request.json()).query
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof query !== 'string') {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  try {
    return NextResponse.json(await getCities(query))
  } catch (error) {
    // 502: збій на боці Нової Пошти, а не в нашому запиті
    console.error('delivery/cities failed:', error)
    return NextResponse.json({ error: 'Failed to load cities' }, { status: 502 })
  }
}
