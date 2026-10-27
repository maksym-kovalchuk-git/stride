import { useDebounce } from '@/shared/hooks/useDebounce'
import { useEffect, useState } from 'react'

import type { Warehouse } from '@/entities/delivery/model/types'

type WarehouseAutocompleteProps = {
  cityRef: string
  value: string
  onChange: (value: string) => void
  onSelect: (warehouse: Warehouse) => void
}

export function WarehouseAutocomplete({ cityRef, value, onChange, onSelect }: WarehouseAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [data, setData] = useState<Warehouse[]>([])
  const debouncedValue = useDebounce(value, 300)

  const warehousesToShow = debouncedValue
    ? data.filter((w) => w.description.toLowerCase().includes(debouncedValue.toLowerCase()))
    : data

  const handleSelectWarehouse = (warehouse: Warehouse) => {
    onChange(warehouse.description)
    onSelect(warehouse)
  }

  // Старий список при зміні міста не лишається: DeliveryForm дає компоненту key={cityRef},
  // тож для нового міста він монтується заново з порожнім станом
  useEffect(() => {
    if (!cityRef) return

    // Скасовуємо запит, якщо компонент розмонтовано до відповіді — відділення старого міста не потраплять у список
    const controller = new AbortController()

    async function searchWarehouses(cityRef: string) {
      try {
        const response = await fetch('/api/delivery/warehouses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ cityRef }),
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        setData(await response.json())
      } catch (error) {
        // Скасований запит — не помилка: не чіпаємо список, який уже належить новому запиту
        if (controller.signal.aborted) return
        console.error('Error fetching warehouses:', error)
        setData([]) // очищаємо дані у випадку помилки
      }
    }

    searchWarehouses(cityRef)
    return () => controller.abort()
  }, [cityRef])

  return (
    <>
      <input
        style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={!cityRef}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setIsFocused(false)
          }, 150)
        }}
      />

      {isFocused && warehousesToShow.length > 0 && (
      <ul>
        {warehousesToShow.map((warehouse) => (
          <li key={warehouse.ref} onClick={() => handleSelectWarehouse(warehouse)}>
            {warehouse.description}
          </li>
        ))}
      </ul>
      )}
    </>
  )
}