import { LIQPAY_CHECKOUT_URL } from '../config/payment'

// LiqPay checkout приймає лише POST-форму, тож створюємо приховану форму й відправляємо її:
// браузер іде на сторінку оплати, як після звичайного submit
export function redirectToLiqpay(data: string, signature: string): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = LIQPAY_CHECKOUT_URL
  form.acceptCharset = 'utf-8'

  for (const [name, value] of Object.entries({ data, signature })) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}
