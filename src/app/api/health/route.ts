import { NextResponse } from 'next/server'

/**
 * Health Check endpoint for monitoring
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    service: 'crm',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
}
