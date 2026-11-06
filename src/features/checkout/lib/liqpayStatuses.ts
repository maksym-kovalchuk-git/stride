// Фінальні неуспішні статуси LiqPay. Скасування користувачем може взагалі не дати callback,
// тож відсутність liqpay_status не означає, що оплата ще йде
export const LIQPAY_FAILED_STATUSES = new Set([
  'failure',
  'error',
  'reversed',
  // Побачили на живій відповіді sandbox (err_code: limit)
  'try_again',
])

export function isFailedLiqpayStatus(status: string | null): boolean {
  return status !== null && LIQPAY_FAILED_STATUSES.has(status)
}

// Статус sandbox старі версії API повертали для тестових оплат; рахуємо його успіхом
// лише з sandbox-ключами, щоб із бойовими він ніколи не перевів замовлення в paid
export function isSuccessStatus(status: string, publicKey: string): boolean {
  return status === 'success' || (status === 'sandbox' && publicKey.startsWith('sandbox_'))
}
