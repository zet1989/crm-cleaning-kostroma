import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

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
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || 
                     request.nextUrl.pathname.startsWith('/register')
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/dashboard') ||
                           request.nextUrl.pathname.startsWith('/kanban') ||
                           request.nextUrl.pathname.startsWith('/analytics') ||
                           request.nextUrl.pathname.startsWith('/executors') ||
                           request.nextUrl.pathname.startsWith('/managers') ||
                           request.nextUrl.pathname.startsWith('/settings') ||
                           request.nextUrl.pathname.startsWith('/calls') ||
                           request.nextUrl.pathname.startsWith('/salaries') ||
                           request.nextUrl.pathname.startsWith('/profile')

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
