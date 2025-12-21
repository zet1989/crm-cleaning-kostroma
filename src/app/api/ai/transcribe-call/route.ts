import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

/**
 * Транскрипция звонка из Novofon
 * POST /api/ai/transcribe-call
 * Body: { 
 *   call_id: string, 
 *   pbx_call_id?: string, 
 *   call_id_with_rec?: string, 
 *   recording_url?: string,
 *   audio_base64?: string  // Base64 encoded audio file (for client-side download)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { call_id, pbx_call_id, call_id_with_rec, recording_url, audio_base64 } = body

    if (!call_id) {
      return NextResponse.json(
        { error: 'call_id is required' },
        { status: 400 }
      )
    }

    console.log(`[AI:TRANSCRIBE-CALL] Starting for call: ${call_id}`)

    // Используем anon key (RLS отключен на нужных таблицах)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Получаем настройки AI
    const { data: aiSettings, error: settingsError } = await supabase
      .from('ai_settings')
      .select('openrouter_api_key, transcription_api_key, transcription_model, selected_model, system_prompt, auto_transcribe_calls')
      .single()
    
    if (settingsError) {
      console.error('[AI:TRANSCRIBE-CALL] Failed to load settings:', settingsError)
    }
    
    console.log('[AI:TRANSCRIBE-CALL] Settings loaded:', {
      hasTranscriptionKey: !!aiSettings?.transcription_api_key,
      hasOpenRouterKey: !!aiSettings?.openrouter_api_key,
      model: aiSettings?.transcription_model
    })

    const apiKey = aiSettings?.transcription_api_key || aiSettings?.openrouter_api_key
    const whisperModel = aiSettings?.transcription_model || 'openai/whisper-large-v3'

    if (!apiKey) {
      console.log('[AI:TRANSCRIBE-CALL] No OpenRouter API key configured')
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 503 }
      )
    }

    // Получаем URL записи если не передан
    let audioUrl = recording_url

    if (!audioUrl && call_id_with_rec) {
      const appId = process.env.NOVOFON_APP_ID
      const secret = process.env.NOVOFON_SECRET

      if (appId && secret) {
        try {
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
            audioUrl = recordData.record || recordData.link
          }
        } catch (err) {
          console.error('[AI:TRANSCRIBE-CALL] Failed to get recording URL:', err)
        }
      }
    }

    // Если нет ни base64, ни URL - ошибка
    if (!audio_base64 && !audioUrl) {
      console.log('[AI:TRANSCRIBE-CALL] No recording URL or audio data available')
      return NextResponse.json(
        { error: 'No recording URL available' },
        { status: 400 }
      )
    }

    let audioFile: File

    // Если передан base64, используем его
    if (audio_base64) {
      console.log(`[AI:TRANSCRIBE-CALL] Using provided base64 audio (${audio_base64.length} chars)`)
      const binaryString = atob(audio_base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' })
      audioFile = new File([audioBlob], 'recording.mp3', { type: 'audio/mpeg' })
    } else {
      console.log(`[AI:TRANSCRIBE-CALL] Downloading audio from: ${audioUrl}`)
      
      // Скачиваем аудио
      const audioResponse = await fetch(audioUrl!)
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`)
      }

      const audioBlob = await audioResponse.blob()
      audioFile = new File([audioBlob], 'recording.mp3', { type: 'audio/mpeg' })
    }

    console.log(`[AI:TRANSCRIBE-CALL] Audio file size: ${audioFile.size} bytes`)

    // Пробуем разные сервисы транскрипции
    let transcription = ''
    let transcriptionError = ''

    // 1. Сначала пробуем Groq (бесплатный и быстрый Whisper)
    try {
      console.log('[AI:TRANSCRIBE-CALL] Trying Groq Whisper...')
      const groqFormData = new FormData()
      groqFormData.append('file', audioFile)
      groqFormData.append('model', 'whisper-large-v3')
      groqFormData.append('language', 'ru')

      const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY || apiKey}`,
        },
        body: groqFormData
      })

      if (groqResponse.ok) {
        const groqData = await groqResponse.json()
        transcription = groqData.text || ''
        console.log('[AI:TRANSCRIBE-CALL] Groq transcription success')
      } else {
        transcriptionError = `Groq: ${groqResponse.status}`
        console.log(`[AI:TRANSCRIBE-CALL] Groq failed: ${groqResponse.status}`)
      }
    } catch (err) {
      transcriptionError = `Groq error: ${err}`
      console.log('[AI:TRANSCRIBE-CALL] Groq error:', err)
    }

    // 2. Если Groq не сработал, пробуем OpenAI напрямую
    if (!transcription && process.env.OPENAI_API_KEY) {
      try {
        console.log('[AI:TRANSCRIBE-CALL] Trying OpenAI Whisper...')
        const openaiFormData = new FormData()
        openaiFormData.append('file', audioFile)
        openaiFormData.append('model', 'whisper-1')
        openaiFormData.append('language', 'ru')

        const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: openaiFormData
        })

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json()
          transcription = openaiData.text || ''
          console.log('[AI:TRANSCRIBE-CALL] OpenAI transcription success')
        } else {
          transcriptionError += `, OpenAI: ${openaiResponse.status}`
          console.log(`[AI:TRANSCRIBE-CALL] OpenAI failed: ${openaiResponse.status}`)
        }
      } catch (err) {
        transcriptionError += `, OpenAI error: ${err}`
        console.log('[AI:TRANSCRIBE-CALL] OpenAI error:', err)
      }
    }

    // 3. Если ничего не сработало - используем AI для "транскрипции" через описание
    if (!transcription) {
      console.log('[AI:TRANSCRIBE-CALL] All transcription services failed, trying AI description...')
      try {
        // Конвертируем аудио в base64 для отправки в AI
        const audioBuffer = await audioFile.arrayBuffer()
        const audioBase64 = Buffer.from(audioBuffer).toString('base64')
        
        // Пробуем несколько моделей с поддержкой аудио
        const audioModels = [
          'google/gemini-2.0-flash-001',
          'google/gemini-flash-1.5',
          'openai/gpt-4o-audio-preview'
        ]
        
        for (const model of audioModels) {
          if (transcription) break
          
          console.log(`[AI:TRANSCRIBE-CALL] Trying model: ${model}`)
          
          try {
            const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://crm-kostroma.ru',
                'X-Title': 'CRM Transcription'
              },
              body: JSON.stringify({
                model: model,
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: `Расшифруй этот телефонный разговор дословно на русском языке. Формат:
Оператор: [текст]
Клиент: [текст]

Только дословная расшифровка без анализа и комментариев.`
                      },
                      {
                        type: 'image_url',
                        image_url: {
                          url: `data:audio/mpeg;base64,${audioBase64}`
                        }
                      }
                    ]
                  }
                ]
              })
            })

            if (aiResponse.ok) {
              const aiData = await aiResponse.json()
              const response = aiData.choices?.[0]?.message?.content || ''
              console.log(`[AI:TRANSCRIBE-CALL] ${model} response:`, response.substring(0, 200))
              
              if (response && 
                  !response.toLowerCase().includes('не удалось') && 
                  !response.toLowerCase().includes('cannot') &&
                  !response.toLowerCase().includes('sorry') &&
                  !response.toLowerCase().includes('unable') &&
                  response.length > 20) {
                transcription = response
                console.log(`[AI:TRANSCRIBE-CALL] ${model} transcription success`)
                break
              }
            } else {
              const errText = await aiResponse.text()
              console.log(`[AI:TRANSCRIBE-CALL] ${model} error:`, aiResponse.status, errText.substring(0, 200))
            }
          } catch (modelErr) {
            console.log(`[AI:TRANSCRIBE-CALL] ${model} exception:`, modelErr)
          }
        }
      } catch (err) {
        console.log('[AI:TRANSCRIBE-CALL] AI description error:', err)
      }
    }

    if (!transcription) {
      throw new Error(`All transcription methods failed: ${transcriptionError}`)
    }

    console.log(`[AI:TRANSCRIBE-CALL] Transcription complete: ${transcription.substring(0, 100)}...`)

    // Анализируем транскрипцию с AI
    let aiSummary = ''
    if (transcription) {
      try {
        const analysisResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: aiSettings.selected_model || 'openai/gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: `Ты - AI ассистент для CRM. Проанализируй транскрипцию телефонного разговора и выдели:
1. Краткое содержание (2-3 предложения)
2. Имя клиента (если упоминается)
3. Тему обращения
4. Следующие шаги или договорённости
Ответ давай на русском языке в структурированном виде.`
              },
              {
                role: 'user',
                content: `Транскрипция звонка:\n\n${transcription}`
              }
            ],
            max_tokens: 500
          })
        })

        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json()
          aiSummary = analysisData.choices?.[0]?.message?.content || ''
        }
      } catch (err) {
        console.error('[AI:TRANSCRIBE-CALL] Analysis failed:', err)
      }
    }

    // Сохраняем транскрипцию и анализ в базу
    await supabase
      .from('calls')
      .update({
        recording_url: audioUrl,
        transcript: transcription,
        ai_summary: aiSummary
      })
      .eq('id', call_id)

    console.log(`[AI:TRANSCRIBE-CALL] Saved to database for call: ${call_id}`)

    return NextResponse.json({
      success: true,
      call_id,
      transcription,
      ai_summary: aiSummary
    })

  } catch (error) {
    console.error('[AI:TRANSCRIBE-CALL] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to transcribe call',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
