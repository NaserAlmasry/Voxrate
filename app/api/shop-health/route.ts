import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { checkRateLimit } from '@/app/lib/rate-limit'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = await checkRateLimit(`shop-health:${user.id}`, 'user')
  if (!limit.allowed) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  // Get all completed own-product reports for this user
  const { data: reports } = await supabase
    .from('reports')
    .select('id, product_name, product_url, health_score, full_report, created_at')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .or('report_type.eq.own,report_type.is.null')
    .order('created_at', { ascending: false })

  if (!reports || reports.length === 0) {
    return NextResponse.json({ error: 'No analyzed products yet', empty: true }, { status: 200 })
  }

  // Deduplicate by product_url — keep most recent
  const seen = new Set<string>()
  const unique = reports.filter(r => {
    if (seen.has(r.product_url)) return false
    seen.add(r.product_url)
    return true
  })

  const scores      = unique.map(r => r.health_score || 0)
  const shopScore   = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  const weakest     = [...unique].sort((a, b) => (a.health_score || 0) - (b.health_score || 0)).slice(0, 3)
  const strongest   = [...unique].sort((a, b) => (b.health_score || 0) - (a.health_score || 0)).slice(0, 3)

  // Aggregate complaints across all listings
  const complaintMap = new Map<string, number>()
  for (const r of unique) {
    const complaints = r.full_report?.complaints || []
    for (const c of complaints) {
      if (c.title) {
        complaintMap.set(c.title, (complaintMap.get(c.title) || 0) + 1)
      }
    }
  }
  const topComplaints = [...complaintMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, count }))

  // Aggregate strengths
  const strengthMap = new Map<string, number>()
  for (const r of unique) {
    const strengths = r.full_report?.strengths || []
    for (const s of strengths) {
      if (s.title) {
        strengthMap.set(s.title, (strengthMap.get(s.title) || 0) + 1)
      }
    }
  }
  const topStrengths = [...strengthMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([title, count]) => ({ title, count }))

  // Grade
  const grade = shopScore >= 80 ? 'A' : shopScore >= 66 ? 'B' : shopScore >= 50 ? 'C' : shopScore >= 38 ? 'D' : 'F'

  // Priorities — top 3 actions
  const priorities: string[] = []
  if (weakest[0] && (weakest[0].health_score || 0) < 50) {
    priorities.push(`Fix "${weakest[0].product_name}" — your lowest-scoring listing at ${weakest[0].health_score}`)
  }
  if (topComplaints[0]) {
    priorities.push(`Address recurring complaint across ${topComplaints[0].count} listing${topComplaints[0].count > 1 ? 's' : ''}: "${topComplaints[0].title}"`)
  }
  if (scores.filter(s => s < 38).length > 0) {
    priorities.push(`${scores.filter(s => s < 38).length} listing${scores.filter(s => s < 38).length > 1 ? 's are' : ' is'} in critical condition — prioritize immediately`)
  } else if (scores.filter(s => s < 66).length > 0) {
    priorities.push(`${scores.filter(s => s < 66).length} listing${scores.filter(s => s < 66).length > 1 ? 's need' : ' needs'} improvement to reach a healthy score`)
  }

  return NextResponse.json({
    shopScore,
    grade,
    totalListings: unique.length,
    healthyCount:  scores.filter(s => s >= 66).length,
    warningCount:  scores.filter(s => s >= 38 && s < 66).length,
    criticalCount: scores.filter(s => s < 38).length,
    weakest:   weakest.map(r => ({ id: r.id, product_name: r.product_name, health_score: r.health_score })),
    strongest: strongest.map(r => ({ id: r.id, product_name: r.product_name, health_score: r.health_score })),
    topComplaints,
    topStrengths,
    priorities,
    allListings: unique.map(r => ({ id: r.id, product_name: r.product_name, health_score: r.health_score })),
  })
}
