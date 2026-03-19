import { NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CLIENTS = [
  { id: 11, name: 'Marbula One', vertical: 'gaming_web3', redditNiche: 'Gaming', competitorNiche: 'gaming_web3' },
  { id: 10, name: 'BitsoOnchain', vertical: 'cex', redditNiche: 'CEX', competitorNiche: 'cex' },
  { id: 20, name: 'MiloOnChains', vertical: 'ai_trading', redditNiche: 'DeFi', competitorNiche: 'ai_trading' },
]

const HOOK_ADVICE: Record<string, string> = {
  bold_claim: 'Lead with a bold performance or ROI claim',
  question: 'Open with a provocative question your audience is already asking',
  statement: 'Make a clear declarative statement that takes a strong position',
  media_only: 'Lead with strong visual content, minimal copy',
}

function getSuggestedAngle(hookType: string, topic: string): string {
  const advice = HOOK_ADVICE[hookType] || 'Match the format competitors are using'
  return `Competitors are using ${hookType} hooks around ${topic} — community is clearly interested. Post angle: ${advice}.`
}

export async function GET() {
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const sinceReddit = sevenDaysAgo.toISOString().split('T')[0]
  const sinceCompetitor = thirtyDaysAgo.toISOString()

  const results = []

  for (const client of CLIENTS) {
    // Fetch reddit trending for this client's niche (last 7 days)
    const { data: redditTopics, error: redditErr } = await supabase
      .from('reddit_trending')
      .select('*')
      .eq('niche', client.redditNiche)
      .gte('trend_date', sinceReddit)
      .order('mention_count', { ascending: false })

    if (redditErr) {
      console.error(`Reddit fetch error for ${client.name}:`, redditErr.message)
      continue
    }

    // Fetch top competitive posts for this client's competitor niche (last 30 days, engagement >= 40)
    const { data: competitorPosts, error: compErr } = await supabase
      .from('competitive_posts')
      .select('*, competitors!inner(name, niche)')
      .eq('competitors.niche', client.competitorNiche)
      .gte('engagement_score', 40)
      .gte('classified_at', sinceCompetitor)
      .order('engagement_score', { ascending: false })

    if (compErr) {
      console.error(`Competitor fetch error for ${client.name}:`, compErr.message)
      continue
    }

    if (!redditTopics?.length || !competitorPosts?.length) {
      results.push({
        client_id: client.id,
        client_name: client.name,
        niche: client.vertical,
        opportunities: [],
      })
      continue
    }

    // Cross-reference: find topics that appear in both reddit trending AND competitive posts
    const opportunities = []

    for (const trend of redditTopics) {
      const topicLower = (trend.topic as string).toLowerCase()

      const matchingPosts = competitorPosts.filter((post) => {
        const content = ((post.content as string) || '').toLowerCase()
        const label = ((post.semantic_label as string) || '').toLowerCase()
        return content.includes(topicLower) || label.includes(topicLower)
      })

      if (matchingPosts.length === 0) continue

      // Determine the most common hook_type among matching posts
      const hookCounts: Record<string, number> = {}
      for (const p of matchingPosts) {
        const ht = (p.hook_type as string) || 'statement'
        hookCounts[ht] = (hookCounts[ht] || 0) + 1
      }
      const dominantHook = Object.entries(hookCounts).sort((a, b) => b[1] - a[1])[0][0]

      const samplePosts = Array.isArray(trend.sample_titles)
        ? (trend.sample_titles as Array<{ title: string; permalink: string }>).slice(0, 2)
        : []

      const opportunityScore = Math.round(
        (trend.mention_count as number) * (trend.avg_score as number) * matchingPosts.length
      )

      opportunities.push({
        client_id: client.id,
        client_name: client.name,
        niche: client.vertical,
        topic: trend.topic,
        reddit_signal: {
          mention_count: trend.mention_count,
          avg_score: trend.avg_score,
          sample_posts: samplePosts,
        },
        competitor_signal: {
          post_count: matchingPosts.length,
          top_posts: matchingPosts.slice(0, 3).map((p) => ({
            content: (p.content as string)?.slice(0, 200),
            hook_type: p.hook_type,
            engagement_score: p.engagement_score,
            competitor_name: (p.competitors as { name: string })?.name || 'Unknown',
          })),
        },
        opportunity_score: opportunityScore,
        suggested_angle: getSuggestedAngle(dominantHook, trend.topic as string),
      })
    }

    // Sort by opportunity score descending
    opportunities.sort((a, b) => b.opportunity_score - a.opportunity_score)

    results.push({
      client_id: client.id,
      client_name: client.name,
      niche: client.vertical,
      opportunities,
    })
  }

  return NextResponse.json(results)
}
