import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Функция для создания админского клиента
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { email, password, full_name, roles, salary_percent, can_view_analytics } = body

    // Создаём пользователя через Admin API
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Автоматически подтверждаем email
      user_metadata: {
        full_name
      }
    })

    if (createError) {
      return NextResponse.json({ message: createError.message }, { status: 400 })
    }

    if (!userData.user) {
      return NextResponse.json({ message: 'Failed to create user' }, { status: 500 })
    }

    // Обновляем профиль с дополнительными данными
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        roles: roles || ['manager'],
        salary_percent: salary_percent || 10,
        can_view_analytics: can_view_analytics ?? true
      })
      .eq('id', userData.user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
    }

    return NextResponse.json({ 
      user: userData.user,
      message: 'User created successfully' 
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
