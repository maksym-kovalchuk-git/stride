import { createAdminClient } from '@/shared/lib/supabase/admin'
import { MAX_QUANTITY } from '@/shared/config/cart'
import { getWarehouses } from '@/entities/delivery/api/getWarehouses'

import type { CheckoutFormData, OrderItemInput } from '../model/schema'

type CreateOrderParams = {
  idempotencyKey: string
  formData: CheckoutFormData
  items: OrderItemInput[]
  userId: string | null
}

type CreateOrderRow = {
  order_id: string
  total_amount: number
  status: string
}

// Коди з raise exception у create_order, спричинені даними клієнта, і їхній HTTP-статус.
// Решта (empty_order, invalid_item, missing_idempotency_key, ...) означає баг у нашому коді — 500.
const CLIENT_ERROR_STATUS: Record<string, 400 | 409> = {
  variant_unavailable: 400,
  out_of_stock: 400,
  quantity_limit: 400,
  idempotency_conflict: 409,
  order_cancelled: 409,
}

export class OrderValidationError extends Error {
  constructor(code: string, readonly status: 400 | 409) {
    super(code)
  }
}

// Як і з ціною: адресу доставки з браузера на віру не беремо. Відділення має бути серед
// відділень цього міста за даними Нової Пошти, а назви міста й відділення — з її ж відповіді.
// Збій НП — звичайна помилка (500): клієнт лишить ключ ідемпотентності й зможе повторити
async function resolveDelivery(cityRef: string, warehouseRef: string): Promise<{ cityName: string; warehouseName: string }> {
  const warehouses = await getWarehouses(cityRef)
  const warehouse = warehouses.find((w) => w.ref === warehouseRef)
  if (!warehouse) {
    throw new OrderValidationError('invalid_delivery', 400)
  }
  return { cityName: warehouse.cityDescription, warehouseName: warehouse.description }
}

export async function createOrder(orderData: CreateOrderParams): Promise<{ orderId: string; totalAmount: number; status: string }> {
  const supabase = createAdminClient()
  const { formData } = orderData
  const { cityName, warehouseName } = await resolveDelivery(formData.cityRef, formData.warehouseRef)

  // Злиття дублікатів, перевірки, ціни, списання залишку й транзакція — у create_order (0010)
  const { data, error } = await supabase
    .rpc('create_order', {
      p_user_id: orderData.userId,
      p_idempotency_key: orderData.idempotencyKey,
      p_items: orderData.items,
      p_max_quantity: MAX_QUANTITY,
      p_payment_method: formData.paymentMethod,
      p_recipient_first_name: formData.firstName,
      p_recipient_last_name: formData.lastName,
      p_phone: formData.phone,
      p_np_city_ref: formData.cityRef,
      p_np_city_name: cityName,
      p_np_branch_ref: formData.warehouseRef,
      p_np_branch_name: warehouseName,
    })

  if (error) {
    // hasOwn — щоб не зачепити прототипні ключі на кшталт constructor
    if (Object.hasOwn(CLIENT_ERROR_STATUS, error.message)) {
      throw new OrderValidationError(error.message, CLIENT_ERROR_STATUS[error.message])
    }
    console.error('Error creating order:', error)
    throw new Error('Failed to create order')
  }

  // returns table → масив рядків; клієнт без типів БД цього не знає, тож приводимо явно
  const rows = data as CreateOrderRow[] | null
  const row = rows?.[0]
  if (!row) {
    throw new Error('create_order returned no rows')
  }

  return { orderId: row.order_id, totalAmount: Number(row.total_amount), status: row.status }
}
