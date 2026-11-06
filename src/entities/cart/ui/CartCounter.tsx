'use client'

import { useSelector } from 'react-redux'
import Link from 'next/link'
import { selectCartItems } from '../model/cartSlice'

export function CartCounter() {
  const items = useSelector(selectCartItems)

  return (
    <Link href="/cart">
      Кошик {items.reduce((sum, item) => sum + item.quantity, 0)}
    </Link>
  )
}