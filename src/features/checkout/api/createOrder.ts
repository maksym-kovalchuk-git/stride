import { createAdminClient } from '@/shared/lib/supabase/admin'

import type { CheckoutFormData } from '../model/schema'
import { CartItem } from '@/features/add-to-cart/model/types'

type CreateOrderParams = {
  formData: CheckoutFormData
  cityName: string
  warehouseName: string
  cartItems: CartItem[]
  userId: string | null
  totalAmount: number
}

export async function createOrder(orderData: CreateOrderParams): Promise<{ orderId: string }> {
  const supabase = createAdminClient()

  const { data: addressData, error: addressError } = await supabase
  .from('addresses')
  .insert({
    user_id: orderData.userId,
    phone: orderData.formData.phone,
    np_city_ref: orderData.formData.cityRef,
    np_city_name: orderData.cityName,
    np_branch_ref: orderData.formData.warehouseRef,
    np_branch_name: orderData.warehouseName,
  })
  .select()
  .single()

  if (addressError) {
    console.error('Error creating address:', addressError)
    throw new Error('Failed to create address')
  }

  const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    user_id: orderData.userId,
    address_id: addressData.id,
    status: 'pending',
    total_amount: orderData.totalAmount,
  })
  .select()
  .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    throw new Error('Failed to create order')
  }

  const { data: orderItemsData, error: itemsError } = await supabase
    .from('order_items')
    .insert(
      orderData.cartItems.map((item) => ({
        order_id: order.id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        price_at_purchase: item.price,
      }))
    )

  if (itemsError) {
    console.error('Error creating order items:', itemsError)
    throw new Error('Failed to create order items')
  }

  console.log('Order created successfully:', order)
  return { orderId: order.id }
  }

  