'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { schema } from '../model/schema'

import { CityAutocomplete } from './CityAutocomplete'
import { WarehouseAutocomplete } from './WarehouseAutocomplete'

import type { City, Warehouse } from '@/entities/delivery/model/types'
import type { CheckoutFormData } from '../model/schema'

export function DeliveryForm() {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CheckoutFormData>({
    resolver: zodResolver(schema),
  })

  const [cityText, setCityText] = useState('')
  const [warehouseText, setWarehouseText] = useState('')

  const cityRef = watch('cityRef')

  function handleSelectCity(city: City) {
    setValue('cityRef', city.ref, { shouldValidate: true })
    setWarehouseText('')
    setValue('warehouseRef', '', { shouldValidate: true })
  }

  function handleSelectWarehouse(warehouse: Warehouse) {
    setValue('warehouseRef', warehouse.ref, { shouldValidate: true })
  }

  function onSubmit(data: CheckoutFormData) {
    console.log(data)
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
        onChange={setCityText}
        onSelect={handleSelectCity}
      />
      {errors.cityRef && <span>{errors.cityRef.message}</span>}
      <WarehouseAutocomplete
        cityRef={cityRef ?? ''}
        value={warehouseText}
        onChange={setWarehouseText}
        onSelect={handleSelectWarehouse}
      />
      {errors.warehouseRef && <span>{errors.warehouseRef.message}</span>}
      <input type="radio" value="card_online" {...register('paymentMethod')} /> Card Online
      <input type="radio" value="after_delivery" {...register('paymentMethod')} /> After Delivery
      {errors.paymentMethod && <span>{errors.paymentMethod.message}</span>}
      <button type="submit">Submit</button>
    </form>
  )
}