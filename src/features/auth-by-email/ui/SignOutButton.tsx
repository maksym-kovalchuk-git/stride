'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '../../../shared/lib/supabase/client'

export function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button onClick={handleSignOut} style={{ padding: '8px 16px', cursor: 'pointer' }}>
      Вийти
    </button>
  )
}