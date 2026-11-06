import Link from 'next/link'

import { OrderStatusView } from '@/features/checkout/ui/OrderStatusView'

// result_url LiqPay і перехід після накладеного платежу. Статус — лише з бази (OrderStatusView)
export default async function CheckoutSuccessPage({ searchParams }: PageProps<'/checkout/success'>) {
  const { orderId } = await searchParams

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      {typeof orderId === 'string' ? (
        <OrderStatusView orderId={orderId} />
      ) : (
        <>
          <h1>Замовлення не знайдено</h1>
          <Link href="/cart">Повернутися до кошика</Link>
        </>
      )}
    </div>
  )
}
