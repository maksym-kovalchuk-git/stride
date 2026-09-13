import Link from 'next/link'
import { createClient } from '@/shared/lib/supabase/server'
import { SignOutButton } from '@/features/auth-by-email/ui/SignOutButton'
import { CartCounter } from '@/features/add-to-cart/ui/CartCounter'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header>
      <div className="flex gap-4 items-center">
        <Link href="/">
          Stride
        </Link>

        <Link href="/catalog">
          Каталог
        </Link>

        <CartCounter /> 

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