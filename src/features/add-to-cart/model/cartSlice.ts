import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { CartItem } from './types'

export type CartState = {
  items: CartItem[]
}

export const MAX_QUANTITY = 10

function isAddable(item: CartItem): boolean {
  return item.quantity < item.stock && item.quantity < MAX_QUANTITY
}

const initialState: CartState = {
  items: [],
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<Omit<CartItem, 'quantity'>>) => {
      const existingItem = state.items.find(item => item.variant_id === action.payload.variant_id)
      
      if (existingItem) {
        if (isAddable(existingItem)) {
          existingItem.quantity += 1
        }
      } else {
        // Якщо товару ще немає в кошику, додаємо його з quantity: 1
        state.items.push({ ...action.payload, quantity: 1 })
      }
    },

    increaseQuantity: (state, action: PayloadAction<string>) => {
      const item = state.items.find(item => item.variant_id === action.payload)
      if (item && isAddable(item)) {
        item.quantity += 1
      }
    },

    decreaseQuantity: (state, action: PayloadAction<string>) => {
      const item = state.items.find(item => item.variant_id === action.payload)
      if (item && item.quantity > 1) {
        item.quantity -= 1
      }
    },

    removeItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(item => item.variant_id !== action.payload)
    },

    clearCart: (state) => {
      state.items = []
    },

    hydrateCart: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload
    },
  },
})

export const { addItem, increaseQuantity, decreaseQuantity, removeItem, clearCart, hydrateCart } = cartSlice.actions
export default cartSlice.reducer