// Імітація callback LiqPay для перевірки webhook без справжньої оплати.
// Запуск: node --env-file=.env.local scripts/sendCallback.mjs <order_id> <status> <amount> [--bad-signature] [--payment-id=<id>]
//   order_id   — як у LiqPay: '<orders.id>-<номер спроби>' (orders.liqpay_order_id)
//   status     — success, failure, reversed, sandbox, ...
//   payment-id — за замовчуванням новий (Date.now()); той самий id імітує повтор того самого callback
// Адреса webhook: CALLBACK_URL, за замовчуванням локальний dev-сервер
import { createHash } from 'node:crypto'

const USAGE = 'Usage: node --env-file=.env.local scripts/sendCallback.mjs <order_id> <status> <amount> [--bad-signature] [--payment-id=<id>]'

const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const [orderId, status, amount] = positional
const badSignature = args.includes('--bad-signature')
const paymentIdArg = args.find((arg) => arg.startsWith('--payment-id='))?.slice('--payment-id='.length)

// Зайвий позиційний — найчастіше «--payment-id 123» через пробіл: без помилки тест тихо взяв би Date.now()
if (!orderId || !status || !amount || positional.length > 3) {
  console.error(USAGE)
  process.exit(1)
}

// LiqPay надсилає payment_id числом; '' (--payment-id= без значення) дало б Number('') = 0
const paymentId = paymentIdArg === undefined ? Date.now() : Number(paymentIdArg)
if (paymentIdArg === '' || !Number.isSafeInteger(paymentId)) {
  console.error(`--payment-id має бути цілим числом, отримано: ${paymentIdArg}`)
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
  payment_id: paymentId,
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

// payment_id друкуємо, щоб повторити саме цей callback через --payment-id
console.log(`${status} ${orderId} ${amount} payment_id=${paymentId}${badSignature ? ' (bad signature)' : ''} -> HTTP ${response.status}`)
