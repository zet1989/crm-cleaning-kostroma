import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// Простая функция для проверки пароля
function verifyPassword(password: string, hash: string): boolean {
  // SHA256 хеш введенного пароля
  const simpleHash = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex')
  
  console.log('[AUTH] Input password hash:', simpleHash)
  console.log('[AUTH] Stored hash:', hash)
  console.log('[AUTH] Match:', simpleHash === hash)
  
  return simpleHash === hash
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

    // Подключаемся к БД
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Ищем пользователя
    const { data: user, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, roles, password_hash')
      .eq('email', email)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      )
    }

    // Проверяем пароль
    if (!user.password_hash || !verifyPassword(password, user.password_hash)) {
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
