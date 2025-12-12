import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Webhook для приёма заявок из email
 * POST /api/webhooks/email
 * 
 * Этот endpoint используется n8n для отправки обработанных email заявок
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Проверка API ключа
    const apiKey = request.headers.get('x-api-key')
    if (process.env.WEBHOOK_API_KEY && apiKey !== process.env.WEBHOOK_API_KEY) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      )
    }

    // 2. Парсинг данных (предполагается, что n8n уже обработал письмо)
    const body = await request.json()
    const { 
      name,
      phone,
      email,
      subject,
      message,
      extracted_data // AI извлечённые данные (адрес, тип уборки и т.д.)
    } = body

    // 3. Валидация
    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Phone or email is required' }, 
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 4. Находим колонку "Новые"
    const { data: newColumn } = await supabase
      .from('columns')
      .select('id')
      .eq('name', 'Новые')
      .single()

    if (!newColumn) {
      throw new Error('Column "Новые" not found')
    }

    // 5. Получаем позицию
    const { data: maxPositionDeal } = await supabase
      .from('deals')
      .select('position')
      .eq('column_id', newColumn.id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPositionDeal?.position ?? -1) + 1

    // 6. Нормализация телефона
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : null

    // 7. Проверяем повторного клиента
    let isRepeatedClient = false
    if (normalizedPhone) {
      const { data: existingDeals } = await supabase
        .from('deals')
        .select('id')
        .eq('client_phone', normalizedPhone)
        .limit(1)

      isRepeatedClient = !!(existingDeals && existingDeals.length > 0)
    }

    // 8. Формируем заметки с информацией из письма
    const notes = [
      `Заявка из email: ${subject || 'без темы'}`,
      `Email: ${email}`,
      message || '',
      extracted_data ? `\n--- AI извлечённые данные ---\n${JSON.stringify(extracted_data, null, 2)}` : ''
    ].filter(Boolean).join('\n\n')

    // 9. Создаём сделку
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        column_id: newColumn.id,
        client_name: name || 'Клиент (email)',
        client_phone: normalizedPhone || '',
        address: extracted_data?.address || '',
        notes: notes,
        source: 'email',
        is_repeated_client: isRepeatedClient,
        position: newPosition
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    console.log(`[WEBHOOK:EMAIL] New deal created: ${deal.id} - ${name} (${email})`)

    const response = NextResponse.json({ 
      success: true, 
      deal_id: deal.id,
      message: 'Email заявка обработана'
    }, { status: 201 })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response

  } catch (error) {
    console.error('[WEBHOOK:EMAIL] Error:', error)
    const response = NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response
  }
}

/**
 * OPTIONS для CORS preflight
 */
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
  return response
}

/**
 * Тестовый GET endpoint
 */
export async function GET() {
  const response = NextResponse.json({ 
    status: 'ok',
    endpoint: 'email_webhook',
    methods: ['POST']
  })
  response.headers.set('Access-Control-Allow-Origin', '*')
  return response
}
