import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const clientId = params.id

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const since = thirtyDaysAgo.toISOString().slice(0, 10)

  const { data: snapshots, error } = await supabase
    .from('client_twitter_snapshots')
    .select('*')
    .eq('client_id', clientId)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!snapshots || snapshots.length === 0) {
    return NextResponse.json({ snapshots: [], currentFollowers: null, growth: null })
  }

  const oldest = snapshots[0]
  const newest = snapshots[snapshots.length - 1]

  return NextResponse.json({
    snapshots,
    currentFollowers: newest.followers_count,
    growth: newest.followers_count - oldest.followers_count,
  })
}
