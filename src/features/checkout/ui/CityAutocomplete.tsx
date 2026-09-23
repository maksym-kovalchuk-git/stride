import { useDebounce } from '@/shared/hooks/useDebounce'
import { useEffect, useState } from 'react'

import { POPULAR_CITIES } from '@/entities/delivery/model/popularCities'

import type { City } from '@/entities/delivery/model/types'

type CityAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  onSelect: (city: City) => void
}

export function CityAutocomplete({ value, onChange, onSelect }: CityAutocompleteProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [data, setData] = useState<City[]>([])
  const debouncedValue = useDebounce(value, 300)

  const citiesToShow = debouncedValue ? data : POPULAR_CITIES

  const handleSearchCity = async (query: string) => {
    try {
      const response = await fetch('/api/delivery/cities', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
      })
      setData(await response.json())
    } catch (error) {
      console.error('Error fetching cities:', error)
      setData([]) // очищаємо дані у випадку помилки
    }
  }

  const handleSelectCity = (city: City) => {
    onChange(city.description)
    onSelect(city)
    setData([])
  }

  useEffect(() => {
    if (debouncedValue) {
      handleSearchCity(debouncedValue)
    }
  }, [debouncedValue]) 

  return (
    <>
      <input
        style={{ width: '100%', border: '1px solid #ccc', borderRadius: '4px' }}
        value={value}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setTimeout(() => {
            setData([])
            setIsFocused(false)
          }, 150)
        }}
        onChange={(e) => onChange(e.target.value)}
      />

      {isFocused && citiesToShow.length > 0 && (
      <ul>
        {citiesToShow.map((city) => (
          <li key={city.ref} onClick={() => handleSelectCity(city)}>
            {city.description}
          </li>
        ))}
      </ul>
      )}
    </>
  )
}