'use client'

import { Toaster } from 'react-hot-toast'

// Окрема клієнтська обгортка, щоб серверний RootLayout не імпортував клієнтський компонент напряму
export function AppToaster() {
  return <Toaster position="top-center" />
}
