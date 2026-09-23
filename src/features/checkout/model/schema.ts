import { z } from 'zod'

export const schema = z.object({
  firstName: z.string().min(2, "Введіть ім'я").max(50, "Максимальна довжина імені - 50 символів"),
  lastName: z.string().min(2, "Введіть прізвище").max(50, "Максимальна довжина прізвища - 50 символів"),
  phone: z.string().regex(/^\+380\d{9}$/, 'Формат: +380XXXXXXXXX'),  
  paymentMethod: z.enum(['card_online', 'after_delivery'], { message: 'Виберіть спосіб оплати' }),
  cityRef: z.string().min(1, 'Виберіть місто'),
  warehouseRef: z.string().min(1, 'Виберіть відділення'),
})

export type CheckoutFormData = z.infer<typeof schema>