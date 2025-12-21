import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  const rawBody = await request.text()
  
  console.log('=== TEST WEBHOOK ===')
  console.log('Content-Type:', contentType)
  console.log('Raw Body:', rawBody)
  console.log('Body length:', rawBody.length)
  
  return NextResponse.json({
    success: true,
    received: {
      contentType,
      rawBody,
      length: rawBody.length,
      char74: rawBody[74],
      char79: rawBody[79],
      around74: rawBody.substring(64, 84),
      around79: rawBody.substring(69, 89)
    }
  })
}
