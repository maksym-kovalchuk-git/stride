import Link from 'next/link'
import { createClient } from '@/shared/lib/supabase/server'
import { SignOutButton } from '@/features/auth-by-email/ui/SignOutButton'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header>
      <div>
        <Link href="/">
          Stride
        </Link>

        {user ? (
          <>
            <h3>Logged in as: {user.email}</h3>
            <SignOutButton />
          </>
        ) : (
          <Link href="/login">Увійти</Link>
        )}

      </div>
    </header>
  )
}