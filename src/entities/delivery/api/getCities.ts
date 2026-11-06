import type { City } from '../model/types'

type NpCity = {
  Ref: string
  Description: string
  AreaDescription: string
}

export async function getCities(query: string): Promise<City[]> {
  const response = await fetch('https://api.novaposhta.ua/v2.0/json/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: process.env.NP_API_KEY,
      modelName: 'Address',
      calledMethod: 'getCities',
      methodProperties: {
        FindByString: query,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Nova Poshta getCities: HTTP ${response.status}`)
  }

  const res = await response.json()

  // НП відповідає 200 навіть на помилку: причина — у success/errors, а data тоді може бути відсутнім
  if (!res.success || !Array.isArray(res.data)) {
    throw new Error(`Nova Poshta getCities failed: ${JSON.stringify(res.errors ?? res)}`)
  }

  return res.data.map((city: NpCity) => ({
    ref: city.Ref,
    description: city.Description,
    areaDescription: city.AreaDescription,
  }))
}
