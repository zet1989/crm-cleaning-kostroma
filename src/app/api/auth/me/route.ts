import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get('session')

    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const session = JSON.parse(sessionCookie.value)

    // Проверяем не истекла ли сессия
    if (session.expiresAt < Date.now()) {
      cookieStore.delete('session')
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: session.userId,
        email: session.email,
        roles: session.roles
      }
    })
  } catch (error) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
