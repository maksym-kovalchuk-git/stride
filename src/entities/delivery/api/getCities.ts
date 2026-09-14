import type { City } from '../model/types'

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

  const res = await response.json()

  return res.data.map((city: any) => ({
    ref: city.Ref,
    description: city.Description,
    areaDescription: city.AreaDescription,
  }))
}