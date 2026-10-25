// Імітація callback LiqPay для перевірки webhook без справжньої оплати.
// Запуск: node --env-file=.env.local scripts/sendCallback.mjs <order_id> <status> <amount> [--bad-signature]
//   order_id — як у LiqPay: '<orders.id>-<номер спроби>' (orders.liqpay_order_id)
//   status   — success, failure, reversed, sandbox, ...
// Адреса webhook: CALLBACK_URL, за замовчуванням локальний dev-сервер
import { createHash } from 'node:crypto'

const [orderId, status, amount] = process.argv.slice(2)
const badSignature = process.argv.includes('--bad-signature')

if (!orderId || !status || !amount) {
  console.error('Usage: node --env-file=.env.local scripts/sendCallback.mjs <order_id> <status> <amount> [--bad-signature]')
  process.exit(1)
}

const privateKey = process.env.LIQPAY_PRIVATE_KEY
const publicKey = process.env.LIQPAY_PUBLIC_KEY
if (!privateKey || !publicKey) {
  console.error('LIQPAY_PRIVATE_KEY і LIQPAY_PUBLIC_KEY мають бути в .env.local')
  process.exit(1)
}

const callbackUrl = process.env.CALLBACK_URL ?? 'http://localhost:3000/api/checkout/liqpay_callback'

const payload = {
  public_key: publicKey,
  version: 7,
  action: 'pay',
  order_id: orderId,
  status,
  amount: Number(amount),
  currency: 'UAH',
  payment_id: Date.now(),
}

const data = Buffer.from(JSON.stringify(payload)).toString('base64')
// sha3-256 — як у liqpaySign.ts; --bad-signature підписує чужим ключем
const signingKey = badSignature ? 'wrong-key' : privateKey
const signature = createHash('sha3-256').update(signingKey + data + signingKey).digest('base64')

// LiqPay надсилає form-urlencoded
const response = await fetch(callbackUrl, {
  method: 'POST',
  body: new URLSearchParams({ data, signature }),
})

console.log(`${status} ${orderId} ${amount}${badSignature ? ' (bad signature)' : ''} -> HTTP ${response.status}`)
