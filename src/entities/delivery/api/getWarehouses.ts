import type { Warehouse } from '../model/types'

type NpWarehouse = {
  Ref: string
  Description: string
  CityDescription: string
}

export async function getWarehouses(cityRef: string): Promise<Warehouse[]> {
  const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: process.env.NP_API_KEY,
      modelName: 'AddressGeneral',
      calledMethod: 'getWarehouses',
      methodProperties: {
        CityRef: cityRef,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Nova Poshta getWarehouses: HTTP ${response.status}`)
  }

  const res = await response.json()

  // НП відповідає 200 навіть на помилку: причина — у success/errors, а data тоді може бути відсутнім
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(`Nova Poshta getWarehouses failed: ${JSON.stringify(res.errors ?? res)}`)
  }

  return res.data.map((warehouse: NpWarehouse) => ({
    ref: warehouse.Ref,
    description: warehouse.Description,
    cityDescription: warehouse.CityDescription,
  }))
}
