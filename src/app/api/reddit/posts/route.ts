import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const subredditFilter = searchParams.get('subreddit')
  const topicFilter = searchParams.get('topic')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const sort = searchParams.get('sort') === 'date' ? 'created_utc' : 'score'

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
      id, reddit_post_id, title, score, num_comments, created_utc, permalink, flair, topics,
      reddit_subreddits!inner(subreddit, niche)
    `)
    .order(sort, { ascending: false })
    .limit(limit)

  if (subredditIds) {
    query = query.in('subreddit_id', subredditIds)
  }

  if (topicFilter) {
    query = query.contains('topics', [topicFilter.toLowerCase()])
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
