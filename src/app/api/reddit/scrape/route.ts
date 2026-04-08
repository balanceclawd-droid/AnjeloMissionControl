import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { scrapeSubredditsViaPublicJson, detectTrends } from '@/lib/reddit'

export const maxDuration = 60 // Vercel max for hobby plan

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const batchSize = body.batch_size || 10
  const offset = body.offset || 0

  // Get active subreddits — support batching via offset
  const { data: subreddits, error: subErr } = await supabase
    .from('reddit_subreddits')
    .select('*')
    .eq('active', true)
    .range(offset, offset + batchSize - 1)

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
  if (!subreddits || subreddits.length === 0) {
    return NextResponse.json({ scraped_subreddits: 0, posts_inserted: 0, trends_detected: 0 })
  }

  let posts_inserted = 0
  let scraped_subreddits = 0
  const errors: string[] = []
  const nichePostsMap: Record<string, any[]> = {}

  // Build subreddit → DB row map and niche map
  const subMap: Record<string, any> = {}
  const nicheMap: Record<string, string> = {}
  for (const sub of subreddits) {
    subMap[sub.subreddit.toLowerCase()] = sub
    nicheMap[sub.subreddit.toLowerCase()] = sub.niche
  }

  try {
    const subNames = subreddits.map((s: any) => s.subreddit)
    const results = await scrapeSubredditsViaPublicJson(subNames, 25, nicheMap)
    const sourceErrors = results.filter(r => r.error).map(r => `r/${r.subreddit}: ${r.error}`)
    if (sourceErrors.length > 0) errors.push(...sourceErrors)

    for (const { subreddit, posts } of results) {
      const sub = subMap[subreddit.toLowerCase()]
      if (!sub) continue
      scraped_subreddits++

      // Collect for trend detection
      if (!nichePostsMap[sub.niche]) nichePostsMap[sub.niche] = []
      nichePostsMap[sub.niche].push(...posts)

      if (posts.length === 0) continue

      // Deduplicate against existing
      const postIds = posts.map(p => p.reddit_post_id).filter(Boolean)
      const { data: existing } = await supabase
        .from('reddit_posts')
        .select('reddit_post_id')
        .in('reddit_post_id', postIds)

      const existingIds = new Set((existing || []).map((e: any) => e.reddit_post_id))
      const newPosts = posts.filter(p => p.reddit_post_id && !existingIds.has(p.reddit_post_id))

      if (newPosts.length > 0) {
        const rows = newPosts.map(p => ({
          subreddit_id: sub.id,
          reddit_post_id: p.reddit_post_id,
          title: p.title,
          body: p.body,
          author: p.author,
          url: p.url,
          permalink: p.permalink,
          score: p.score,
          upvote_ratio: p.upvote_ratio,
          num_comments: p.num_comments,
          created_utc: p.created_utc,
          flair: p.flair,
          topics: p.topics,
          signal_strength: p.signal_strength,
        }))

        const { error: insertErr } = await supabase.from('reddit_posts').insert(rows)
        if (insertErr) {
          errors.push(`Insert error for r/${subreddit}: ${insertErr.message}`)
        } else {
          posts_inserted += newPosts.length
        }
      }
    }
  } catch (err: any) {
    errors.push(`Reddit scrape error: ${err.message}`)
  }

  // Detect trends per niche and upsert
  let trends_detected = 0
  for (const [niche, posts] of Object.entries(nichePostsMap)) {
    const trends = detectTrends(posts, niche)
    if (trends.length === 0) continue

    const rows = trends.map(t => ({
      niche: t.niche,
      topic: t.topic,
      mention_count: t.mention_count,
      avg_score: t.avg_score,
      sample_titles: t.sample_titles,
      trend_date: new Date().toISOString().split('T')[0],
    }))

    const { error: trendErr } = await supabase
      .from('reddit_trending')
      .upsert(rows, { onConflict: 'niche,topic,trend_date' })

    if (trendErr) {
      errors.push(`Trend upsert error for ${niche}: ${trendErr.message}`)
    } else {
      trends_detected += rows.length
    }
  }

  return NextResponse.json({
    scraped_subreddits,
    posts_inserted,
    trends_detected,
    source: 'public-json',
    source_blocked: errors.some(e => e.includes('HTTP 403') || e.includes('blocked')),
    ...(errors.length > 0 ? { errors } : {}),
  })
}
