import { createClient } from '@/shared/lib/supabase/server'
import type { ProductWithRelations } from '../model/types'

type GetProductsParams = {
  categorySlug?: string
  brandSlug?: string
  search?: string
  minPrice?: number
  maxPrice?: number
}

export async function getProducts(params: GetProductsParams = {}): Promise<ProductWithRelations[]> {
  const supabase = await createClient()

  let query = supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:categories(*),
      images:product_images(*),
      variants:product_variants(*)
    `)
    .eq('is_active', true)

  if (params.search) {
    query = query.ilike('name', `%${params.search}%`)
  }

  if (params.minPrice) {
    query = query.gte('base_price', params.minPrice)
  }

  if (params.maxPrice) {
    query = query.lte('base_price', params.maxPrice)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  let result = data as ProductWithRelations[]

  if (params.categorySlug) {
    result = result.filter((p) => p.category.slug === params.categorySlug)
  }

  if (params.brandSlug) {
    result = result.filter((p) => p.brand.slug === params.brandSlug)
  }

  return result
}