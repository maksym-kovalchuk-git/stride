import { getProducts } from '@/entities/product/api/getProducts'

export default async function CatalogPage() {
  const products = await getProducts()

  return (
    <>
      <h1>Каталог</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 20 }}>
        {products.map((product) => (
          <div key={product.id} style={{ border: '1px solid #eee', padding: 16 }}>
            {product.images[0] && (
              <img src={product.images[0].url} alt={product.name} style={{ width: '100%' }} />
            )}
            <h3>{product.name}</h3>
            <p>{product.brand.name}</p>
            <p>{product.base_price} грн</p>
          </div>
        ))}
      </div>
    </>
  )
}