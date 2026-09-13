'use client'

import { useDispatch, useSelector } from 'react-redux'

import { increaseQuantity, decreaseQuantity, removeItem, clearCart, MAX_QUANTITY } from '@/features/add-to-cart/model/cartSlice'

import type { RootState } from '@/shared/store/store'
import Link from 'next/link'


export default function CartPage() {
  const items = useSelector((state: RootState) => state.cart.items)
  const dispatch = useDispatch()

  const totalPrice = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity)
  }, 0)

  return (
    <div style={{ padding: 40 }}>
      <h1>Кошик</h1>
        {items.length === 0 ? (
          <p>Кошик порожній</p>
        ) : (
          <div className="flex gap-4">
            <div>
              {items.map((item) => (
                <div key={item.variant_id} style={{ marginBottom: 16 }}>
                  <p>{item.name} - {item.brand_name}</p>
                  <img src={item.image_url} alt={item.name} style={{ width: 100, height: 100, objectFit: 'cover' }} />
                  <p>Розмір: {item.size}, Колір: {item.color}</p>
                  <p>Ціна: {item.price} грн, Кількість: {item.quantity}</p>
                  <button 
                    onClick={() => dispatch(increaseQuantity(item.variant_id))}
                    disabled={item.quantity === item.stock || item.quantity === MAX_QUANTITY}
                  >+</button>
                  <button 
                    onClick={() => dispatch(decreaseQuantity(item.variant_id))}
                    disabled={item.quantity < 2}
                  >-</button>
                  <button onClick={() => dispatch(removeItem(item.variant_id))}>Видалити</button> 
                </div>
              ))}
              <button onClick={() => dispatch(clearCart())}>Очистити кошик</button>
            </div>
            <div>
              <h2>Загальна сума: {totalPrice} грн</h2>
              <Link href="/checkout">
                <button>Оформити замовлення</button>
              </Link>
            </div>
          </div>
        )}
    </div>
  )
}