// Запит статусу оплати в LiqPay: що LiqPay знає про спробу, незалежно від callback.
// Запуск: node --env-file=.env.local scripts/checkStatus.mjs <liqpay_order_id>
// Відповідь містить персональні дані платника (ім'я, IP, маска картки) — не публікуйте її
import { createHash } from 'node:crypto'

const [orderId] = process.argv.slice(2)
if (!orderId) {
  console.error('Usage: node --env-file=.env.local scripts/checkStatus.mjs <liqpay_order_id>')
  process.exit(1)
}

const { LIQPAY_PUBLIC_KEY: publicKey, LIQPAY_PRIVATE_KEY: privateKey } = process.env
if (!publicKey || !privateKey) {
  console.error('LIQPAY_PRIVATE_KEY і LIQPAY_PUBLIC_KEY мають бути в .env.local')
  process.exit(1)
}

const params = { action: 'status', version: 7, public_key: publicKey, order_id: orderId }
const data = Buffer.from(JSON.stringify(params)).toString('base64')
// sha3-256 — як у liqpaySign.ts
const signature = createHash('sha3-256').update(privateKey + data + privateKey).digest('base64')

const res = await fetch('https://www.liqpay.ua/api/request', {
  method: 'POST',
  body: new URLSearchParams({ data, signature }),
})
console.log('HTTP', res.status)
console.log(await res.text())