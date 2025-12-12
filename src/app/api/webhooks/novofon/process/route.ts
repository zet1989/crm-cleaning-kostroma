import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface CallData {
  manager_id: string;
  phone: string;
  direction: 'in' | 'out';
  status: string;
  duration: number;
  talk_duration: number;
  wait_duration: number;
  call_id: string;
  started_at: string;
  finished_at: string;
  record_url?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Проверка внутреннего секрета
    const internalSecret = request.headers.get('X-Internal-Secret');
    const expectedSecret = process.env.INTERNAL_API_SECRET || 'dev-secret';

    if (internalSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const callData: CallData = await request.json();
    console.log('Processing Novofon call:', callData);

    const supabase = await createClient();

    // Проверяем, не обрабатывали ли мы уже этот звонок
    const { data: existingDeal } = await supabase
      .from('deals')
      .select('id')
      .eq('source', 'Novofon')
      .eq('phone', callData.phone)
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // За последний час
      .single();

    if (existingDeal) {
      console.log('Call already processed, skipping');
      return NextResponse.json({ 
        success: true, 
        message: 'Already processed',
        deal_id: existingDeal.id 
      });
    }

    // Получаем системный промпт для AI
    const { data: aiSettings } = await supabase
      .from('ai_settings')
      .select('system_prompt')
      .single();

    const systemPrompt = aiSettings?.system_prompt || `Ты — ассистент для CRM. Извлеки из текста следующую информацию:
- Имя клиента
- Телефон
- Email (если есть)
- Название компании (если есть)
- Краткое описание запроса`;

    // Проверяем наличие записи звонка
    let transcription = '';
    let extractedData: any = {};

    if (callData.record_url) {
      try {
        // Транскрибируем запись через OpenRouter Whisper
        const audioResponse = await fetch(callData.record_url);
        const audioBuffer = await audioResponse.arrayBuffer();
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');

        const whisperResponse = await fetch(
          'https://openrouter.ai/api/v1/audio/transcriptions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'whisper-large-v3',
              file: audioBase64,
              language: 'ru',
            }),
          }
        );

        if (whisperResponse.ok) {
          const whisperData = await whisperResponse.json();
          transcription = whisperData.text || '';
          console.log('Transcription:', transcription);

          // Извлекаем данные через GPT
          if (transcription) {
            const gptResponse = await fetch(
              'https://openrouter.ai/api/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'openai/gpt-4o-mini',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: transcription },
                  ],
                }),
              }
            );

            if (gptResponse.ok) {
              const gptData = await gptResponse.json();
              const extractedText = gptData.choices[0]?.message?.content || '';
              
              // Парсим ответ (предполагаем JSON или простой текст)
              try {
                extractedData = JSON.parse(extractedText);
              } catch {
                extractedData = { description: extractedText };
              }
            }
          }
        }
      } catch (error) {
        console.error('Error processing call recording:', error);
      }
    }

    // Проверка на повторного клиента (по телефону)
    const { data: existingClient } = await supabase
      .from('deals')
      .select('client_name')
      .eq('phone', callData.phone)
      .not('client_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const isRepeatClient = !!existingClient;

    // Получаем колонку "Новая заявка"
    const { data: column } = await supabase
      .from('columns')
      .select('id')
      .eq('title', 'Новая заявка')
      .single();

    if (!column) {
      throw new Error('Column "Новая заявка" not found');
    }

    // Создаём сделку
    const dealData = {
      client_name: extractedData.name || existingClient?.client_name || 'Клиент из Novofon',
      phone: callData.phone,
      email: extractedData.email || null,
      company: extractedData.company || null,
      description: extractedData.description || transcription || `Входящий звонок ${callData.started_at}`,
      source: 'Novofon',
      column_id: column.id,
      manager_id: callData.manager_id,
      status: isRepeatClient ? 'Повторный клиент' : 'Новый',
      call_duration: callData.talk_duration,
      call_recording_url: callData.record_url,
      metadata: {
        novofon_call_id: callData.call_id,
        call_status: callData.status,
        total_duration: callData.duration,
        wait_duration: callData.wait_duration,
        transcription: transcription,
      },
    };

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .insert(dealData)
      .select()
      .single();

    if (dealError) {
      console.error('Error creating deal:', dealError);
      throw dealError;
    }

    console.log('Deal created successfully:', deal.id);

    return NextResponse.json({
      success: true,
      deal_id: deal.id,
      is_repeat_client: isRepeatClient,
      transcription: transcription ? 'Generated' : 'Not available',
    });

  } catch (error) {
    console.error('Error processing Novofon call:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
