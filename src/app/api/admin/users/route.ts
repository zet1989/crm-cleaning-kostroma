import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Функция для создания админского клиента с прямым подключением к БД через REST API
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { phone, password, full_name, roles, salary_percent, can_view_analytics } = body

    if (!phone || !password || !full_name) {
      return NextResponse.json({ message: 'Телефон, пароль и имя обязательны' }, { status: 400 })
    }

    // Нормализуем телефон
    const normalizedPhone = phone.replace(/\D/g, '')
    if (normalizedPhone.length !== 11) {
      return NextResponse.json({ message: 'Неверный формат телефона' }, { status: 400 })
    }
    
    const formattedPhone = '+' + normalizedPhone

    // Проверяем, не существует ли уже пользователь с таким телефоном
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', formattedPhone)
      .single()

    if (existingProfile) {
      return NextResponse.json({ message: 'Пользователь с таким телефоном уже существует' }, { status: 400 })
    }

    // Генерируем уникальный email на основе телефона (для Supabase Auth)
    const generatedEmail = `user_${normalizedPhone}@crm-kostroma.ru`
    
    // Пробуем создать через Admin API
    try {
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: generatedEmail,
        password,
        email_confirm: true,
        phone: formattedPhone,
        phone_confirm: true,
        user_metadata: {
          full_name,
          phone: formattedPhone
        }
      })

      if (createError) {
        console.error('Admin API error:', createError)
        // Если Admin API не работает, возвращаем ошибку с инструкцией
        return NextResponse.json({ 
          message: 'Ошибка создания пользователя. Обратитесь к администратору.',
          details: createError.message
        }, { status: 500 })
      }

      if (!userData.user) {
        return NextResponse.json({ message: 'Failed to create user' }, { status: 500 })
      }

      // Обновляем профиль с дополнительными данными
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name,
          phone: formattedPhone,
          email: generatedEmail,
          roles: roles || ['manager'],
          salary_percent: salary_percent || 10,
          can_view_analytics: can_view_analytics ?? true
        })
        .eq('id', userData.user.id)

      if (profileError) {
        console.error('Error updating profile:', profileError)
      }

      return NextResponse.json({ 
        user: {
          id: userData.user.id,
          phone: formattedPhone,
          full_name
        },
        message: 'Пользователь создан успешно' 
      })
    } catch (authError) {
      console.error('Auth creation failed:', authError)
      return NextResponse.json({ 
        message: 'Ошибка авторизации при создании пользователя' 
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
