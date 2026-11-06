import { DeliveryForm } from '@/features/checkout/ui/DeliveryForm'
import { PendingOrderBanner } from '@/features/checkout/ui/PendingOrderBanner'

export default function CheckoutPage() {
  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Checkout</h1>
      <PendingOrderBanner />
      <DeliveryForm />
    </div>
  )
}
