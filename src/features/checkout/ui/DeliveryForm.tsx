'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useDispatch, useSelector } from 'react-redux'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

import { schema } from '../model/schema'
import { getOrderErrorMessage, DEFAULT_ORDER_ERROR } from '../model/orderErrors'
import { clearCart, selectCartItems } from '@/entities/cart/model/cartSlice'

import { CityAutocomplete } from './CityAutocomplete'
import { WarehouseAutocomplete } from './WarehouseAutocomplete'

import type { City, Warehouse } from '@/entities/delivery/model/types'
import type { CheckoutFormData } from '../model/schema'

export function DeliveryForm() {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting, isSubmitted } } = useForm<CheckoutFormData>({
    resolver: zodResolver(schema),
  })

  const items = useSelector(selectCartItems)
  const dispatch = useDispatch()
  const router = useRouter()

  // Один ключ на спробу оформлення: створюється один раз при монтуванні,
  // змінюється лише після 400/409 (див. onSubmit)
  const idempotencyKeyRef = useRef<string | null>(null)
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = crypto.randomUUID()
  }

  const [cityText, setCityText] = useState('')
  const [warehouseText, setWarehouseText] = useState('')
  // Назви фіксуються лише в момент вибору зі списку — разом із ref
  const [selectedCityName, setSelectedCityName] = useState('')
  const [selectedWarehouseName, setSelectedWarehouseName] = useState('')

  const cityRef = watch('cityRef')

  function resetWarehouse() {
    setWarehouseText('')
    setSelectedWarehouseName('')
    setValue('warehouseRef', '', { shouldValidate: isSubmitted })
  }

  // Ручне редагування скидає вибір: валідне місто = явний клік по списку.
  // Автокомпліт при кліку спершу викликає onChange, потім onSelect, тож вибір відновлюється одразу
  function handleCityTextChange(text: string) {
    setCityText(text)
    setSelectedCityName('')
    setValue('cityRef', '', { shouldValidate: isSubmitted })
    resetWarehouse()
  }

  function handleWarehouseTextChange(text: string) {
    setWarehouseText(text)
    setSelectedWarehouseName('')
    setValue('warehouseRef', '', { shouldValidate: isSubmitted })
  }

  function handleSelectCity(city: City) {
    setValue('cityRef', city.ref, { shouldValidate: true })
    setSelectedCityName(city.description)
  }

  function handleSelectWarehouse(warehouse: Warehouse) {
    setValue('warehouseRef', warehouse.ref, { shouldValidate: true })
    setSelectedWarehouseName(warehouse.description)
  }

  async function onSubmit(data: CheckoutFormData) {
    if (items.length === 0) {
      toast.error('Кошик порожній')
      return
    }

    let res: Response
    try {
      res = await fetch('/api/checkout/create_order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          formData: data,
          cityName: selectedCityName,
          warehouseName: selectedWarehouseName,
          // Ціну, назву й фото сервер не приймає — лише що і скільки
          items: items.map(({ variant_id, quantity }) => ({ variant_id, quantity })),
        }),
      })
    } catch {
      // Мережева помилка: замовлення могло створитись — ключ лишаємо, повтор поверне те саме
      toast.error(DEFAULT_ORDER_ERROR)
      return
    }

    const body = await res.json().catch(() => null)

    if (!res.ok) {
      // 400/409: користувач щось змінить, тож наступна спроба — нова. На 500 ключ лишаємо.
      // Автоматично не повторюємо: старе замовлення могло створитись і висіти резервом
      if (res.status === 400 || res.status === 409) {
        idempotencyKeyRef.current = crypto.randomUUID()
      }
      toast.error(getOrderErrorMessage(body?.error))
      return
    }

    if (!body) {
      toast.error(DEFAULT_ORDER_ERROR)
      return
    }

    if (body.nextStep === 'success') {
      dispatch(clearCart())
      router.push(`/checkout/success?orderId=${body.orderId}`)
      return
    }

    // nextStep === 'pay' — крок LiqPay; кошик не чистимо до підтвердженої оплати
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('firstName')}
        placeholder="Name"
      />
      {errors.firstName && <span>{errors.firstName.message}</span>}
      <input
        {...register('lastName')}
        placeholder="Last Name"
      />
      {errors.lastName && <span>{errors.lastName.message}</span>}
      <input
        {...register('phone')}
        placeholder="Phone"
      />
      {errors.phone && <span>{errors.phone.message}</span>}
      <CityAutocomplete
        value={cityText}
        onChange={handleCityTextChange}
        onSelect={handleSelectCity}
      />
      {errors.cityRef && <span>{errors.cityRef.message}</span>}
      <WarehouseAutocomplete
        cityRef={cityRef ?? ''}
        value={warehouseText}
        onChange={handleWarehouseTextChange}
        onSelect={handleSelectWarehouse}
      />
      {errors.warehouseRef && <span>{errors.warehouseRef.message}</span>}
      <input type="radio" value="card_online" {...register('paymentMethod')} /> Card Online
      <input type="radio" value="after_delivery" {...register('paymentMethod')} /> After Delivery
      {errors.paymentMethod && <span>{errors.paymentMethod.message}</span>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Оформлюємо…' : 'Оформити замовлення'}
      </button>
    </form>
  )
}
