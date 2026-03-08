import { supabase } from './db'

interface Post {
  id: number
  competitor_id: number
  hook_type: string
  structure: string
  cta_type: string
  engagement_score: number
  posted_at: string
  niche?: string
}

export async function detectPatterns() {
  // Get all posts with competitor niche info
  const { data: rawPosts } = await supabase
    .from('competitive_posts')
    .select('*, competitors!inner(niche)')
    .not('hook_type', 'is', null)
    .not('structure', 'is', null)
    .not('cta_type', 'is', null)
    .order('posted_at', { ascending: false })

  const posts: Post[] = (rawPosts || []).map((p: any) => ({
    ...p,
    niche: p.competitors?.niche,
  }))

  // Group by hook_type + structure + cta_type
  const groups: Record<string, Post[]> = {}
  for (const post of posts) {
    const key = `${post.hook_type}|${post.structure}|${post.cta_type}`
    if (!groups[key]) groups[key] = []
    groups[key].push(post)
  }

  const newAlerts: Array<{ alert_type: string; pattern_id: number | null; niche: string; severity: string; message: string }> = []

  for (const [key, groupPosts] of Object.entries(groups)) {
    if (groupPosts.length < 2) continue

    const [hook_type, structure, cta_type] = key.split('|')
    const niches = [...new Set(groupPosts.map(p => p.niche))]
    const niche = niches[0] || 'Unknown'
    const postIds = groupPosts.map(p => p.id)
    const competitorIds = [...new Set(groupPosts.map(p => p.competitor_id))]
    const avgScore = groupPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / groupPosts.length

    // Check if pattern exists
    const { data: existing } = await supabase
      .from('patterns')
      .select('*')
      .eq('hook_type', hook_type)
      .eq('structure', structure)
      .eq('cta_type', cta_type)
      .single()

    const now = new Date().toISOString()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Determine status
    const recentPosts = groupPosts.filter(p => p.posted_at >= sevenDaysAgo)
    let status = 'emerging'
    if (recentPosts.length >= 3) status = 'active'
    else if (recentPosts.length === 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const monthPosts = groupPosts.filter(p => p.posted_at >= thirtyDaysAgo)
      status = monthPosts.length > 0 ? 'declining' : 'dormant'
    }

    if (existing) {
      await supabase
        .from('patterns')
        .update({
          post_ids: postIds,
          last_seen: now,
          competitor_count: competitorIds.length,
          avg_engagement_score: Math.round(avgScore * 10) / 10,
          status,
        })
        .eq('id', existing.id)
    } else {
      const desc = `${hook_type} hook + ${structure} structure + ${cta_type} CTA pattern detected across ${competitorIds.length} competitor(s)`
      const { data: newPattern } = await supabase
        .from('patterns')
        .insert({
          niche,
          hook_type,
          structure,
          cta_type,
          pattern_description: desc,
          post_ids: postIds,
          first_detected: now,
          last_seen: now,
          competitor_count: competitorIds.length,
          avg_engagement_score: Math.round(avgScore * 10) / 10,
          status,
        })
        .select()
        .single()

      const patternId = newPattern?.id || null

      let severity = 'low'
      if (avgScore > 75) severity = 'medium'
      if (competitorIds.length >= 3 || avgScore > 85) severity = 'high'

      newAlerts.push({
        alert_type: 'pattern_emerging',
        pattern_id: patternId,
        niche,
        severity,
        message: `New pattern detected: ${hook_type} + ${structure} + ${cta_type}. ${competitorIds.length} competitor(s), avg score: ${Math.round(avgScore)}`,
      })
    }

    // Check for accelerating patterns
    if (recentPosts.length >= 3 && existing) {
      newAlerts.push({
        alert_type: 'pattern_accelerating',
        pattern_id: existing.id,
        niche,
        severity: 'high',
        message: `Pattern accelerating: ${hook_type} + ${structure} has ${recentPosts.length} new posts in the last 7 days`,
      })
    }

    // High engagement alert
    if (avgScore > 75) {
      const topPost = groupPosts.sort((a, b) => b.engagement_score - a.engagement_score)[0]
      if (topPost && topPost.engagement_score > 85) {
        newAlerts.push({
          alert_type: 'engagement_spike',
          pattern_id: existing?.id || null,
          niche,
          severity: 'high',
          message: `High engagement spike: Post scored ${topPost.engagement_score}/100 using ${hook_type} + ${structure} pattern`,
        })
      }
    }
  }

  // Insert new alerts (avoid duplicates by checking recent ones)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  for (const alert of newAlerts) {
    const { data: recent } = await supabase
      .from('alerts')
      .select('id')
      .eq('alert_type', alert.alert_type)
      .eq('pattern_id', alert.pattern_id)
      .gte('created_at', oneDayAgo)
      .limit(1)

    if (!recent || recent.length === 0) {
      await supabase.from('alerts').insert(alert)
    }
  }

  return { patternsProcessed: Object.keys(groups).length, alertsGenerated: newAlerts.length }
}

export function calculateEngagementScore(metrics: { likes?: number; comments?: number; views?: number }): number {
  const { likes = 0, comments = 0, views = 0 } = metrics
  if (views === 0) return 0

  const engagementRate = ((likes + comments * 2) / views) * 100

  let score = Math.min(100, Math.round(engagementRate * 10))

  if (views > 100000) score = Math.min(100, score + 10)
  if (comments > 1000) score = Math.min(100, score + 5)

  return Math.max(0, Math.min(100, score))
}
