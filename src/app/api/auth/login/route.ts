import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, password, email } = body

    // Поддерживаем вход и по телефону, и по email (для обратной совместимости)
    const identifier = phone || email

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Телефон и пароль обязательны' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Если указан телефон - ищем email по телефону в profiles
    let loginEmail = email
    
    if (phone) {
      // Нормализуем телефон (убираем всё кроме цифр и добавляем +)
      const normalizedPhone = '+' + phone.replace(/\D/g, '')
      
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone', normalizedPhone)
        .single()
      
      if (profileError || !profile?.email) {
        console.log('[AUTH] Phone not found:', phone)
        return NextResponse.json(
          { error: 'Пользователь не найден' },
          { status: 401 }
        )
      }
      
      loginEmail = profile.email
    }

    // Авторизация через Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (error) {
      console.log('[AUTH] Login failed:', error.message)
      return NextResponse.json(
        { error: 'Неверный телефон или пароль' },
        { status: 401 }
      )
    }

    const user = data.user
    console.log('[AUTH] Login successful for:', user?.email)

    // Получаем профиль пользователя
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: profile?.phone,
        full_name: profile?.full_name || user.email,
        roles: profile?.roles || 'user',
      }
    })
  } catch (error) {
    console.error('[AUTH] Login error:', error)
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    )
  }
}
