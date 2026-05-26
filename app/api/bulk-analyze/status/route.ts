import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rawIds = request.nextUrl.searchParams.get('jobIds') || ''
  const jobIds = rawIds.split(',').map(s => s.trim()).filter(Boolean)

  if (jobIds.length === 0) {
    return NextResponse.json({ error: 'jobIds is required' }, { status: 400 })
  }
  if (jobIds.length > 5) {
    return NextResponse.json({ error: 'Maximum 5 job IDs' }, { status: 400 })
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: jobs, error } = await adminSupabase
    .from('extension_jobs')
    .select('id, status, asin, error')
    .in('id', jobIds)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch job statuses' }, { status: 500 })
  }

  // For completed/partial jobs, look up the resulting report
  const completedJobs = (jobs || []).filter(j => j.status === 'completed' || j.status === 'partial')
  const reportMap = new Map<string, string>()

  if (completedJobs.length > 0) {
    for (const job of completedJobs) {
      const { data: report } = await adminSupabase
        .from('reports')
        .select('id')
        .eq('user_id', user.id)
        .ilike('product_url', `%${job.asin}%`)
        .in('status', ['completed', 'partial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (report?.id) reportMap.set(job.id, report.id)
    }
  }

  const statuses = (jobs || []).map(job => ({
    jobId:    job.id,
    asin:     job.asin,
    status:   job.status,
    reportId: reportMap.get(job.id) ?? null,
    error:    job.error ?? null,
  }))

  return NextResponse.json({ statuses })
}
