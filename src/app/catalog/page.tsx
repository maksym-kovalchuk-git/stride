import { getProducts } from '@/entities/product/api/getProducts'
import Link from 'next/link'

type CatalogPageProps = {
  searchParams: Promise<{
    category?: string
    brand?: string
    search?: string
    minPrice?: string
    maxPrice?: string
  }>
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams

  const products = await getProducts({
    categorySlug: params.category,
    brandSlug: params.brand,
    search: params.search,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
  })

  return (
    <div style={{ padding: 40 }}>
      <h1>Каталог</h1>

      {/* Пошук */}
      <form style={{ marginBottom: 20 }}>
        <input
          type="text"
          name="search"
          placeholder="Пошук за назвою..."
          defaultValue={params.search}
          style={{ padding: 8, width: 300 }}
        />
        <button type="submit" style={{ padding: 8, marginLeft: 8 }}>
          Знайти
        </button>
      </form>

      {/* Фільтри-посилання (найпростіший варіант для старту) */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
        <Link href="/catalog">Всі</Link>
        <Link href="/catalog?category=running">Для бігу</Link>
        <Link href="/catalog?category=basketball">Баскетбол</Link>
        <Link href="/catalog?category=casual">Casual</Link>
      </div>

      <p>Знайдено: {products.length}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 20 }}>
        {products.map((product) => (
          <Link key={product.id} href={`/product/${product.slug}`}>
            <div style={{ border: '1px solid #eee', padding: 16 }}>
              {product.images[0] && (
                <img src={product.images[0].url} alt={product.name} style={{ width: '100%' }} />
              )}
              <h3>{product.name}</h3>
              <p>{product.brand.name}</p>
              <p>{product.base_price} грн</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}