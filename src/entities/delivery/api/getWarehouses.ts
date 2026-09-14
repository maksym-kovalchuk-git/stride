export async function getWarehouses(cityRef: string){
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

  const res = await response.json()

  return res.data.map((warehouse: any) => ({
    ref: warehouse.Ref,
    description: warehouse.Description,
  }))
}