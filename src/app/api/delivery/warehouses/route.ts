import { NextResponse } from 'next/server'
import { getWarehouses } from '@/entities/delivery/api/getWarehouses'

export async function POST(request: Request) {
  const body = await request.json()
  const cityRef = body.cityRef
  
  const warehouses = await getWarehouses(cityRef)

  return NextResponse.json(warehouses)
}