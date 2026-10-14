// Заглушка: статус замовлення з бази й опитування для LiqPay — на кроці зі сторінкою успіху
export default async function CheckoutSuccessPage({ searchParams }: PageProps<'/checkout/success'>) {
  const { orderId } = await searchParams

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 20 }}>
      <h1>Дякуємо за замовлення!</h1>
      {typeof orderId === 'string' && <p>Номер замовлення: {orderId}</p>}
    </div>
  )
}
