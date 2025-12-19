import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

/**
 * Webhook для приёма событий от Novofon
 * POST /api/webhooks/novofon
 * 
 * Документация Novofon API: https://novofon.com/instructions/api/
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Парсинг данных от Novofon
    const body = await request.json()
    const {
      event,                // Тип события: NOTIFY_START, NOTIFY_END, NOTIFY_RECORD
      call_id,              // ID звонка
      pbx_call_id,          // Постоянный ID звонка (не меняется)
      call_id_with_rec,     // ID звонка с записью
      caller_id,            // Номер звонящего (для NOTIFY_END это from)
      called_did,           // Номер на который звонят (для NOTIFY_END это to)
      destination,          // Номер назначения (для NOTIFY_OUT_END)
      duration,             // Длительность в секундах
      disposition,          // Статус: answered, busy, cancel, no answer, failed
      is_recorded,          // 1 если есть запись, 0 если нет
      internal,             // Внутренний номер АТС
      last_internal         // Последний участник звонка
    } = body

    console.log(`[WEBHOOK:NOVOFON] Event: ${event}, Call ID: ${pbx_call_id || call_id}`)
    console.log(`[WEBHOOK:NOVOFON] Body:`, JSON.stringify(body, null, 2))

    // ФИЛЬТРАЦИЯ: обрабатываем только звонки для внутреннего номера 100
    const TARGET_INTERNAL = '100'
    const TARGET_PHONE = '+79675558185' // Нормализованный формат
    
    // Проверяем внутренний номер или телефон
    const normalizedCalledDid = called_did?.replace(/[^0-9]/g, '')
    const normalizedTargetPhone = TARGET_PHONE.replace(/[^0-9]/g, '')
    
    const isTargetNumber = internal === TARGET_INTERNAL || 
                          last_internal === TARGET_INTERNAL ||
                          normalizedCalledDid === normalizedTargetPhone
    
    if (!isTargetNumber) {
      console.log(`[WEBHOOK:NOVOFON] Skipping: not for target number (internal: ${internal}, called: ${called_did})`)
      return NextResponse.json({ 
        success: true, 
        action: 'skipped',
        reason: 'not_target_number'
      })
    }

    console.log(`[WEBHOOK:NOVOFON] Processing for target number 100`)

    // Используем service_role для bypass RLS + внутренний URL для прямого доступа к Kong
    const supabaseUrl = process.env.SUPABASE_URL_INTERNAL || process.env.NEXT_PUBLIC_SUPABASE_URL!
    console.log(`[WEBHOOK:NOVOFON] Using Supabase URL: ${supabaseUrl}`)
    
    const supabase = createServerClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // 2. Обработка события NOTIFY_RECORD (запись звонка готова)
    if (event === 'NOTIFY_RECORD') {
      console.log(`[WEBHOOK:NOVOFON] Recording ready for call: ${pbx_call_id}`)
      
      // Получаем URL записи из Novofon API
      const appId = process.env.NOVOFON_APP_ID
      const secret = process.env.NOVOFON_SECRET
      
      let recordingUrl: string | null = null
      
      if (appId && secret && call_id_with_rec) {
        try {
          // Формируем подпись для запроса записи
          const crypto = await import('crypto')
          const params: Record<string, string> = {
            appid: appId,
            call_id: call_id_with_rec
          }
          const sortedParams = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&')
          const sign = crypto.createHash('md5').update(`${sortedParams}${secret}`).digest('hex')
          
          const recordResponse = await fetch(
            `https://dataapi-jsonrpc.novofon.ru/v2.0/statistic/get_record/?appid=${appId}&call_id=${call_id_with_rec}&sign=${sign}`
          )
          
          if (recordResponse.ok) {
            const recordData = await recordResponse.json()
            recordingUrl = recordData.record || recordData.link || null
            console.log(`[WEBHOOK:NOVOFON] Recording URL: ${recordingUrl}`)
          }
        } catch (err) {
          console.error('[WEBHOOK:NOVOFON] Failed to get recording URL:', err)
        }
      }
      
      // Найти звонок и обновить информацию о записи
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id, deal_id')
        .or(`external_id.eq.${pbx_call_id},external_id.eq.${call_id_with_rec}`)
        .single()

      if (existingCall) {
        // Обновляем URL записи в базе
        if (recordingUrl) {
          await supabase
            .from('calls')
            .update({ recording_url: recordingUrl })
            .eq('id', existingCall.id)
          
          console.log(`[WEBHOOK:NOVOFON] Recording URL saved for call: ${existingCall.id}`)
        }
        
        const { data: aiSettings } = await supabase
          .from('ai_settings')
          .select('auto_transcribe_calls, openrouter_api_key')
          .single()

        if (aiSettings?.auto_transcribe_calls && aiSettings?.openrouter_api_key && existingCall.deal_id) {
          // Запускаем транскрипцию асинхронно
          fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/ai/transcribe-call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              call_id: existingCall.id,
              pbx_call_id: pbx_call_id,
              call_id_with_rec: call_id_with_rec,
              recording_url: recordingUrl
            })
          }).catch(err => console.error('[WEBHOOK:NOVOFON] Transcription request failed:', err))
        }
      }

      return NextResponse.json({ success: true, action: 'recording_received', recording_url: recordingUrl })
    }

    // 3. Обрабатываем завершённые ВХОДЯЩИЕ звонки (NOTIFY_END)
    if (event === 'NOTIFY_END' && caller_id && called_did) {
      
      // Нормализуем номер клиента
      const clientPhone = caller_id.replace(/\D/g, '')
      
      // Определяем статус звонка
      const isAnswered = disposition === 'answered'
      const isMissed = ['no answer', 'cancel', 'busy'].includes(disposition)
      
      // Формируем описание статуса для примечаний
      const statusDescriptions: Record<string, string> = {
        'answered': 'Звонок отвечен',
        'no answer': 'Пропущенный звонок (не ответили)',
        'cancel': 'Отменён звонящим',
        'busy': 'Занято',
        'failed': 'Не удался'
      }
      const statusText = statusDescriptions[disposition] || disposition

      // Проверяем, есть ли уже сделка с этим номером
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('id, client_name, column_id, notes, columns(name)')
        .eq('client_phone', clientPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Сохраняем информацию о звонке
      const { data: call } = await supabase
        .from('calls')
        .insert({
          deal_id: existingDeal?.id || null,
          client_phone: clientPhone,
          direction: 'incoming',
          duration: duration || 0,
          recording_url: null, // Запись придёт позже через NOTIFY_RECORD
          external_id: pbx_call_id || call_id
        })
        .select()
        .single()

      // Для любого входящего звонка:
      // - Новый клиент: создаём сделку в "Новые"
      // - Повторный клиент: перемещаем сделку в "Новые"
      
      // Находим колонку "Новые"
      const { data: newColumn, error: columnError } = await supabase
        .from('columns')
        .select('id')
        .eq('name', 'Новые')
        .single()

      if (columnError) {
        console.error('[WEBHOOK:NOVOFON] Column query error:', columnError)
        throw new Error(`Column query failed: ${columnError.message}`)
      }

      if (!newColumn) {
        console.error('[WEBHOOK:NOVOFON] Column "Новые" not found in database')
        throw new Error('Column "Новые" not found')
      }
      
      console.log('[WEBHOOK:NOVOFON] Found column "Новые":', newColumn.id)

      // Получаем позицию
      const { data: maxPositionDeal } = await supabase
        .from('deals')
        .select('position')
        .eq('column_id', newColumn.id)
        .order('position', { ascending: false })
        .limit(1)
        .single()

        const newPosition = (maxPositionDeal?.position ?? -1) + 1

        // Формируем текст примечания
        const notePrefix = isMissed ? '🔴 ПРОПУЩЕННЫЙ ЗВОНОК' : '📞 Входящий звонок'
        const noteText = `${notePrefix}\nСтатус: ${statusText}\nДлительность: ${duration || 0} сек.\nВнутренний номер: ${internal || 'не указан'}\nВремя: ${new Date().toLocaleString('ru-RU')}`

        // Создаём новую сделку (для новых клиентов) или перемещаем существующую в "Новые"
        if (!existingDeal) {
          const { data: newDeal, error } = await supabase
            .from('deals')
            .insert({
              column_id: newColumn.id,
              client_name: isMissed ? 'Клиент (пропущенный)' : 'Клиент (входящий звонок)',
              client_phone: clientPhone,
              source: 'call',
              notes: noteText,
              position: newPosition,
              is_repeated_client: false
            })
            .select()
            .single()

          if (error) throw error

          // Привязываем звонок к новой сделке
          if (call) {
            await supabase
              .from('calls')
              .update({ deal_id: newDeal.id })
              .eq('id', call.id)
          }

          console.log(`[WEBHOOK:NOVOFON] New lead created: ${newDeal.id} (${isMissed ? 'MISSED' : 'ANSWERED'})`)
          
      } else {
        // Для повторного клиента - перемещаем сделку в "Новые" и добавляем примечание
        const currentNotes = existingDeal.notes || ''
        const repeatNote = `\n\n📞 ПОВТОРНЫЙ ЗВОНОК\n${noteText}`
        
        await supabase
          .from('deals')
          .update({
            column_id: newColumn.id,  // Перемещаем в "Новые"
            position: newPosition,
            notes: currentNotes + repeatNote,
            is_repeated_client: true
          })
          .eq('id', existingDeal.id)
        
        console.log(`[WEBHOOK:NOVOFON] Repeat call - deal moved to "Новые": ${existingDeal.id}`)
      }

      const response = NextResponse.json({
        success: true,
        action: existingDeal ? 'deal_moved_to_new' : 'lead_created',
        missed: isMissed
      })
      response.headers.set('Access-Control-Allow-Origin', '*')
      return response
    }

    // 4. Обрабатываем ИСХОДЯЩИЕ звонки (NOTIFY_OUT_END)
    if (event === 'NOTIFY_OUT_END' && caller_id && destination) {
      
      // Для исходящих: destination = номер клиента, caller_id = наш номер
      const clientPhone = destination.replace(/\D/g, '')
      
      // Определяем статус звонка
      const isAnswered = disposition === 'answered'
      
      // Формируем описание статуса
      const statusDescriptions: Record<string, string> = {
        'answered': 'Исходящий звонок (отвечен)',
        'no answer': 'Исходящий звонок (не ответили)',
        'cancel': 'Исходящий звонок (отменён)',
        'busy': 'Исходящий звонок (занято)',
        'failed': 'Исходящий звонок (не удался)'
      }
      const statusText = statusDescriptions[disposition] || `Исходящий: ${disposition}`

      // Ищем сделку с этим номером телефона
      const { data: existingDeal } = await supabase
        .from('deals')
        .select('id, client_name, column_id, notes, columns(name)')
        .eq('client_phone', clientPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Сохраняем звонок
      const { data: call } = await supabase
        .from('calls')
        .insert({
          deal_id: existingDeal?.id || null,
          client_phone: clientPhone,
          direction: 'outgoing',
          duration: duration || 0,
          recording_url: null,
          external_id: pbx_call_id || call_id
        })
        .select()
        .single()

      if (existingDeal) {
        // Добавляем примечание об исходящем звонке в сделку
        const noteText = `📞 ${statusText}\nДлительность: ${duration || 0} сек.\nМенеджер: внутренний ${internal || 'не указан'}\nВремя: ${new Date().toLocaleString('ru-RU')}`
        
        const currentNotes = existingDeal.notes || ''
        await supabase
          .from('deals')
          .update({
            notes: currentNotes + '\n\n' + noteText
          })
          .eq('id', existingDeal.id)

        console.log(`[WEBHOOK:NOVOFON] Outgoing call logged to deal: ${existingDeal.id}`)

        const response = NextResponse.json({
          success: true,
          action: 'outgoing_call_logged',
          deal_id: existingDeal.id
        })
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      } else {
        // Сделки нет - просто логируем звонок (можно создать сделку, если нужно)
        console.log(`[WEBHOOK:NOVOFON] Outgoing call to ${clientPhone}, no deal found`)

        const response = NextResponse.json({
          success: true,
          action: 'outgoing_call_no_deal'
        })
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      }
    }

    // Для других событий (NOTIFY_START, NOTIFY_INTERNAL и т.д.) просто логируем
    const response = NextResponse.json({
      success: true,
      action: 'event_logged',
      event
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    return response

  } catch (error) {
    console.error('[WEBHOOK:NOVOFON] Error:', error)
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
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

/**
 * Тестовый GET endpoint
 */
export async function GET() {
  const response = NextResponse.json({ 
    status: 'ok',
    endpoint: 'novofon_webhook',
    methods: ['POST']
  })
  response.headers.set('Access-Control-Allow-Origin', '*')
  return response
}
