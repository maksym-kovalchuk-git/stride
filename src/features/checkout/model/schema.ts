import { z } from 'zod'

import { MAX_QUANTITY } from '@/features/add-to-cart/model/constants'

export const schema = z.object({
  firstName: z.string().min(2, "Введіть ім'я").max(50, "Максимальна довжина імені - 50 символів"),
  lastName: z.string().min(2, "Введіть прізвище").max(50, "Максимальна довжина прізвища - 50 символів"),
  phone: z.string().regex(/^\+380\d{9}$/, 'Формат: +380XXXXXXXXX'),  
  paymentMethod: z.enum(['card_online', 'after_delivery'], { message: 'Виберіть спосіб оплати' }),
  cityRef: z.string().min(1, 'Виберіть місто'),
  warehouseRef: z.string().min(1, 'Виберіть відділення'),
})

export type CheckoutFormData = z.infer<typeof schema>

export const orderItemSchema = z.object({
  variant_id: z.uuid(),
  // Межа на рядок; сума по одному variant_id після злиття перевіряється в createOrder
  quantity: z.int().min(1).max(MAX_QUANTITY),
})

export const createOrderSchema = z.object({
  formData: schema,
  cityName: z.string().min(1).max(200),
  warehouseName: z.string().min(1).max(300),
  items: z.array(orderItemSchema).min(1).max(50),
})

export type OrderItemInput = z.infer<typeof orderItemSchema>
export type CreateOrderInput = z.infer<typeof createOrderSchema>