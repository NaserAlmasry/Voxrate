// app/api/report/[id]/route.ts
// Server-side plan enforcement — applies data limits BEFORE sending to client.
// The client must never receive full paid data then filter it in JS.
// Also serves public (shared) reports to unauthenticated visitors with free-tier limits.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// NOTE: This is intentionally separate from app/lib/plan-limits.ts.
// lib/plan-limits.ts runs on raw LLM output before DB storage.
// This function runs on stored data fetched for display — it also strips
// _cache, exposes seo.score as a teaser, and nulls quickWin for free users.
// Keep both in sync when adding new plan-gated fields.
function applyPlanLimits(fullReport: any, plan: string, isAdmin: boolean) {
  if (isAdmin || plan === 'pro' || plan === 'growth' || plan === 'starter') {
    const { _cache, ...report } = fullReport || {}
    return { ...report, _isLimited: false }
  }

  // Free / public — return only what free users are allowed to see
  const { _cache, ...report } = fullReport || {}
  return {
    ...report,
    complaints:      Array.isArray(report.complaints)    ? report.complaints.slice(0, 2)    : [],
    strengths:       Array.isArray(report.strengths)     ? report.strengths.slice(0, 1)     : [],
    improvements:    [],
    marketingCopy:   [],
    reviewTemplates: [],
    topActions:      [],
    quickWin:        null,
    seo:             report.seo ? { score: report.seo.score } : null,
    _isLimited:      true,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: reportId } = await params

    if (!UUID_REGEX.test(reportId)) {
      return NextResponse.json({ error: 'Invalid report ID' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch report
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Public share — unauthenticated visitors can view with free-tier limits
    if (!user) {
      if (!report.is_public) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const filteredReport = applyPlanLimits(report.full_report, 'free', false)
      // Strip internal fields from public share response
      const { user_id: _uid, ...publicReport } = report
      return NextResponse.json({
        ...publicReport,
        full_report: filteredReport,
        _isSharedView: true,
      })
    }

    // Authenticated — ownership or admin check
    const { data: userData } = await supabase
      .from('users')
      .select('plan, is_admin')
      .eq('id', user.id)
      .single()

    const isAdmin = userData?.is_admin === true

    // Allow owner, admin, or anyone if public
    if (report.user_id !== user.id && !isAdmin && !report.is_public) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Owners and admins get their real plan; guests viewing a shared report get free limits
    const isOwnerOrAdmin = report.user_id === user.id || isAdmin
    const plan = isOwnerOrAdmin ? (userData?.plan || 'free') : 'free'
    const filteredReport = applyPlanLimits(report.full_report, plan, isAdmin && isOwnerOrAdmin)

    // Fetch previous report for diff
    let previousReport = null
    if (report.asin) {
      const { data: prev } = await supabase
        .from('reports')
        .select('id, health_score, full_report, created_at')
        .eq('user_id', report.user_id)
        .eq('asin', report.asin)
        .lt('created_at', report.created_at)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (prev?.full_report) {
        const { _cache, ...cleanFullReport } = prev.full_report
        previousReport = { ...prev, full_report: cleanFullReport }
      } else {
        previousReport = prev
      }
    }

    const { user_id: _uid, ...safeReport } = report
    return NextResponse.json({
      ...safeReport,
      full_report: filteredReport,
      previousReport,
      _isSharedView: !isOwnerOrAdmin,
    })

  } catch (err: any) {
    console.error('[ReportAPI] Error:', err.message)
    return NextResponse.json({ error: 'Failed to load report.' }, { status: 500 })
  }
}
