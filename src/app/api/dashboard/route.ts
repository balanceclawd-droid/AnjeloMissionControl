import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

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
      const { data: latestMetrics } = await supabase
        .from('weekly_metrics')
        .select('*')
        .eq('client_id', client.id)
        .order('week_ending', { ascending: false })
        .limit(2)

      const latestMetric = latestMetrics?.[0] || null
      const prevMetric = latestMetrics?.[1] || null

      // For gaming clients, always pull latest Twitter snapshot
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
        latest_metric: latestMetric ? (() => { try { return { ...latestMetric, data: typeof latestMetric.data === 'string' ? JSON.parse(latestMetric.data) : latestMetric.data } } catch { return latestMetric } })() : null,
        prev_metric: prevMetric ? (() => { try { return { ...prevMetric, data: typeof prevMetric.data === 'string' ? JSON.parse(prevMetric.data) : prevMetric.data } } catch { return prevMetric } })() : null,
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
