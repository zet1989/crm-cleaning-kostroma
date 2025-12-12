import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * AI обработка текста заявки и автозаполнение полей сделки
 * POST /api/ai/process-deal
 * Body: { deal_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { deal_id } = await request.json()

    if (!deal_id) {
      return NextResponse.json(
        { error: 'deal_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 1. Получаем сделку
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', deal_id)
      .single()

    if (dealError || !deal) {
      return NextResponse.json(
        { error: 'Deal not found' },
        { status: 404 }
      )
    }

    // 2. Если нет текста для обработки
    if (!deal.notes) {
      return NextResponse.json(
        { error: 'No text to process' },
        { status: 400 }
      )
    }

    // 3. Получаем настройки AI из БД
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .single()

    console.log('[AI:PROCESS] Settings:', { 
      hasKey: !!aiSettings?.openrouter_api_key,
      model: aiSettings?.selected_model 
    })

    // 4. Отправляем текст в AI для обработки
    const aiResult = await processWithAI(
      deal.notes, 
      aiSettings?.openrouter_api_key,
      aiSettings?.selected_model || 'openai/gpt-4o-mini',
      aiSettings?.temperature || 0.7,
      aiSettings?.system_prompt
    )

    console.log('[AI:PROCESS] AI Result:', aiResult)

    // 5. Обновляем сделку с извлечёнными данными
    const updateData: any = {}
    
    if (aiResult.client_name && aiResult.client_name !== deal.client_name) {
      updateData.client_name = aiResult.client_name
    }
    if (aiResult.client_phone && aiResult.client_phone !== deal.client_phone) {
      updateData.client_phone = aiResult.client_phone
    }
    if (aiResult.address && (!deal.address || deal.address === '')) {
      updateData.address = aiResult.address
    }
    if (aiResult.scheduled_at && !deal.scheduled_at) {
      updateData.scheduled_at = aiResult.scheduled_at
    }
    if (aiResult.price && !deal.price) {
      updateData.price = aiResult.price
    }
    
    // Добавляем AI результат в notes если не был добавлен ранее
    if (!deal.notes.includes('--- AI Обработка ---')) {
      updateData.notes = `${deal.notes}\n\n--- AI Обработка ---\n${JSON.stringify(aiResult, null, 2)}`
    }
    
    const { data: updatedDeal, error: updateError } = await supabase
      .from('deals')
      .update(updateData)
      .eq('id', deal_id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    console.log(`[AI:PROCESS] Deal ${deal_id} processed successfully`)

    return NextResponse.json({
      success: true,
      deal: updatedDeal,
      ai_result: aiResult
    })

  } catch (error) {
    console.error('[AI:PROCESS] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process deal with AI' },
      { status: 500 }
    )
  }
}

/**
 * Обработка текста через OpenRouter AI
 */
async function processWithAI(
  text: string, 
  apiKey?: string,
  model: string = 'openai/gpt-4o-mini',
  temperature: number = 0.7,
  systemPrompt?: string
) {
  if (!apiKey) {
    console.warn('[AI] OpenRouter API key not configured, using mock data')
    return mockAIProcessing(text)
  }

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
        messages: [
          {
            role: 'system',
            content: finalPrompt
          },tent-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: `Ты - ассистент CRM системы клининговой компании. 
Твоя задача - извлечь из текста заявки структурированные данные.

ВАЖНО: Текущая дата и время: ${currentDate} ${currentTime}

Извлеки следующие поля:
- client_name (имя клиента, например: "Вася", "Иван Петров")
- client_phone (телефон в формате +7XXXXXXXXXX, убери все пробелы и скобки)
- address (полный адрес, включая улицу и номер дома/квартиры. Примеры: "Лунина, 45", "ул. Ленина, д. 10, кв. 5")
- scheduled_at (дата и время в ISO формате UTC: "YYYY-MM-DDTHH:MM:SS"
  * Если указано "сегодня" - используй ${currentDate}
  * Если указано "завтра" - добавь 1 день к ${currentDate}
  * Если указано "послезавтра" - добавь 2 дня к ${currentDate}
  * Если указано время, добавь его (например "14:00" → "14:00:00")
  * Если время НЕ указано, используй "09:00:00" (начало рабочего дня)
- price (стоимость в рублях, только число, например: 5000)
- cleaning_type (тип уборки: стандартная, генеральная, после ремонта, офис, окна, deep cleaning)

Верни ТОЛЬКО JSON без комментариев. Если поле не найдено, не включай его в ответ.`
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
    return mockAIProcessing(text)
  }
}

/**
 * Простая обработка без AI (fallback)
 */
function mockAIProcessing(text: string) {
  const result: any = {}

  // Извлечение телефона
  const phoneMatch = text.match(/(\+7|8|7)?[\s\-\(]?(\d{3})[\s\-\)]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})/)
  if (phoneMatch) {
    const digits = phoneMatch[0].replace(/\D/g, '')
    result.client_phone = digits.startsWith('7') ? `+${digits}` : `+7${digits}`
  }

  // Извлечение имени (ищем "Имя:" или первое слово с большой буквы)
  const nameMatch = text.match(/(?:Имя|имя):\s*([А-Яа-яЁёA-Za-z\s]+)/i) ||
                    text.match(/^([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+)/)
  if (nameMatch) {
    result.client_name = nameMatch[1].trim()
  }

  // Извлечение адреса (ищем "Адрес:" или "ул.", "пр.", "пер.")
  const addressMatch = text.match(/(?:Адрес|адрес):\s*([^\n]+)/i) ||
                      text.match(/((?:ул\.|улица|пр\.|проспект|пер\.|переулок)[^\n]+)/i)
  if (addressMatch) {
    result.address = addressMatch[1].trim()
  }

  // Извлечение даты
  const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+|T)(\d{2}):(\d{2})/)
  if (dateMatch) {
    result.scheduled_at = `${dateMatch[0].replace(' ', 'T')}:00`
  }

  // Извлечение цены
  const priceMatch = text.match(/(\d+)\s*(?:руб|₽|rub)/i)
  if (priceMatch) {
    result.price = parseFloat(priceMatch[1])
  }

  return result
}
