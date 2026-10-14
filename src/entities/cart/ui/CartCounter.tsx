'use client'

import { useSelector } from 'react-redux'
import Link from 'next/link'
import type { RootState } from '@/shared/store/store'

export function CartCounter() {
  const items = useSelector((state: RootState) => state.cart.items)

  return (
    <Link href="/cart">
      Кошик {items.reduce((sum, item) => sum + item.quantity, 0)}
    </Link>
  )
}