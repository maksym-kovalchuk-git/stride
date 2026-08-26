import { createClient } from '@/shared/lib/supabase/server'
import type { ProductWithRelations } from '../model/types'

export async function getProducts(): Promise<ProductWithRelations[]> {
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
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching products:', error)
    return []
  }

  return data as ProductWithRelations[]
}