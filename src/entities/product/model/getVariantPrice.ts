import type { Product, ProductVariant } from './types'

export function getVariantPrice(
  variant: Pick<ProductVariant, 'price_override'>,
  product: Pick<Product, 'base_price'>
): number {
  return variant.price_override ?? product.base_price
}
