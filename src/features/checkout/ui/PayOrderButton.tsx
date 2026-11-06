'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { requestPayment } from '../model/requestPayment'

type PayOrderButtonProps = {
  orderId: string
  label?: string
  // Замовлення вже не оплатити — батьківський компонент може сховати себе чи оновити статус
  onClosed?: () => void
  // Статус замовлення змінився або ще з'ясовується: батьківський компонент перечитує його сам.
  // Без колбека — перехід на сторінку успіху, яка покаже статус
  onRefresh?: () => void
}

export function PayOrderButton({ orderId, label = 'Оплатити', onClosed, onRefresh }: PayOrderButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // «Назад» з LiqPay відновлює сторінку з bfcache разом зі станом — інакше кнопка лишилась би вимкненою
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) setIsLoading(false)
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  function refresh() {
    if (onRefresh) onRefresh()
    else router.push(`/checkout/success?orderId=${orderId}`)
  }

  async function handleClick() {
    setIsLoading(true)
    const result = await requestPayment(orderId)

    switch (result.kind) {
      case 'redirected':
        // кнопка лишається вимкненою до переходу
        return
      case 'already_paid':
        refresh()
        break
      case 'processing':
        toast(result.message)
        refresh()
        break
      case 'closed':
        toast.error(result.message)
        onClosed?.()
        break
      case 'error':
        toast.error(result.message)
        break
      default: {
        const unhandled: never = result
        throw new Error(`Unhandled payment result: ${JSON.stringify(unhandled)}`)
      }
    }
    setIsLoading(false)
  }

  return (
    <button type="button" onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Переходимо до оплати…' : label}
    </button>
  )
}
