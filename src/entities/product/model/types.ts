export type Product = {
  id: string
  brand_id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  base_price: number
  is_active: boolean
  created_at: string
}

export type ProductVariant = {
  id: string
  product_id: string
  size: number
  color: string
  sku: string
  stock: number
  price_override: number | null
}

export type ProductImage = {
  id: string
  product_id: string
  variant_id: string | null
  url: string
  position: number
}

export type Brand = {
  id: string
  name: string
  slug: string
}

export type Category = {
  id: string
  name: string
  slug: string
}

export type ProductWithRelations = Product & {
  brand: Brand
  category: Category
  images: ProductImage[]
  variants: ProductVariant[]
}