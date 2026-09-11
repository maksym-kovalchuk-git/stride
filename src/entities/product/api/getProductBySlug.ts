import { createClient } from '@/shared/lib/supabase/server'
import type { ProductWithRelations } from '../model/types'

export async function getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      brand:brands(*),
      category:categories(*),
      images:product_images(*),
      variants:product_variants(*)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching product:', error)
    return null
  }

  return data as ProductWithRelations
}