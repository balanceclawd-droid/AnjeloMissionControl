import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  let body: any = {}
  try { body = await req.json() } catch { /* ok */ }

  const reportType: 'daily' | 'weekly' = body.type === 'weekly' ? 'weekly' : 'daily'

  // Determine date window
  const now = new Date()
  const windowMs = reportType === 'weekly' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
  const since = new Date(now.getTime() - windowMs).toISOString()

  // Fetch posts in window
  const { data: posts, error: postsErr } = await supabase
    .from('market_intelligence_posts')
    .select('*')
    .gte('scraped_at', since)
    .order('engagement_score', { ascending: false })

  if (postsErr) return NextResponse.json({ error: postsErr.message }, { status: 500 })

  const allPosts = posts || []

  if (allPosts.length === 0) {
    return NextResponse.json({ message: 'No posts found in window', report: null })
  }

  // Group by niche via source keyword → research_keywords
  const { data: keywords } = await supabase.from('research_keywords').select('keyword, niche')
  const keywordNicheMap = new Map((keywords || []).map((k: any) => [k.keyword.toLowerCase(), k.niche]))

  function inferNiche(post: any): string {
    const src = (post.source || '').toLowerCase()
    for (const [kw, niche] of keywordNicheMap) {
      if (src.includes(kw)) return niche as string
    }
    return 'Other'
  }

  // Get top posts (top 10 by score)
  const topPosts = allPosts.slice(0, 10).map(p => ({
    handle: p.handle,
    display_name: p.display_name,
    content: p.content.slice(0, 280),
    tweet_url: p.tweet_url,
    engagement_score: p.engagement_score,
    likes: p.likes,
    retweets: p.retweets,
    replies: p.replies,
    niche: inferNiche(p),
  }))

  // New competitor suggestions created since window
  const { data: newSuggestions } = await supabase
    .from('competitor_suggestions')
    .select('handle, display_name, niche, avg_engagement, sample_post, tweet_url')
    .gte('suggested_at', since)
    .eq('status', 'pending')

  const newAccounts = (newSuggestions || []).map((s: any) => ({
    handle: s.handle,
    display_name: s.display_name,
    niche: s.niche,
    avg_engagement: s.avg_engagement,
    sample_post: s.sample_post?.slice(0, 140),
    tweet_url: s.tweet_url,
  }))

  // Build summary
  const totalPosts = allPosts.length
  const uniqueAccounts = new Set(allPosts.map(p => p.handle)).size
  const avgScore = Math.round(allPosts.reduce((s, p) => s + p.engagement_score, 0) / Math.max(allPosts.length, 1))

  // Niche breakdown
  const nicheCounts: Record<string, number> = {}
  for (const p of allPosts) {
    const n = inferNiche(p)
    nicheCounts[n] = (nicheCounts[n] || 0) + 1
  }
  const topNiche = Object.entries(nicheCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other'

  const period = reportType === 'daily' ? 'last 24 hours' : 'last 7 days'
  const summary = `${reportType === 'weekly' ? 'Weekly' : 'Daily'} report — ${period}: ${totalPosts} posts scraped from ${uniqueAccounts} accounts. Average engagement score: ${avgScore}/100. Most active niche: ${topNiche}. ${newAccounts.length} new potential competitor${newAccounts.length !== 1 ? 's' : ''} detected.`

  // Determine niche label for the report (if body.niche provided, use it; else 'all')
  const niche = body.niche || 'all'

  const { data: report, error: reportErr } = await supabase
    .from('research_reports')
    .insert({
      report_type: reportType,
      niche,
      summary,
      top_posts: topPosts,
      new_accounts: newAccounts,
    })
    .select()
    .single()

  if (reportErr) return NextResponse.json({ error: reportErr.message }, { status: 500 })

  return NextResponse.json({ report })
}
