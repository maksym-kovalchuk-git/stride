import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { getProductBySlug } from '@/entities/product/api/getProductBySlug'
import { VariantSelector } from '@/features/add-to-cart/ui/VariantSelector'

const SEASON_LABELS: Record<string, string> = {
  spring_summer: 'Весна-літо',
  demi_season: 'Демісезон',
  winter: 'Зима',
  all_season: '4 сезони',
}

const GENDER_LABELS: Record<string, string> = {
  male: 'Чоловіча',
  female: 'Жіноча',
  kids: 'Дитяча',
}

type ProductPageProps = {
  params: Promise<{ slug: string }>
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  return (
    <div style={{ padding: 40, display: 'flex', gap: 40 }}>
      <div style={{ flex: 1 }}>
        {product.images[0] && (
          <img
            src={product.images[0].url}
            alt={product.name}
            style={{ width: '100%' }}
          />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <p style={{ color: '#666' }}>{product.brand.name}</p>
        <h1>{product.name}</h1>
        <p style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          {product.base_price} грн
        </p>

        <VariantSelector product={product} />

        {/* Таблиця характеристик */}
        <table style={{ width: '100%', marginTop: 24, borderCollapse: 'collapse' }}>
          <tbody>
            <tr style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: '8px 0', color: '#666' }}>Бренд</td>
              <td style={{ padding: '8px 0', fontWeight: 500 }}>{product.brand.name}</td>
            </tr>
            <tr style={{ borderTop: '1px solid #eee' }}>
              <td style={{ padding: '8px 0', color: '#666' }}>Категорія</td>
              <td style={{ padding: '8px 0', fontWeight: 500 }}>{product.category.name}</td>
            </tr>
            {product.gender && (
              <tr style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '8px 0', color: '#666' }}>Стать</td>
                <td style={{ padding: '8px 0', fontWeight: 500 }}>{GENDER_LABELS[product.gender]}</td>
              </tr>
            )}
            {product.season && (
              <tr style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '8px 0', color: '#666' }}>Сезон</td>
                <td style={{ padding: '8px 0', fontWeight: 500 }}>{SEASON_LABELS[product.season]}</td>
              </tr>
            )}
            {product.material && (
              <tr style={{ borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px 0', color: '#666' }}>Матеріал</td>
                <td style={{ padding: '8px 0', fontWeight: 500 }}>{product.material}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Markdown-опис */}
        {product.description && (
          <div style={{ marginTop: 24 }}>
            <ReactMarkdown>{product.description}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}