import { createAdminClient } from '@/shared/lib/supabase/admin'
import { getVariantPrice } from '@/entities/product/model/getVariantPrice'
import { MAX_QUANTITY } from '@/features/add-to-cart/model/constants'

import type { CheckoutFormData, OrderItemInput } from '../model/schema'

type CreateOrderParams = {
  formData: CheckoutFormData
  cityName: string
  warehouseName: string
  items: OrderItemInput[]
  userId: string | null
}

type VariantRow = {
  id: string
  price_override: number | null
  stock: number
  product: { base_price: number; is_active: boolean } | null
}

// Помилки, спричинені даними клієнта (немає варіанта, не вистачає залишку) — віддаються як 400
export class OrderValidationError extends Error {}

export async function createOrder(orderData: CreateOrderParams): Promise<{ orderId: string; totalAmount: number }> {
  const supabase = createAdminClient()

  // Один варіант може прийти кількома рядками — зводимо в одну позицію
  const quantities = new Map<string, number>()
  for (const item of orderData.items) {
    quantities.set(item.variant_id, (quantities.get(item.variant_id) ?? 0) + item.quantity)
  }
  const variantIds = [...quantities.keys()]

  const { data: variants, error: variantsError } = await supabase
    .from('product_variants')
    .select('id, price_override, stock, product:products(base_price, is_active)')
    .in('id', variantIds)
    .overrideTypes<VariantRow[], { merge: false }>()

  if (variantsError) {
    console.error('Error fetching variants:', variantsError)
    throw new Error('Failed to fetch variants')
  }

  const variantsById = new Map(variants.map((v) => [v.id, v]))

  // Рахуємо в копійках, щоб уникнути похибок float
  let totalKopecks = 0
  const orderItems = variantIds.map((variantId) => {
    const variant = variantsById.get(variantId)
    const quantity = quantities.get(variantId)!

    if (!variant || !variant.product || !variant.product.is_active) {
      throw new OrderValidationError(`Variant ${variantId} is not available`)
    }
    // Zod обмежує лише окремий рядок — сума злитих рядків може перевищити ліміт
    if (quantity > MAX_QUANTITY) {
      throw new OrderValidationError(`Quantity for variant ${variantId} exceeds ${MAX_QUANTITY}`)
    }
    if (variant.stock < quantity) {
      throw new OrderValidationError(`Not enough stock for variant ${variantId}`)
    }

    const priceKopecks = Math.round(getVariantPrice(variant, variant.product) * 100)
    totalKopecks += priceKopecks * quantity

    return {
      variant_id: variantId,
      quantity,
      price_at_purchase: priceKopecks / 100,
    }
  })

  const totalAmount = totalKopecks / 100

  // Накладений платіж не чекає LiqPay — одразу в обробку
  const status = orderData.formData.paymentMethod === 'after_delivery' ? 'processing' : 'pending'

  // TODO: transaction
  const { data: addressData, error: addressError } = await supabase
  .from('addresses')
  .insert({
    user_id: orderData.userId,
    recipient_first_name: orderData.formData.firstName,
    recipient_last_name: orderData.formData.lastName,
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
    status,
    payment_method: orderData.formData.paymentMethod,
    total_amount: totalAmount,
  })
  .select()
  .single()

  if (orderError) {
    console.error('Error creating order:', orderError)
    throw new Error('Failed to create order')
  }

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems.map((item) => ({ order_id: order.id, ...item })))

  if (itemsError) {
    console.error('Error creating order items:', itemsError)
    throw new Error('Failed to create order items')
  }

  return { orderId: order.id, totalAmount }
}
