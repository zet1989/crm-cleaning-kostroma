import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@supabase/supabase-js'

/**
 * Транскрипция звонка из Novofon
 * POST /api/ai/transcribe-call
 * Body: { call_id: string, pbx_call_id?: string, call_id_with_rec?: string, recording_url?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { call_id, pbx_call_id, call_id_with_rec, recording_url } = body

    if (!call_id) {
      return NextResponse.json(
        { error: 'call_id is required' },
        { status: 400 }
      )
    }

    console.log(`[AI:TRANSCRIBE-CALL] Starting for call: ${call_id}`)

    // Используем service_role для bypass RLS
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

    // Получаем настройки AI
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('openrouter_api_key, selected_model, system_prompt, auto_transcribe_calls')
      .single()

    if (!aiSettings?.openrouter_api_key) {
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

    if (!audioUrl) {
      console.log('[AI:TRANSCRIBE-CALL] No recording URL available')
      return NextResponse.json(
        { error: 'No recording URL available' },
        { status: 400 }
      )
    }

    console.log(`[AI:TRANSCRIBE-CALL] Transcribing from: ${audioUrl}`)

    // Скачиваем аудио
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`)
    }

    const audioBlob = await audioResponse.blob()
    const audioFile = new File([audioBlob], 'recording.mp3', { type: 'audio/mpeg' })

    // Транскрибируем через OpenRouter Whisper
    const formData = new FormData()
    formData.append('file', audioFile)
    formData.append('model', 'whisper-1')
    formData.append('language', 'ru')

    const transcribeResponse = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiSettings.openrouter_api_key}`,
      },
      body: formData
    })

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text()
      throw new Error(`Transcription failed: ${transcribeResponse.status} - ${errorText}`)
    }

    const transcriptionData = await transcribeResponse.json()
    const transcription = transcriptionData.text || ''

    console.log(`[AI:TRANSCRIBE-CALL] Transcription complete: ${transcription.substring(0, 100)}...`)

    // Анализируем транскрипцию с AI
    let aiSummary = ''
    if (transcription) {
      try {
        const analysisResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${aiSettings.openrouter_api_key}`,
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
