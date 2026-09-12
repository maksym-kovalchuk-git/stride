import { combineReducers, configureStore } from '@reduxjs/toolkit';
import cartReducer from '@/features/add-to-cart/model/cartSlice';

const rootReducer = combineReducers({ cart: cartReducer });

export type RootState = ReturnType<typeof rootReducer>;

export const makeStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
  })
}

export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore['dispatch'];