import { useSyncExternalStore } from 'react'

// Незавершене замовлення card_online у браузері: записуємо перед переходом на LiqPay, щоб після
// «Назад» чи закритої вкладки запропонувати оплатити його, а не оформлювати нове (дубль резерву).
// localStorage може бути недоступним (приватний режим, заблоковані дані) — тоді просто без банера
const STORAGE_KEY = 'stride:pendingOrderId'
// storage-подія приходить лише з інших вкладок; для поточної шлемо власну
const CHANGE_EVENT = 'stride:pending-order-change'

function read(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function setPendingOrder(orderId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, orderId)
  } catch {
    // без localStorage банера не буде — оплата працює й так
  }
  notify()
}

// Чистимо лише своє замовлення: інша вкладка могла вже записати нове
export function clearPendingOrder(orderId: string): void {
  try {
    if (localStorage.getItem(STORAGE_KEY) === orderId) localStorage.removeItem(STORAGE_KEY)
  } catch {
    // нічого чистити
  }
  notify()
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

// На сервері й під час гідратації — null, тож банер з'являється лише після монтування
export function usePendingOrderId(): string | null {
  return useSyncExternalStore(subscribe, read, () => null)
}
