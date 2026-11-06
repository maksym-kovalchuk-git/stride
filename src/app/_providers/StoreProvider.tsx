'use client'

import { useEffect, useState } from 'react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { hydrateCart } from '@/entities/cart/model/cartSlice'

import type { CartState } from '@/entities/cart/model/cartSlice'

function saveToLocalStorage(state: CartState) {
  try {
    const serializedState = JSON.stringify(state)
    localStorage.setItem('cartState', serializedState)
  } catch (e) {
    console.warn('Не вдалося зберегти стан', e)
  }
}

function loadFromLocalStorage(): CartState | undefined {
  try {
    const serializedState = localStorage.getItem('cartState')
    if (serializedState === null) return undefined
    return JSON.parse(serializedState)
  } catch (e) {
    console.warn('Не вдалося завантажити стан', e)
    return undefined
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Функція без виклику — лінива ініціалізація: стор створюється один раз, при першому рендері.
  // Стартує з порожнім кошиком, щоб перший клієнтський рендер збігався із серверним і не ламав hydration.
  const [store] = useState(makeStore)

  // Зберігаємо стан кошика в localStorage при кожній зміні; subscribe повертає функцію відписки
  useEffect(() => store.subscribe(() => {
    saveToLocalStorage(store.getState().cart)
  }), [store])

  // У StrictMode ефект виконається двічі — безпечно: hydrateCart замінює items, а не додає
  useEffect(() => {
    const cartState = loadFromLocalStorage()
    if (cartState) {
      store.dispatch(hydrateCart(cartState.items))
    }
  }, [store])

  return (
    <Provider store={store}>
      {children}
    </Provider>
  )
}
