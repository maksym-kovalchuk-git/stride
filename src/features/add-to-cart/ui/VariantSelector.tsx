'use client'

import { useState, useMemo } from 'react'
import { useDispatch } from 'react-redux'

import type { ProductWithRelations } from '@/entities/product/model/types'

import { addItem } from '@/features/add-to-cart/model/cartSlice'

type VariantSelectorProps = {
  product: ProductWithRelations
}



export function VariantSelector({ product }: VariantSelectorProps) {
  const variants = product.variants
  const dispatch = useDispatch()

  const uniqueSizes = useMemo(
    () => [...new Set(variants.map((v) => v.size))].sort((a, b) => a - b),
    [variants]
  )
  const uniqueColors = useMemo(
    () => [...new Set(variants.map((v) => v.color))],
    [variants]
  )

  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [selectedColor, setSelectedColor] = useState<string | null>(uniqueColors[0] ?? null)

  const selectedVariant = variants.find(
    (v) => v.size === selectedSize && v.color === selectedColor
  )

  const isSizeAvailable = (size: number) =>
    variants.some((v) => v.size === size && (!selectedColor || v.color === selectedColor) && v.stock > 0)

  const isColorAvailable = (color: string) =>
    variants.some((v) => v.color === color && v.stock > 0)

  const handleSizeClick = (size: number) => {
    // Повторний клік по вже обраному розміру — знімає вибір
    setSelectedSize((prev) => (prev === size ? null : size))
  }

  const handleColorClick = (color: string) => {
    // Колір завжди має бути обраним — повторний клік нічого не знімає,
    // лише перемикання на інший колір скидає розмір
    if (color === selectedColor) return
    setSelectedColor(color)
    setSelectedSize(null)
  }

  

  const handleAddToCart = () => {
    if (!selectedVariant) return

    const cartItem = {
      variant_id: selectedVariant.id,
      product_id: product.id,
      name: product.name,
      brand_name: product.brand.name,
      image_url: product.images[0]?.url || '',
      size: selectedVariant.size,
      color: selectedVariant.color,
      price: selectedVariant.price_override ?? product.base_price,
      stock: selectedVariant.stock,
    }

    dispatch(addItem(cartItem))
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Колір</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {uniqueColors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorClick(color)}
              disabled={!isColorAvailable(color)}
              style={{
                padding: '6px 12px',
                border: selectedColor === color ? '2px solid black' : '1px solid #ccc',
                opacity: isColorAvailable(color) ? 1 : 0.4,
                cursor: isColorAvailable(color) ? 'pointer' : 'not-allowed',
              }}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Розмір</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {uniqueSizes.map((size) => (
            <button
              key={size}
              onClick={() => handleSizeClick(size)}
              disabled={!isSizeAvailable(size)}
              style={{
                padding: '6px 12px',
                border: selectedSize === size ? '2px solid black' : '1px solid #ccc',
                opacity: isSizeAvailable(size) ? 1 : 0.4,
                cursor: isSizeAvailable(size) ? 'pointer' : 'not-allowed',
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {selectedVariant && (
        <p style={{ marginBottom: 12, color: selectedVariant.stock > 0 ? 'green' : 'red' }}>
          {selectedVariant.stock > 0
            ? `В наявності: ${selectedVariant.stock} шт.`
            : 'Немає в наявності'}
        </p>
      )}

      <button
        onClick={handleAddToCart}
        disabled={!selectedVariant || selectedVariant.stock === 0}
        style={{
          padding: '12px 24px',
          background: selectedVariant && selectedVariant.stock > 0 ? 'black' : '#ccc',
          color: 'white',
          border: 'none',
          cursor: selectedVariant && selectedVariant.stock > 0 ? 'pointer' : 'not-allowed',
        }}
      >
        Додати в кошик
      </button>
    </div>
  )
}
