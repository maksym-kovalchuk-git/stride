import { createHash, timingSafeEqual } from 'node:crypto'

// Параметри checkout-форми LiqPay: https://www.liqpay.ua/doc/api/internet_acquiring/checkout
export type LiqpayCheckoutParams = {
  public_key: string
  version: number
  action: 'pay'
  amount: number
  currency: 'UAH'
  description: string
  order_id: string
  result_url?: string
  server_url?: string
  // UTC у форматі "2026-10-17 12:00:00"
  expired_date?: string
  language?: 'uk' | 'en'
}

// SHA3-256 — поточна специфікація LiqPay: приклад signature з документації
// (0adgJ8F2Ds5HCVkcz4AlmdLMRoIJf7IxsL3QmeFRz/s=) збігається лише з ним.
// SHA-1 зі старого sdk-nodejs і з прикладу bash — застарілий варіант
const SIGNATURE_ALGORITHM = 'sha3-256'

// Поточна версія API за документацією
export const LIQPAY_API_VERSION = 7

// Окремо від liqpaySign: webhook перераховує підпис від отриманого data тією ж формулою
export function liqpaySignature(data: string, privateKey: string): string {
  return createHash(SIGNATURE_ALGORITHM).update(privateKey + data + privateKey).digest('base64')
}

// Порівняння, стійке до timing-атак. timingSafeEqual вимагає однакової довжини,
// тож різна довжина — одразу false (довжина хешу в base64 і так фіксована)
export function verifyLiqpaySignature(data: string, signature: string, privateKey: string): boolean {
  const expected = Buffer.from(liqpaySignature(data, privateKey))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

// Чиста функція: ключ приходить аргументом, а не з process.env — так її легко тестувати
export function liqpaySign(
  params: LiqpayCheckoutParams,
  privateKey: string
): { data: string; signature: string } {
  const data = Buffer.from(JSON.stringify(params)).toString('base64')
  return { data, signature: liqpaySignature(data, privateKey) }
}
