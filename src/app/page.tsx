import { createClient } from '@/shared/lib/supabase/server'

import { SignOutButton } from '@/features/auth-by-email/ui/SignOutButton';

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        {user ? (
          <div>
            <p>✅ Залогінений як: {user.email}</p>
            <p>ID: {user.id}</p>
          </div>
        ) : (
          <p>❌ Не залогінений</p>
        )}
        <SignOutButton />
      </main>
    </div>
  );
}
