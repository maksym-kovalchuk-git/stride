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
}

export function PayOrderButton({ orderId, label = 'Оплатити', onClosed }: PayOrderButtonProps) {
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

  async function handleClick() {
    setIsLoading(true)
    const result = await requestPayment(orderId)

    switch (result.kind) {
      case 'redirected':
        // кнопка лишається вимкненою до переходу
        return
      case 'already_paid':
        router.push(`/checkout/success?orderId=${orderId}`)
        break
      case 'closed':
        toast.error(result.message)
        onClosed?.()
        break
      case 'error':
        toast.error(result.message)
        break
    }
    setIsLoading(false)
  }

  return (
    <button type="button" onClick={handleClick} disabled={isLoading}>
      {isLoading ? 'Переходимо до оплати…' : label}
    </button>
  )
}
