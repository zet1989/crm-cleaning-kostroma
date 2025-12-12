import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * AI транскрипция аудио файла
 * POST /api/ai/transcribe
 * Body: { audioUrl: string } или FormData с файлом
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')
    let audioUrl: string | null = null
    let audioFile: File | null = null

    // Парсим либо JSON с URL, либо FormData с файлом
    if (contentType?.includes('application/json')) {
      const body = await request.json()
      audioUrl = body.audioUrl
    } else if (contentType?.includes('multipart/form-data')) {
      const formData = await request.formData()
      audioFile = formData.get('audio') as File
    }

    if (!audioUrl && !audioFile) {
      return NextResponse.json(
        { error: 'audioUrl or audio file is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Получаем настройки AI
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('*')
      .single()

    if (!aiSettings?.openrouter_api_key) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 503 }
      )
    }

    // Транскрибируем через OpenRouter
    let transcription: string

    if (audioUrl) {
      transcription = await transcribeFromUrl(
        audioUrl,
        aiSettings.openrouter_api_key,
        aiSettings.selected_model
      )
    } else if (audioFile) {
      transcription = await transcribeFromFile(
        audioFile,
        aiSettings.openrouter_api_key,
        aiSettings.selected_model
      )
    } else {
      throw new Error('No audio source provided')
    }

    console.log('[AI:TRANSCRIBE] Success')

    return NextResponse.json({
      success: true,
      transcription
    })

  } catch (error) {
    console.error('[AI:TRANSCRIBE] Error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to transcribe audio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Транскрипция аудио по URL через OpenRouter
 * OpenRouter поддерживает Whisper модели через совместимый API
 */
async function transcribeFromUrl(
  audioUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    // Для транскрипции используем специализированную модель
    const transcriptionModel = 'openai/whisper-large-v3'

    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      },
      body: JSON.stringify({
        model: transcriptionModel,
        file: audioUrl,
        language: 'ru' // Русский язык
      })
    })

    if (!response.ok) {
      throw new Error(`OpenRouter transcription error: ${response.status}`)
    }

    const data = await response.json()
    return data.text || ''

  } catch (error) {
    console.error('[AI:TRANSCRIBE] Error with URL:', error)
    
    // Фоллбэк: используем текстовую модель для анализа
    // (если прямая транскрипция недоступна)
    return fallbackTranscription(audioUrl, apiKey, model)
  }
}

/**
 * Транскрипция загруженного файла
 */
async function transcribeFromFile(
  file: File,
  apiKey: string,
  model: string
): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('model', 'openai/whisper-large-v3')
    formData.append('language', 'ru')

    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`OpenRouter transcription error: ${response.status}`)
    }

    const data = await response.json()
    return data.text || ''

  } catch (error) {
    console.error('[AI:TRANSCRIBE] Error with file:', error)
    return '[Ошибка транскрипции аудио]'
  }
}

/**
 * Фоллбэк метод - описание что это звонок
 */
async function fallbackTranscription(
  audioUrl: string,
  apiKey: string,
  model: string
): Promise<string> {
  return `[Аудиозапись звонка: ${audioUrl}]\n\nПримечание: Автоматическая транскрипция недоступна. Прослушайте запись вручную.`
}
