'use client'

import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import Link from 'next/link'

import { clearCart } from '@/entities/cart/model/cartSlice'

import {
  fetchOrderStatus,
  isAcceptedStatus,
  isFailedLiqpayStatus,
  type OrderStatusResponse,
} from '../model/orderStatus'
import { clearPendingOrder } from '../model/pendingOrder'
import { PayOrderButton } from './PayOrderButton'

// Callback LiqPay може прийти пізніше за редирект на result_url — чекаємо до хвилини
const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 24

type ViewState =
  | { kind: 'loading' }
  | { kind: 'not_found' }
  | { kind: 'error' }
  | { kind: 'loaded'; data: OrderStatusResponse; pollingDone: boolean }

// Чи варто ще чекати на callback: замовлення pending і LiqPay ще не повідомив про відмову
function shouldKeepPolling(data: OrderStatusResponse): boolean {
  return data.status === 'pending' && !isFailedLiqpayStatus(data.liqpayStatus)
}

// Сам перехід на result_url нічого не доводить: LiqPay повертає сюди і після оплати,
// і після «Скасувати». Тому показуємо лише те, що бачимо в базі
export function OrderStatusView({ orderId }: { orderId: string }) {
  const dispatch = useDispatch()
  const [state, setState] = useState<ViewState>({ kind: 'loading' })
  // Ключ перезапуску опитування — після невдалої спроби «Спробувати ще раз»
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const load = (attempt: number) => {
      fetchOrderStatus(orderId).then((result) => {
        if (cancelled) return
        if (result.kind !== 'ok') {
          setState({ kind: result.kind })
          return
        }
        const keepPolling = shouldKeepPolling(result.data) && attempt + 1 < POLL_MAX_ATTEMPTS
        setState({ kind: 'loaded', data: result.data, pollingDone: !keepPolling })
        if (keepPolling) timer = setTimeout(() => load(attempt + 1), POLL_INTERVAL_MS)
      })
    }
    load(0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [orderId, reloadKey])

  const status = state.kind === 'loaded' ? state.data.status : null

  // Кошик чистимо лише на підтверджене замовлення; незавершене — забуваємо, коли воно вже фінальне
  useEffect(() => {
    if (!status) return
    if (isAcceptedStatus(status)) {
      dispatch(clearCart())
      clearPendingOrder(orderId)
    } else if (status === 'cancelled') {
      clearPendingOrder(orderId)
    }
  }, [status, orderId, dispatch])

  if (state.kind === 'loading') {
    return <p>Перевіряємо статус замовлення…</p>
  }

  if (state.kind === 'not_found') {
    return (
      <>
        <h1>Замовлення не знайдено</h1>
        <Link href="/cart">Повернутися до кошика</Link>
      </>
    )
  }

  if (state.kind === 'error') {
    return (
      <>
        <h1>Не вдалося отримати статус замовлення</h1>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
          Спробувати ще раз
        </button>
      </>
    )
  }

  const { data, pollingDone } = state

  if (isAcceptedStatus(data.status)) {
    return (
      <>
        <h1>Дякуємо за замовлення!</h1>
        <p>{data.status === 'paid' ? `Оплату ${data.amount} грн отримано.` : 'Замовлення прийнято.'}</p>
        <p>Номер замовлення: {orderId}</p>
      </>
    )
  }

  if (data.status === 'cancelled') {
    return (
      <>
        <h1>Замовлення скасовано</h1>
        <p>Час на оплату минув, і товари повернулись у продаж. Оформіть замовлення ще раз.</p>
        <Link href="/cart">Повернутися до кошика</Link>
      </>
    )
  }

  // pending: або ще чекаємо callback, або оплата не пройшла / користувач скасував
  const failed = isFailedLiqpayStatus(data.liqpayStatus)

  if (!failed && !pollingDone) {
    return (
      <>
        <h1>Очікуємо підтвердження оплати…</h1>
        <p>Це може зайняти до хвилини.</p>
      </>
    )
  }

  return (
    <>
      <h1>{failed ? 'Оплата не пройшла' : 'Оплату не підтверджено'}</h1>
      {!failed && <p>Якщо ви вже оплатили, статус оновиться трохи пізніше.</p>}
      {data.canPay ? (
        <PayOrderButton
          orderId={orderId}
          label="Спробувати ще раз"
          onClosed={() => setReloadKey((key) => key + 1)}
        />
      ) : (
        <>
          <p>Час на оплату цього замовлення минув. Оформіть замовлення ще раз.</p>
          <Link href="/cart">Повернутися до кошика</Link>
        </>
      )}
    </>
  )
}
