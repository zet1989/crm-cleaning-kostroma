import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { query } from '@/lib/db'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Toaster } from '@/components/ui/sonner'
import type { Profile } from '@/lib/supabase/database.types'

interface SessionData {
  user: {
    id: string
    email: string
    role?: string
  }
  expiresAt: number
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Проверяем сессию из cookie
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')
  
  if (!sessionCookie?.value) {
    redirect('/login')
  }

  let session: SessionData
  try {
    session = JSON.parse(sessionCookie.value)
  } catch {
    redirect('/login')
  }

  // Проверяем срок действия сессии
  if (session.expiresAt < Date.now()) {
    redirect('/login')
  }

  const userId = session.user?.id
  if (!userId) {
    redirect('/login')
  }

  // Получаем профиль пользователя через прямой SQL
  const profileResult = await query<Profile>(
    'SELECT * FROM profiles WHERE id = $1 LIMIT 1',
    [userId]
  )
  
  const profile: Profile = profileResult.rows[0] || {
    id: userId,
    email: session.user.email,
    full_name: null,
    phone: null,
    roles: ['user'],
    salary_percent: 0,
    can_view_analytics: false,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar profile={profile} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header profile={profile} />
        <main className="flex-1 overflow-auto bg-muted/30">
          {children}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}
