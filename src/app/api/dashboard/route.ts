import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

function parseMetric(metric: any) {
  if (!metric) return null
  try {
    return {
      ...metric,
      data: typeof metric.data === 'string' ? JSON.parse(metric.data) : metric.data,
    }
  } catch {
    return metric
  }
}

function metricTimestamp(metric: any) {
  return new Date(metric.submitted_at || metric.created_at || 0).getTime()
}

function weekTimestamp(metric: any) {
  return new Date(metric.week_ending).getTime()
}

function getLatestDistinctMetrics(metrics: any[]) {
  const newestPerWeek = new Map<string, any>()

  for (const metric of metrics || []) {
    const existing = newestPerWeek.get(metric.week_ending)
    if (!existing || metricTimestamp(metric) > metricTimestamp(existing)) {
      newestPerWeek.set(metric.week_ending, metric)
    }
  }

  const distinctWeeks = Array.from(newestPerWeek.values()).sort((a, b) => {
    const weekDiff = weekTimestamp(b) - weekTimestamp(a)
    if (weekDiff !== 0) return weekDiff
    return metricTimestamp(b) - metricTimestamp(a)
  })

  return {
    latestMetric: parseMetric(distinctWeeks[0] || null),
    prevMetric: parseMetric(distinctWeeks[1] || null),
  }
}

export async function GET() {
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: patterns } = await supabase
    .from('patterns')
    .select('*')
    .order('avg_engagement_score', { ascending: false })
    .limit(5)

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('status', 'active')

  const clientGrid = await Promise.all(
    (clients || []).map(async (client) => {
      const { data: metrics } = await supabase
        .from('weekly_metrics')
        .select('*')
        .eq('client_id', client.id)
        .order('week_ending', { ascending: false })
        .order('submitted_at', { ascending: false })

      const { latestMetric, prevMetric } = getLatestDistinctMetrics(metrics || [])

      let twitterSnapshot = null
      if (client.vertical === 'gaming_web3' && client.twitter_url) {
        const { data: snapshots } = await supabase
          .from('client_twitter_snapshots')
          .select('*')
          .eq('client_id', client.id)
          .order('snapshot_date', { ascending: false })
          .limit(2)
        if (snapshots?.length) twitterSnapshot = snapshots
      }

      return {
        ...client,
        latest_metric: latestMetric,
        prev_metric: prevMetric,
        twitter_snapshots: twitterSnapshot,
      }
    })
  )

  const { count: total_clients } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active')
  const { count: total_competitors } = await supabase.from('competitors').select('*', { count: 'exact', head: true })
  const { count: total_posts } = await supabase.from('competitive_posts').select('*', { count: 'exact', head: true })
  const { count: active_patterns } = await supabase.from('patterns').select('*', { count: 'exact', head: true }).in('status', ['emerging', 'active'])
  const { count: active_alerts } = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('dismissed', false)

  const stats = {
    total_clients: total_clients || 0,
    total_competitors: total_competitors || 0,
    total_posts: total_posts || 0,
    active_patterns: active_patterns || 0,
    active_alerts: active_alerts || 0,
  }

  return NextResponse.json({ alerts: alerts || [], patterns: patterns || [], clientGrid, stats })
}
