import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { Pool } from 'pg'
import crypto from 'crypto'

// Пул подключений к PostgreSQL
const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'crm',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
})

// ВРЕМЕННОЕ РЕШЕНИЕ: простая проверка пароля
function verifyPassword(password: string): boolean {
  return password === 'admin123'
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      )
    }

    // Ищем пользователя в БД напрямую через pg
    const result = await pool.query(
      'SELECT id, email, full_name, roles, password_hash FROM profiles WHERE email = $1',
      [email]
    )

    const user = result.rows[0]

    if (!user) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    // Проверяем пароль (временно hardcoded)
    if (!verifyPassword(password)) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }
    
    console.log('[AUTH] Login successful for:', user.email)

    // Создаем сессионный токен (простой JWT альтернатива)
    const sessionToken = crypto.randomBytes(32).toString('hex')
    const sessionData = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 дней
    }

    // Сохраняем сессию в куках
    const cookieStore = await cookies()
    cookieStore.set('session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 дней
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles: user.roles
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
