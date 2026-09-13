'use client'

import { useEffect, useRef } from 'react'
import { Provider } from 'react-redux'
import { makeStore } from './store'
import { hydrateCart } from '@/features/add-to-cart/model/cartSlice'

import type { AppStore } from './store'
import type { CartState } from '@/features/add-to-cart/model/cartSlice'

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
  const storeRef = useRef<AppStore | null>(null)

  if (!storeRef.current) {
    // Стор завжди стартує з порожнім кошиком, щоб перший клієнтський
    // рендер збігався із серверним і не ламав hydration.
    const store = makeStore()
    storeRef.current = store
    store.subscribe(() => {
      saveToLocalStorage(store.getState().cart) // зберігаємо стан кошика в localStorage при кожній зміні
    })
  }

  useEffect(() => {
    const cartState = loadFromLocalStorage()
    if (cartState) {
      storeRef.current?.dispatch(hydrateCart(cartState.items))
    }
  }, [])

  return (
    <Provider store={storeRef.current}>
      {children}
    </Provider>
  )
}
