import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

/**
 * Webhook для приёма событий от Novofon
 * POST /api/webhooks/novofon
 * 
 * Документация Novofon API: https://novofon.com/instructions/api/
 */
export async function POST(request: NextRequest) {
  console.log('[WEBHOOK:NOVOFON] === NEW REQUEST ===')
  try {
    // 1. Парсинг данных от Novofon (поддержка JSON и form-urlencoded)
    const contentType = request.headers.get('content-type') || ''
    console.log('[WEBHOOK:NOVOFON] Content-Type header:', contentType)
    let body: any
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Novofon отправляет данные в формате form-urlencoded
      const text = await request.text()
      const params = new URLSearchParams(text)
      body = Object.fromEntries(params.entries())
    } else {
      // Fallback на JSON
      const rawText = await request.text()
      console.log('[WEBHOOK:NOVOFON] Raw body:', rawText)
      console.log('[WEBHOOK:NOVOFON] Content-Type:', contentType)
      try {
        body = JSON.parse(rawText)
      } catch (parseError: any) {
        console.error('[WEBHOOK:NOVOFON] JSON parse error:', parseError.message)
        console.error('[WEBHOOK:NOVOFON] Trying to extract data with regex...')
        
        // Пытаемся извлечь данные регулярками из невалидного JSON
        const eventMatch = rawText.match(/"event"\s*:\s*"([^"]+)"/)
        const commIdMatch = rawText.match(/"communication_id"\s*:\s*"([^"]+)"/)
        const fileUrlMatch = rawText.match(/"file_url"\s*:\s*"([^"]+)"/)
        
        if (eventMatch) {
          body = {
            event: eventMatch[1],
            communication_id: commIdMatch?.[1] || null,
            file_url: fileUrlMatch?.[1] || null
          }
          console.log('[WEBHOOK:NOVOFON] Extracted from malformed JSON:', body)
        } else {
          return NextResponse.json({
            error: 'JSON parse error',
            message: parseError.message,
            receivedBody: rawText
          }, { status: 400 })
        }
      }
    }
    
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

    console.log(`[WEBHOOK:NOVOFON] Event: ${event}, Call ID: ${pbx_call_id || call_id}`)
    console.log(`[WEBHOOK:NOVOFON] Body:`, JSON.stringify(body, null, 2))

    // Используем anon key (RLS отключен на нужных таблицах)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    console.log(`[WEBHOOK:NOVOFON] Using Supabase URL: ${supabaseUrl}`)
    
    const supabase = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
      console.log(`[WEBHOOK:NOVOFON] All NOTIFY_RECORD fields:`, body)
      
      // Формируем URL записи из call_id_with_rec
      let recordingUrl = body.record || body.record_url || body.link || body.recording_url || null
      
      if (!recordingUrl && call_id_with_rec) {
        // Novofon URL: https://my.novofon.ru/system/media/talk/{pbx_call_id}/{hash}/
        // call_id_with_rec имеет формат: {pbx_call_id}.{hash}
        const parts = call_id_with_rec.split('.')
        if (parts.length === 2) {
          recordingUrl = `https://my.novofon.ru/system/media/talk/${parts[0]}/${parts[1]}/`
          console.log(`[WEBHOOK:NOVOFON] Generated recording URL: ${recordingUrl}`)
        }
      } else if (recordingUrl) {
        console.log(`[WEBHOOK:NOVOFON] Recording URL from webhook: ${recordingUrl}`)
      } else {
        console.log(`[WEBHOOK:NOVOFON] No call_id_with_rec, cannot generate URL`)
      }
      
      // Сохраняем URL записи в базу
      if (recordingUrl && pbx_call_id) {
        const { error: updateError } = await supabase
          .from('calls')
          .update({ recording_url: recordingUrl })
          .eq('external_id', pbx_call_id)
        
        if (updateError) {
          console.error(`[WEBHOOK:NOVOFON] Failed to update recording URL:`, updateError)
        } else {
          console.log(`[WEBHOOK:NOVOFON] Recording URL saved for call ${pbx_call_id}`)
        }
      }

    // 2a. Обработка события SCENARIO_RECORD (запись через уведомления сценариев)
    } else if (event === 'SCENARIO_RECORD') {
      // Поддерживаем оба варианта: file_url и file_link
      const file_url = body.file_url || body.file_link
      const communication_id = body.pbx_call_id || body.communication_id
      
      console.log(`[WEBHOOK:NOVOFON] SCENARIO_RECORD event received:`, {
        communication_id,
        file_url,
        phone: body.phone,
        duration: body.duration
      })
      
      if (file_url && communication_id) {
        // Ищем звонок по external_id (pbx_call_id)
        const { data: call } = await supabase
          .from('calls')
          .select('id, deal_id')
          .eq('external_id', communication_id)
          .maybeSingle()
        
        if (call) {
          // Обновляем URL записи
          await supabase
            .from('calls')
            .update({ recording_url: file_url })
            .eq('id', call.id)
          
          console.log(`[WEBHOOK:NOVOFON] Recording URL saved for call ${call.id}: ${file_url}`)
          
          return NextResponse.json({ success: true, action: 'recording_saved' })
        } else {
          console.log(`[WEBHOOK:NOVOFON] Call not found for communication_id: ${communication_id}`)
        }
      }
      
      return NextResponse.json({ success: true, action: 'scenario_record_processed' })
      
      // Получаем URL записи из Novofon API (если не было в вебхуке)
      const userKey = process.env.NOVOFON_APP_ID
      const secret = process.env.NOVOFON_SECRET
      
      let finalRecordingUrl: string | null = recordingUrl
      
      if (!finalRecordingUrl && userKey && secret && call_id_with_rec) {
        try {
          // Формируем подпись для запроса записи согласно документации
          // https://novofon.com/instructions/api/#block_intro
          const crypto = await import('crypto')
          const method = '/v1/pbx/record/request/'
          const params: Record<string, string> = {
            call_id: call_id_with_rec
          }
          
          // Сортируем параметры по алфавиту
          const sortedKeys = Object.keys(params).sort()
          const paramsStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
          const md5Hash = crypto.createHash('md5').update(paramsStr).digest('hex')
          
          // Формируем строку для подписи: method + paramsStr + md5(paramsStr)
          const signatureStr = `${method}${paramsStr}${md5Hash}`
          const signature = crypto.createHmac('sha1', secret).update(signatureStr).digest('base64')
          
          console.log(`[WEBHOOK:NOVOFON] API request:`, {
            method,
            paramsStr,
            md5Hash,
            signatureStr: signatureStr.substring(0, 50) + '...',
            userKey,
            signature: signature.substring(0, 20) + '...'
          })
          
          const recordResponse = await fetch(
            `https://api.novofon.com${method}?${paramsStr}`,
            {
              headers: {
                'Authorization': `${userKey}:${signature}`
              }
            }
          )
          
          if (recordResponse.ok) {
            const recordData = await recordResponse.json()
            // API v1.0 возвращает {status: 'success', link: '...', lifetime_till: '...'}
            finalRecordingUrl = recordData.link || null
            console.log(`[WEBHOOK:NOVOFON] Recording response:`, recordData)
            console.log(`[WEBHOOK:NOVOFON] Recording URL from API: ${finalRecordingUrl}`)
          } else {
            const errorText = await recordResponse.text()
            console.log(`[WEBHOOK:NOVOFON] API request failed: ${recordResponse.status}, ${errorText}`)
          }
        } catch (err) {
          console.error('[WEBHOOK:NOVOFON] Failed to get recording URL:', err)
        }
      }
      
      if (!finalRecordingUrl) {
        console.log(`[WEBHOOK:NOVOFON] No recording URL available`)
        return NextResponse.json({ success: true, action: 'no_recording_url' })
      }
      
      // Ищем звонок в базе по pbx_call_id (может ещё не существовать)
      const { data: existingCall } = await supabase
        .from('calls')
        .select('id, deal_id')
        .eq('external_id', pbx_call_id || call_id_with_rec)
        .maybeSingle()

      if (existingCall) {
        // Звонок уже создан - обновляем URL записи
        await supabase
          .from('calls')
          .update({ recording_url: finalRecordingUrl })
          .eq('id', existingCall.id)
        
        console.log(`[WEBHOOK:NOVOFON] Recording URL saved for call: ${existingCall.id}`)
        
        // Если есть deal_id, запускаем транскрипцию
        if (existingCall.deal_id && finalRecordingUrl) {
          console.log(`[WEBHOOK:NOVOFON] Starting transcription for call: ${existingCall.id}`)
          
          // Запускаем транскрипцию через OpenRouter
          try {
            const transcribeResponse = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/api/ai/transcribe-call`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                call_id: existingCall.id,
                recording_url: finalRecordingUrl
              })
            })
            
            if (transcribeResponse.ok) {
              console.log(`[WEBHOOK:NOVOFON] Transcription started successfully`)
            } else {
              console.error(`[WEBHOOK:NOVOFON] Transcription failed:`, await transcribeResponse.text())
            }
          } catch (err) {
            console.error('[WEBHOOK:NOVOFON] Transcription request failed:', err)
          }
        }
      } else {
        // Звонок ещё не создан - сохраняем URL во временную переменную
        // Когда придёт NOTIFY_END, он создаст звонок и можно будет обновить
        console.log(`[WEBHOOK:NOVOFON] Call not found yet, will update when created`)
        
        // Сохраняем в memory cache или можно создать временный звонок
        // Для простоты просто логируем - NOTIFY_END создаст звонок после
      }

      return NextResponse.json({ success: true, action: 'recording_received', recording_url: finalRecordingUrl })
    }

    // 3. Обрабатываем завершённые ВХОДЯЩИЕ звонки (NOTIFY_END)
    if (event === 'NOTIFY_END' && caller_id && called_did) {
      
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
        console.log(`[WEBHOOK:NOVOFON] Skipping NOTIFY_END: not for target number (internal: ${internal}, called: ${called_did})`)
        return NextResponse.json({ 
          success: true, 
          action: 'skipped',
          reason: 'not_target_number'
        })
      }

      console.log(`[WEBHOOK:NOVOFON] Processing NOTIFY_END for target number 100`)
      
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
      const { data: call, error: callInsertError } = await supabase
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
      
      if (callInsertError) {
        console.error('[WEBHOOK:NOVOFON] Failed to insert call:', callInsertError)
      } else {
        console.log(`[WEBHOOK:NOVOFON] Call saved with ID: ${call?.id}`)
      }

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
              address: '',  // Пустой адрес по умолчанию
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
          
          // Если есть запись, получаем URL
          if (call && is_recorded === '1' && call_id_with_rec) {
            console.log(`[WEBHOOK:NOVOFON] Call has recording, fetching URL...`)
            await fetchAndSaveRecording(call.id, call_id_with_rec, newDeal.id)
          }
          
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
        
        // Если есть запись, получаем URL
        if (call && is_recorded === '1' && call_id_with_rec) {
          console.log(`[WEBHOOK:NOVOFON] Call has recording, fetching URL...`)
          await fetchAndSaveRecording(call.id, call_id_with_rec, existingDeal.id)
        }
      }
      
      // Вспомогательная функция для получения и сохранения записи
      async function fetchAndSaveRecording(callId: string, callIdWithRec: string, dealId: string) {
        const userKey = process.env.NOVOFON_APP_ID
        const secret = process.env.NOVOFON_SECRET
        
        if (!userKey || !secret) return
        
        try {
          const crypto = await import('crypto')
          const method = '/v1/pbx/record/request/'
          const params: Record<string, string> = {
            call_id: callIdWithRec
          }
          
          // Сортируем параметры по алфавиту
          const sortedKeys = Object.keys(params).sort()
          const paramsStr = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
          const md5Hash = crypto.createHash('md5').update(paramsStr).digest('hex')
          
          // Формируем строку для подписи: method + paramsStr + md5(paramsStr)
          const signatureStr = `${method}${paramsStr}${md5Hash}`
          const signature = crypto.createHmac('sha1', secret).update(signatureStr).digest('base64')
          
          console.log(`[WEBHOOK:NOVOFON] fetchAndSaveRecording API request:`, {
            method,
            paramsStr,
            md5Hash,
            signatureStr: signatureStr.substring(0, 50) + '...',
            userKey,
            signature: signature.substring(0, 20) + '...'
          })
          
          const recordResponse = await fetch(
            `https://api.novofon.com${method}?${paramsStr}`,
            {
              headers: {
                'Authorization': `${userKey}:${signature}`
              }
            }
          )
          
          if (recordResponse.ok) {
            const recordData = await recordResponse.json()
            // API v1.0 возвращает {status: 'success', link: '...', lifetime_till: '...'}
            const recordingUrl = recordData.link || null
            
            if (recordingUrl) {
              console.log(`[WEBHOOK:NOVOFON] Recording URL obtained: ${recordingUrl}`)
              
              // Сохраняем URL записи
              await supabase
                .from('calls')
                .update({ recording_url: recordingUrl })
                .eq('id', callId)
              
              // Запускаем транскрипцию
              console.log(`[WEBHOOK:NOVOFON] Starting transcription...`)
              try {
                const transcribeResponse = await fetch(`${supabaseUrl.replace('/rest/v1', '')}/api/ai/transcribe-call`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    call_id: callId,
                    recording_url: recordingUrl
                  })
                })
                
                if (transcribeResponse.ok) {
                  console.log(`[WEBHOOK:NOVOFON] Transcription started successfully`)
                } else {
                  const errorText = await transcribeResponse.text()
                  console.error(`[WEBHOOK:NOVOFON] Transcription failed:`, errorText)
                }
              } catch (err) {
                console.error('[WEBHOOK:NOVOFON] Transcription request failed:', err)
              }
            }
          }
        } catch (err) {
          console.error('[WEBHOOK:NOVOFON] Failed to fetch recording:', err)
        }
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
      const { data: call, error: callInsertError } = await supabase
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
      
      if (callInsertError) {
        console.error('[WEBHOOK:NOVOFON] Failed to insert outgoing call:', callInsertError)
      } else {
        console.log(`[WEBHOOK:NOVOFON] Outgoing call saved with ID: ${call?.id}`)
      }

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
