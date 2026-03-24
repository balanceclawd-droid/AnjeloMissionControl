import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const subredditFilter = searchParams.get('subreddit')
  const topicFilter = searchParams.get('topic')
  const signalFilter = searchParams.get('signal') // high | medium | low
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const sort = searchParams.get('sort') === 'date' ? 'created_utc' : 'score'
  const since = searchParams.get('since') // ISO date string e.g. 2026-03-24

  // Get matching subreddit IDs if filtering
  let subredditIds: number[] | null = null

  if (niche || subredditFilter) {
    let subQuery = supabase.from('reddit_subreddits').select('id')
    if (niche) subQuery = subQuery.eq('niche', niche)
    if (subredditFilter) subQuery = subQuery.ilike('subreddit', `%${subredditFilter}%`)
    const { data: subs } = await subQuery
    subredditIds = subs?.map((s: any) => s.id) || []
    if (subredditIds.length === 0) return NextResponse.json([])
  }

  let query = supabase
    .from('reddit_posts')
    .select(`
      id, reddit_post_id, title, score, num_comments, created_utc, created_at, permalink, flair, topics, signal_strength,
      reddit_subreddits!inner(subreddit, niche)
    `)
    .order(sort, { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gte('created_at', since)
  }

  if (subredditIds) {
    query = query.in('subreddit_id', subredditIds)
  }

  if (topicFilter) {
    query = query.contains('topics', [topicFilter.toLowerCase()])
  }

  if (signalFilter && ['high', 'medium', 'low'].includes(signalFilter)) {
    query = query.eq('signal_strength', signalFilter)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
