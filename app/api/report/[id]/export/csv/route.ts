import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase
    .from('users')
    .select('plan, is_admin')
    .eq('id', user.id)
    .single()

  const plan    = userData?.plan    || 'free'
  const isAdmin = userData?.is_admin === true

  if (!isAdmin && !['growth', 'pro'].includes(plan)) {
    return NextResponse.json({ error: 'CSV export requires Growth or Pro plan' }, { status: 403 })
  }

  const { id } = await params

  const { data: report } = await supabase
    .from('reports')
    .select('product_name, health_score, full_report, created_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const complaints  = report.full_report?.complaints  || []
  const strengths   = report.full_report?.strengths   || []
  const topActions  = report.full_report?.topActions  || report.full_report?.improvements || []

  function esc(val: any): string {
    return `"${String(val ?? '').replace(/"/g, '""')}"`
  }

  const rows: string[] = [
    [esc('Product'), esc('Health Score'), esc('Analysis Date')].join(','),
    [esc(report.product_name), esc(report.health_score), esc(new Date(report.created_at).toLocaleDateString())].join(','),
    '',
    esc('COMPLAINTS'),
    [esc('Theme'), esc('Percentage'), esc('Severity'), esc('Fix Recommendation')].join(','),
    ...complaints.map((c: any) =>
      [esc(c.title), esc(`${c.percentage ?? ''}%`), esc(c.severity), esc(c.fix || c.recommendation || '')].join(',')
    ),
    '',
    esc('STRENGTHS'),
    esc('Strength'),
    ...strengths.map((s: any) =>
      esc(typeof s === 'string' ? s : s.title || s.text || JSON.stringify(s))
    ),
    '',
    esc('TOP ACTIONS'),
    esc('Action'),
    ...topActions.map((a: any) =>
      esc(typeof a === 'string' ? a : a.title || a.action || JSON.stringify(a))
    ),
  ]

  const csv = rows.join('\n')
  const filename = `voxrate-${(report.product_name || 'report').replace(/[^\w\s-]/g, '').trim().slice(0, 40)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
