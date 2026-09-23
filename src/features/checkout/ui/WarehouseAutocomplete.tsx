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

  const handleSearchWarehouse = async (cityRef: string) => {
    try {
      const response = await fetch('/api/delivery/warehouses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cityRef })
      })
      setData(await response.json())
    } catch (error) {
      console.error('Error fetching warehouses:', error)
      setData([]) // очищаємо дані у випадку помилки
    }
  }

  const handleSelectWarehouse = (warehouse: Warehouse) => {
    onChange(warehouse.description)
    onSelect(warehouse)
  }

  useEffect(() => {
    if (cityRef) {
      handleSearchWarehouse(cityRef)
    }
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