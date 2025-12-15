import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ВАЖНО: Не удаляйте getUser() - это обновляет сессию при каждом запросе
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Защищённые роуты
  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isProtectedRoute = pathname.startsWith('/dashboard') ||
                           pathname.startsWith('/kanban') ||
                           pathname.startsWith('/analytics') ||
                           pathname.startsWith('/executors') ||
                           pathname.startsWith('/managers') ||
                           pathname.startsWith('/settings') ||
                           pathname.startsWith('/calls') ||
                           pathname.startsWith('/salaries') ||
                           pathname.startsWith('/profile')

  // Редирект неавторизованных пользователей
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Редирект авторизованных пользователей с auth страниц
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
