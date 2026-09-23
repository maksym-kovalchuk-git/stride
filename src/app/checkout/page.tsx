import { DeliveryForm } from '@/features/checkout/ui/DeliveryForm'

export default function CheckoutPage() {
  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Checkout</h1>
      <DeliveryForm />
    </div>
  )
}