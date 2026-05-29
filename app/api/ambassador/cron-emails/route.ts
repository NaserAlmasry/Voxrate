export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { verifyCronBearer } from '@/app/lib/cron-auth'
export async function GET(request: NextRequest) {
  const authErr = verifyCronBearer(request)
  if (authErr) return authErr

  return NextResponse.json({ sent: 0 })
}
