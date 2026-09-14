import { NextResponse } from 'next/server'
import { getCities } from '@/entities/delivery/api/getCities'

export async function POST(request: Request) {
  const body = await request.json()
  const query = body.query
  
  const cities = await getCities(query)

  return NextResponse.json(cities)
}