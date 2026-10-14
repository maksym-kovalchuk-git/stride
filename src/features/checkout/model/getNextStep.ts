export type NextStep = 'pay' | 'success'

// Єдине місце, де статус замовлення перетворюється на дію клієнта.
// cancelled сюди не доходить: create_order (0010) кидає на нього order_cancelled.
// Межа: функція викликається вже після створення замовлення. Новий статус у check (наприклад, returned),
// не доданий сюди, дасть 500 на створене замовлення — і та сама 500 на кожен повтор з тим самим ключем.
// Додаючи статус у БД, додавай його і тут
export function getNextStep(status: string): NextStep {
  switch (status) {
    case 'pending':
      return 'pay'
    case 'processing':
    case 'paid':
    case 'shipped':
    case 'delivered':
      return 'success'
    default:
      throw new Error(`Unexpected order status: ${status}`)
  }
}
