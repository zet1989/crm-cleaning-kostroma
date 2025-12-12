import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

/**
 * Webhook для приёма заявок с сайта
 * POST /api/webhooks/site
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Проверка API ключа (опционально, для защиты)
    // Отключено для тестирования. Раскомментируйте для production:
    // const apiKey = request.headers.get('x-api-key')
    // if (process.env.WEBHOOK_API_KEY && apiKey !== process.env.WEBHOOK_API_KEY) {
    //   const response = NextResponse.json(
    //     { error: 'Unauthorized' }, 
    //     { status: 401 }
    //   )
    //   response.headers.set('Access-Control-Allow-Origin', '*')
    //   return response
    // }

    // 2. Парсинг данных из формы
    const body = await request.json()
    
    // Принимаем либо структурированные данные, либо сырой текст
    const rawText = body.raw_text || body.message || ''
    const phone = body.phone || ''
    
    // 3. Формируем полный текст заявки для AI обработки
    const fullText = [
      body.name ? `Имя: ${body.name}` : '',
      phone ? `Телефон: ${phone}` : '',
      body.email ? `Email: ${body.email}` : '',
      body.address ? `Адрес: ${body.address}` : '',
      body.cleaning_type ? `Тип уборки: ${body.cleaning_type}` : '',
      body.scheduled_date ? `Дата: ${body.scheduled_date}` : '',
      body.scheduled_time ? `Время: ${body.scheduled_time}` : '',
      rawText ? `Сообщение: ${rawText}` : body.message || ''
    ].filter(Boolean).join('\n')

    // 4. Валидация - хотя бы текст или телефон должны быть
    if (!fullText.trim() && !phone) {
      const response = NextResponse.json(
        { error: 'Phone or message text is required' }, 
        { status: 400 }
      )
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // 5. Нормализация телефона (убираем всё кроме цифр)
    const normalizedPhone = phone ? phone.replace(/\D/g, '') : ''

    // 6. Получаем Supabase клиент с service_role (минуя RLS)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 7. Находим колонку "Новые"
    const { data: newColumn } = await supabase
      .from('columns')
      .select('id')
      .eq('name', 'Новые')
      .single()

    if (!newColumn) {
      throw new Error('Column "Новые" not found. Please create it first.')
    }

    // 8. Получаем максимальную позицию в колонке (чтобы добавить в начало)
    const { data: maxPositionDeal } = await supabase
      .from('deals')
      .select('position')
      .eq('column_id', newColumn.id)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPositionDeal?.position ?? -1) + 1

    // 9. Проверяем настройки AI и обрабатываем текст ПЕРЕД созданием сделки
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .single()

    let aiResult: any = {}
    
    if (aiSettings?.auto_process_webhooks && aiSettings?.openrouter_api_key) {
      console.log('[WEBHOOK:SITE] Processing with AI before creating deal...')
      try {
        aiResult = await processWithAI(
          fullText,
          aiSettings.openrouter_api_key,
          aiSettings.selected_model || 'openai/gpt-4o-mini',
          aiSettings.temperature || 0.7,
          aiSettings.system_prompt
        )
        console.log('[WEBHOOK:SITE] AI processed:', aiResult)
      } catch (err) {
        console.error('[WEBHOOK:SITE] AI processing failed, creating deal anyway:', err)
      }
    }

    // 10. Определяем финальный телефон (приоритет - AI результат)
    const finalPhone = aiResult.client_phone || normalizedPhone || ''
    
    // 11. Проверяем повторного клиента по финальному телефону
    let isRepeatedClient = false
    if (finalPhone) {
      const { data: existingDeals } = await supabase
        .from('deals')
        .select('id')
        .eq('client_phone', finalPhone)
        .limit(1)

      isRepeatedClient = !!(existingDeals && existingDeals.length > 0)
    }

    // 12. Создаём сделку с УЖЕ ОБРАБОТАННЫМИ данными от AI
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({
        column_id: newColumn.id,
        client_name: aiResult.client_name || body.name || 'Новая заявка',
        client_phone: finalPhone,
        address: aiResult.address || '',
        notes: fullText,
        source: 'website',
        is_repeated_client: isRepeatedClient,
        scheduled_at: aiResult.scheduled_at || null,
        price: aiResult.price || null,
        position: newPosition
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // 12. Логируем успех
    console.log(`[WEBHOOK:SITE] New deal created: ${deal.id} with AI-processed data${isRepeatedClient ? ' (Repeated client)' : ''}`)

    // 13. Успешный ответ
    const response = NextResponse.json({ 
      success: true, 
      deal_id: deal.id,
      message: 'Заявка успешно принята! Мы свяжемся с вами в ближайшее время.'
    }, { status: 201 })
    
    // CORS заголовки
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
    
    return response

  } catch (error) {
    console.error('[WEBHOOK:SITE] Error:', error)
    const response = NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Не удалось обработать заявку. Попробуйте позже.'
      }, 
      { status: 500 }
    )
    
    // CORS заголовки для ошибок
    response.headers.set('Access-Control-Allow-Origin', '*')
    
    return response
  }
}

/**
 * Обработка текста через OpenRouter AI
 */
async function processWithAI(
  text: string,
  apiKey: string,
  model: string = 'openai/gpt-4o-mini',
  temperature: number = 0.7,
  systemPrompt?: string
) {
  try {
    // Получаем текущую дату для контекста
    const now = new Date()
    const currentDate = now.toISOString().split('T')[0] // YYYY-MM-DD
    const currentTime = now.toTimeString().split(' ')[0].substring(0, 5) // HH:MM
    
    // Используем кастомный промпт или дефолтный
    const prompt = systemPrompt || `Ты - ассистент CRM системы клининговой компании. 
Твоя задача - извлечь из текста заявки структурированные данные.

ВАЖНО: Текущая дата и время: \${currentDate} \${currentTime}

Извлеки следующие поля:
- client_name (имя клиента, например: "Вася", "Иван Петров")
- client_phone (телефон в формате +7XXXXXXXXXX, убери все пробелы и скобки)
- address (полный адрес, включая улицу и номер дома/квартиры. Примеры: "Лунина, 45", "ул. Ленина, д. 10, кв. 5")
- scheduled_at (дата и время в ISO формате UTC: "YYYY-MM-DDTHH:MM:SS"
  * Если указано "сегодня" - используй \${currentDate}
  * Если указано "завтра" - добавь 1 день к \${currentDate}
  * Если указано "послезавтра" - добавь 2 дня к \${currentDate}
  * Если указано время, добавь его (например "14:00" → "14:00:00")
  * Если время НЕ указано, используй "09:00:00" (начало рабочего дня)
- price (стоимость в рублях, только число, например: 5000)
- cleaning_type (тип уборки: стандартная, генеральная, после ремонта, офис, окна, deep cleaning)

Верни ТОЛЬКО JSON без комментариев. Если поле не найдено, не включай его в ответ.`
    
    // Подставляем текущие дату и время в промпт
    const finalPrompt = prompt
      .replace(/\$\{currentDate\}/g, currentDate)
      .replace(/\$\{currentTime\}/g, currentTime)
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: finalPrompt
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: temperature,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0]?.message?.content

    if (!aiResponse) {
      throw new Error('No response from AI')
    }

    return JSON.parse(aiResponse)

  } catch (error) {
    console.error('[AI] Error calling OpenRouter:', error)
    // Возвращаем пустой объект при ошибке
    return {}
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
 * Тестовый GET endpoint для проверки работоспособности
 */
export async function GET() {
  const response = NextResponse.json({ 
    status: 'ok',
    endpoint: 'site_webhook',
    methods: ['POST']
  })
  response.headers.set('Access-Control-Allow-Origin', '*')
  return response
}
