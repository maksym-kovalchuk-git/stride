'use client'

import { useEffect } from 'react'

import { fetchOrderStatus } from '../model/orderStatus'
import { clearPendingOrder, usePendingOrderId } from '../model/pendingOrder'
import { PayOrderButton } from './PayOrderButton'

// «У вас є неоплачене замовлення» — щоб після «Назад» з LiqPay чи закритої вкладки
// користувач оплатив наявне замовлення, а не оформив нове з другим резервом
export function PendingOrderBanner() {
  const orderId = usePendingOrderId()

  // Запис у браузері міг застаріти (оплачено, скасовано, час минув) — тоді прибираємо банер
  useEffect(() => {
    if (!orderId) return
    fetchOrderStatus(orderId).then((result) => {
      if (result.kind === 'not_found' || (result.kind === 'ok' && !result.data.canPay)) {
        clearPendingOrder(orderId)
      }
    })
  }, [orderId])

  if (!orderId) return null

  return (
    <div role="status" style={{ padding: 12, marginBottom: 16, border: '1px solid #ccc' }}>
      <p>У вас є неоплачене замовлення.</p>
      <PayOrderButton orderId={orderId} onClosed={() => clearPendingOrder(orderId)} />
    </div>
  )
}
