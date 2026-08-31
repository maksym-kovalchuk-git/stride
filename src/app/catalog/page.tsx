import { getProducts } from '@/entities/product/api/getProducts'
import Link from 'next/link'

type CatalogPageProps = {
  searchParams: Promise<{
    category?: string
    brand?: string
    search?: string
    minPrice?: string
    maxPrice?: string
    size?: string
    color?: string
  }>
}

const ALL_SIZES = [40, 41, 42, 43, 44]
const ALL_COLORS = ['black', 'white', 'grey', 'orange', 'red', 'brown', 'blue']
const ALL_BRANDS = [
  { slug: 'vantera', name: 'Vantera' },
  { slug: 'nordrun', name: 'Nordrun' },
  { slug: 'kaelo', name: 'Kaelo' },
  { slug: 'stratos', name: 'Stratos' },
]
const ALL_SEASONS = [
  { value: 'spring_summer', label: 'Весна-літо' },
  { value: 'demi_season', label: 'Демісезон' },
  { value: 'winter', label: 'Зима' },
  { value: 'all_season', label: '4 сезони' },
]

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams

  const products = await getProducts({
    categorySlug: params.category,
    brandSlug: params.brand,
    search: params.search,
    minPrice: params.minPrice ? Number(params.minPrice) : undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    size: params.size ? Number(params.size) : undefined,
    color: params.color,
  })

  const buildUrl = (key: string, value: string | undefined) => {
    const sp = new URLSearchParams(params as Record<string, string>)
    if (value) {
      sp.set(key, value)
    } else {
      sp.delete(key)
    }
    return `/catalog?${sp.toString()}`
  }

  return (
    <div style={{ padding: 40, display: 'flex', gap: 40 }}>
      <aside style={{ minWidth: 200 }}>
        <h3>Категорія</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href={buildUrl('category', undefined)}>Всі</Link>
          <Link href={buildUrl('category', 'running')}>Для бігу</Link>
          <Link href={buildUrl('category', 'basketball')}>Баскетбол</Link>
          <Link href={buildUrl('category', 'casual')}>Casual</Link>
        </div>

        <h3 style={{ marginTop: 20 }}>Бренд</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href={buildUrl('brand', undefined)}>Всі</Link>
          {ALL_BRANDS.map((b) => (
            <Link key={b.slug} href={buildUrl('brand', b.slug)}>
              {b.name}
            </Link>
          ))}
        </div>

        <h3 style={{ marginTop: 20 }}>Розмір</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <Link href={buildUrl('size', undefined)}>Всі</Link>
          {ALL_SIZES.map((s) => (
            <Link key={s} href={buildUrl('size', String(s))} style={{ marginRight: 8 }}>
              {s}
            </Link>
          ))}
        </div>

        <h3 style={{ marginTop: 20 }}>Сезон</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href={buildUrl('season', undefined)}>Всі</Link>
          {ALL_SEASONS.map((s) => (
            <Link key={s.value} href={buildUrl('season', s.value)}>
              {s.label}
            </Link>
          ))}
        </div>

        <h3 style={{ marginTop: 20 }}>Колір</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link href={buildUrl('color', undefined)}>Всі</Link>
          {ALL_COLORS.map((c) => (
            <Link key={c} href={buildUrl('color', c)}>
              {c}
            </Link>
          ))}
        </div>

        {/* Фільтр ціни */}
        <h3 style={{ marginTop: 20 }}>Ціна, грн</h3>
        <form method="GET" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Приховані поля — щоб не втратити інші активні фільтри при сабміті */}
          {params.category && <input type="hidden" name="category" value={params.category} />}
          {params.brand && <input type="hidden" name="brand" value={params.brand} />}
          {params.search && <input type="hidden" name="search" value={params.search} />}
          {params.size && <input type="hidden" name="size" value={params.size} />}
          {params.color && <input type="hidden" name="color" value={params.color} />}

          <input
            type="number"
            name="minPrice"
            placeholder="Від"
            defaultValue={params.minPrice}
            style={{ padding: 6, width: '100%' }}
          />
          <input
            type="number"
            name="maxPrice"
            placeholder="До"
            defaultValue={params.maxPrice}
            style={{ padding: 6, width: '100%' }}
          />
          <button type="submit" style={{ padding: 6 }}>
            Застосувати
          </button>
        </form>
      </aside>

      <div style={{ flex: 1 }}>
        <h1>Каталог</h1>

        <form style={{ marginBottom: 20 }}>
          {params.category && <input type="hidden" name="category" value={params.category} />}
          {params.brand && <input type="hidden" name="brand" value={params.brand} />}
          {params.size && <input type="hidden" name="size" value={params.size} />}
          {params.color && <input type="hidden" name="color" value={params.color} />}
          {params.minPrice && <input type="hidden" name="minPrice" value={params.minPrice} />}
          {params.maxPrice && <input type="hidden" name="maxPrice" value={params.maxPrice} />}
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
    </div>
  )
}