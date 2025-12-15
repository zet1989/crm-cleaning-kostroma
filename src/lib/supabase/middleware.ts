import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  // Пропускаем API роуты и статику
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.includes('.')) {
    return response
  }

  // Проверяем нашу собственную сессию из cookie
  const sessionCookie = request.cookies.get('session')
  let user = null

  if (sessionCookie) {
    try {
      const sessionData = JSON.parse(sessionCookie.value)
      // Проверяем, не истекла ли сессия
      if (sessionData.expiresAt > Date.now()) {
        user = sessionData
      }
    } catch {
      // Невалидная сессия
    }
  }

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

  return response
}
