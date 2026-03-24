import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { detectTrends, extractTopicsFromPost } from '@/lib/reddit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { subreddit, niche, posts } = body
  if (!subreddit || !Array.isArray(posts)) {
    return NextResponse.json({ error: 'subreddit and posts[] required' }, { status: 400 })
  }

  if (posts.length === 0) {
    return NextResponse.json({ posts_inserted: 0, trends_detected: 0 })
  }

  // Get subreddit DB row
  const { data: subRow } = await supabase
    .from('reddit_subreddits')
    .select('id')
    .eq('subreddit', subreddit)
    .maybeSingle()

  if (!subRow) {
    return NextResponse.json({ error: `Subreddit ${subreddit} not found in DB` }, { status: 404 })
  }

  // Dedup
  const postIds = posts.map((p: any) => p.id).filter(Boolean)
  const { data: existing } = await supabase
    .from('reddit_posts')
    .select('reddit_post_id')
    .in('reddit_post_id', postIds)

  const existingIds = new Set((existing || []).map((e: any) => e.reddit_post_id))
  const newPosts = posts.filter((p: any) => p.id && !existingIds.has(p.id))

  let posts_inserted = 0
  const errors: string[] = []

  if (newPosts.length > 0) {
    const rows = newPosts.map((p: any) => ({
      subreddit_id: subRow.id,
      reddit_post_id: p.id,
      title: p.title || '',
      body: p.body || '',
      author: p.author || '',
      url: p.url || '',
      permalink: p.permalink || '',
      score: p.score || 0,
      upvote_ratio: p.upvote_ratio || 0,
      num_comments: p.num_comments || 0,
      created_utc: p.created_utc || new Date().toISOString(),
      flair: p.flair || null,
      topics: extractTopicsFromPost(p.title || '', p.body || '', niche || 'General'),
      signal_strength: p.num_comments >= 10 ? 'high' : p.num_comments >= 5 ? 'medium' : 'low',
    }))

    const { error: insertErr } = await supabase.from('reddit_posts').insert(rows)
    if (insertErr) {
      errors.push(insertErr.message)
    } else {
      posts_inserted = newPosts.length
    }
  }

  // Detect trends
  let trends_detected = 0
  if (posts_inserted > 0) {
    const allPosts = newPosts.map((p: any) => ({
      title: p.title || '',
      body: p.body || '',
      score: p.score || 0,
      topics: extractTopicsFromPost(p.title || '', p.body || '', niche || 'General'),
    }))

    const trends = detectTrends(allPosts as any, niche || 'General')
    if (trends.length > 0) {
      const trendRows = trends.map(t => ({
        niche: t.niche,
        topic: t.topic,
        mention_count: t.mention_count,
        avg_score: t.avg_score,
        sample_titles: t.sample_titles,
        trend_date: new Date().toISOString().split('T')[0],
      }))

      const { error: trendErr } = await supabase
        .from('reddit_trending')
        .upsert(trendRows, { onConflict: 'niche,topic,trend_date' })

      if (!trendErr) trends_detected = trendRows.length
    }
  }

  return NextResponse.json({ posts_inserted, trends_detected, ...(errors.length ? { errors } : {}) })
}
