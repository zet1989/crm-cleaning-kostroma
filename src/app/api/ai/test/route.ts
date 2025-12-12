import { NextRequest, NextResponse } from 'next/server'

/**
 * Test AI connection endpoint
 * POST /api/ai/test
 */
export async function POST(req: NextRequest) {
  try {
    const { apiKey, model } = await req.json()

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    // Test API call to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        'X-Title': 'CRM Test'
      },
      body: JSON.stringify({
        model: model || 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello" if you can read this.'
          }
        ],
        max_tokens: 10
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[AI:TEST] OpenRouter error:', error)
      
      return NextResponse.json(
        { 
          success: false, 
          error: `OpenRouter API error: ${response.status}`,
          details: error
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      model: data.model,
      response: data.choices?.[0]?.message?.content || 'No response'
    })

  } catch (error) {
    console.error('[AI:TEST] Error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
