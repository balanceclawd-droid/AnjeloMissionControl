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

interface PostClassification {
  hook_type: string | null
  hook_text: string | null
  structure: string | null
  cta_type: string | null
  visual_type: string | null
  visual_description: string | null
  flagged_as_pattern: boolean
}

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim()
}

function getHookText(content: string) {
  const normalized = normalizeWhitespace(content)
  if (!normalized) return null

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0]
  return firstSentence.slice(0, 140) || normalized.slice(0, 140)
}

function inferHookType(content: string) {
  const text = normalizeWhitespace(content)
  const lower = text.toLowerCase()

  if (!text) return null
  if (text.includes('?')) return 'question'
  if (/\b(breaking|just in|live now|launching|now live|introduced|announcing)\b/i.test(text)) return 'announcement'
  if (/\b(why|how|what if|most people|nobody talks about|the truth about|reason #?\d+)\b/i.test(text)) return 'curiosity_gap'
  if (/\b($\d|\d+[%x]|\d+[kmb]? users|\d+[kmb]? views|million|billion|top players|case study|proof)\b/i.test(lower)) return 'social_proof'
  if (/\b(we are|we're|i am|i'm|built different|for the builders|for traders|for gamers|real ones)\b/i.test(lower)) return 'identity'
  if (/\b(partner|collab|teaming up|working with|with @)\b/i.test(lower)) return 'collaboration'
  if (/\b(read this|thread|🧵|1\/|1\)|here's)\b/i.test(lower)) return 'thread'
  if (/\b(alpha|edge|win|secret|cheat code|unlock|dominate|faster|better)\b/i.test(lower)) return 'bold_claim'
  return 'statement'
}

function inferStructure(content: string) {
  const text = normalizeWhitespace(content)
  const lower = text.toLowerCase()
  const lineCount = content.split('\n').filter(Boolean).length

  if (!text) return null
  if (/\bthread\b|🧵|\n\d+[.)]|\b1\//i.test(content)) return 'thread'
  if (/\b\d+ reasons\b|\btop \d+\b|\b\d+ ways\b|\b\d+ things\b|\breason #?\d+\b/i.test(lower)) return 'listicle'
  if (text.length < 60 && /https?:\/\//i.test(text)) return 'media-only'
  if (text.length < 90 && lineCount <= 2) return 'one-liner'
  if (/\bstep\b|\bguide\b|\bhow to\b|\bbreakdown\b|\bexplainer\b/i.test(lower)) return 'educational'
  if (/\bstory\b|\bpov\b|\bthis happened\b|\bwhen we\b|\bjourney\b/i.test(lower)) return 'storytelling'
  return 'short-form'
}

function inferCtaType(content: string) {
  const lower = normalizeWhitespace(content).toLowerCase()

  if (!lower) return null
  if (/\b(reply|comment|tell me|what do you think|thoughts\??|agree\??)\b/i.test(lower)) return 'engagement'
  if (/\b(join|sign up|get access|apply|waitlist|mint|start now|play now)\b/i.test(lower)) return 'conversion'
  if (/\bfollow\b|\bturn on notifications\b|\bstay tuned\b/i.test(lower)) return 'follow'
  if (/https?:\/\//i.test(lower)) return 'link_click'
  return 'none'
}

function inferVisualType(content: string) {
  const lower = normalizeWhitespace(content).toLowerCase()

  if (/\b(video|clip|watch|trailer|demo)\b/i.test(lower)) return 'video'
  if (/\b(image|graphic|screenshot|chart|photo|art)\b/i.test(lower)) return 'image'
  if (/\bcarousel|slides\b/i.test(lower)) return 'carousel'
  if (/https?:\/\//i.test(lower) && lower.length < 70) return 'media_hint'
  return 'text_only'
}

export function classifyCompetitivePost(input: {
  content?: string | null
  engagement_score?: number | null
  bookmark_count?: number | null
  quote_count?: number | null
  conversation_depth?: number | null
}) {
  const content = input.content || ''
  const hook_type = inferHookType(content)
  const structure = inferStructure(content)
  const cta_type = inferCtaType(content)
  const visual_type = inferVisualType(content)
  const hook_text = getHookText(content)
  const highSignal = (input.engagement_score || 0) >= 70 || (input.bookmark_count || 0) >= 20 || (input.quote_count || 0) >= 10 || (input.conversation_depth || 0) >= 25

  const classification: PostClassification = {
    hook_type,
    hook_text,
    structure,
    cta_type,
    visual_type,
    visual_description: visual_type === 'media_hint' ? 'Likely link-led media post inferred from tweet shape' : null,
    flagged_as_pattern: Boolean(highSignal && hook_type && structure && cta_type && cta_type !== 'none'),
  }

  return classification
}

export async function backfillPostClassifications() {
  const { data: posts, error } = await supabase
    .from('competitive_posts')
    .select('id, content, engagement_score, bookmark_count, quote_count, conversation_depth, hook_type, hook_text, structure, cta_type, visual_type, visual_description, flagged_as_pattern')
    .order('posted_at', { ascending: false })
    .limit(500)

  if (error) throw error

  let updated = 0

  for (const post of posts || []) {
    const inferred = classifyCompetitivePost(post as any)
    const nextPayload = {
      hook_type: post.hook_type || inferred.hook_type,
      hook_text: post.hook_text || inferred.hook_text,
      structure: post.structure || inferred.structure,
      cta_type: post.cta_type || inferred.cta_type,
      visual_type: post.visual_type || inferred.visual_type,
      visual_description: post.visual_description || inferred.visual_description,
      flagged_as_pattern: Boolean(post.flagged_as_pattern || inferred.flagged_as_pattern),
    }

    const changed =
      post.hook_type !== nextPayload.hook_type ||
      post.hook_text !== nextPayload.hook_text ||
      post.structure !== nextPayload.structure ||
      post.cta_type !== nextPayload.cta_type ||
      post.visual_type !== nextPayload.visual_type ||
      post.visual_description !== nextPayload.visual_description ||
      Boolean(post.flagged_as_pattern) !== nextPayload.flagged_as_pattern

    if (!changed) continue

    const { error: updateError } = await supabase
      .from('competitive_posts')
      .update(nextPayload)
      .eq('id', post.id)

    if (!updateError) updated++
  }

  return { scanned: posts?.length || 0, updated }
}

export async function sanitizePatternPostIds(patternId?: number) {
  let query = supabase.from('patterns').select('id, post_ids')
  if (patternId != null) query = query.eq('id', patternId)

  const { data: patterns, error } = await query
  if (error) throw error

  if (!patterns?.length) return []

  const allPostIds = Array.from(
    new Set(
      patterns.flatMap((pattern: any) =>
        Array.isArray(pattern.post_ids)
          ? pattern.post_ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id))
          : []
      )
    )
  )

  const validPostIds = new Set<number>()
  if (allPostIds.length > 0) {
    const { data: posts, error: postsError } = await supabase
      .from('competitive_posts')
      .select('id')
      .in('id', allPostIds)

    if (postsError) throw postsError
    for (const post of posts || []) validPostIds.add(Number((post as any).id))
  }

  const updatedPatterns = []
  for (const pattern of patterns as any[]) {
    const originalIds = Array.isArray(pattern.post_ids)
      ? pattern.post_ids.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id))
      : []
    const sanitizedIds = originalIds.filter((id: number) => validPostIds.has(id))

    if (JSON.stringify(originalIds) !== JSON.stringify(sanitizedIds)) {
      const { error: updateError } = await supabase
        .from('patterns')
        .update({ post_ids: sanitizedIds })
        .eq('id', pattern.id)

      if (updateError) throw updateError
      updatedPatterns.push({ ...pattern, post_ids: sanitizedIds })
    } else {
      updatedPatterns.push(pattern)
    }
  }

  return updatedPatterns
}

export async function detectPatterns() {
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

  const groups: Record<string, Post[]> = {}
  for (const post of posts) {
    const key = `${post.niche || 'Unknown'}|${post.hook_type}|${post.structure}|${post.cta_type}`
    if (!groups[key]) groups[key] = []
    groups[key].push(post)
  }

  const { data: existingPatterns } = await supabase.from('patterns').select('*')
  const existingMap = new Map<string, any>()
  for (const pattern of existingPatterns || []) {
    existingMap.set(`${pattern.niche}|${pattern.hook_type}|${pattern.structure}|${pattern.cta_type}`, pattern)
  }

  const seenKeys = new Set<string>()
  const newAlerts: Array<{ alert_type: string; pattern_id: number | null; niche: string; severity: string; message: string }> = []

  for (const [key, groupPosts] of Object.entries(groups)) {
    const [niche, hook_type, structure, cta_type] = key.split('|')
    const competitorIds = [...new Set(groupPosts.map(p => p.competitor_id))]
    const highSignalPosts = groupPosts.filter(p => (p.engagement_score || 0) >= 45)

    if (competitorIds.length < 2 || highSignalPosts.length < 2) continue

    seenKeys.add(key)

    const sortedPosts = [...highSignalPosts].sort((a, b) => b.engagement_score - a.engagement_score)
    const postIds = sortedPosts.slice(0, 8).map(p => p.id)
    const avgScore = sortedPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / sortedPosts.length

    const now = new Date().toISOString()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const recentPosts = sortedPosts.filter(p => p.posted_at >= sevenDaysAgo)

    let status = 'emerging'
    if (recentPosts.length >= 4) status = 'active'
    else if (recentPosts.length === 0) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const monthPosts = sortedPosts.filter(p => p.posted_at >= thirtyDaysAgo)
      status = monthPosts.length > 0 ? 'declining' : 'dormant'
    }

    const existing = existingMap.get(key)
    const desc = `${competitorIds.length} ${niche} competitors using ${hook_type} hooks with ${structure} structure and ${cta_type} CTA` +
      ` (avg score ${Math.round(avgScore)})`

    if (existing) {
      await supabase
        .from('patterns')
        .update({
          post_ids: postIds,
          last_seen: now,
          competitor_count: competitorIds.length,
          avg_engagement_score: Math.round(avgScore),
          pattern_description: desc,
          status,
        })
        .eq('id', existing.id)
    } else {
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
          avg_engagement_score: Math.round(avgScore),
          status,
        })
        .select()
        .single()

      const patternId = newPattern?.id || null
      let severity = 'low'
      if (avgScore >= 60) severity = 'medium'
      if (competitorIds.length >= 3 || avgScore >= 80) severity = 'high'

      newAlerts.push({
        alert_type: 'pattern_emerging',
        pattern_id: patternId,
        niche,
        severity,
        message: `New pattern detected: ${hook_type} + ${structure} + ${cta_type} in ${niche}. ${competitorIds.length} competitors, avg score ${Math.round(avgScore)}`,
      })
    }

    if (recentPosts.length >= 4 && existing) {
      newAlerts.push({
        alert_type: 'pattern_accelerating',
        pattern_id: existing.id,
        niche,
        severity: 'high',
        message: `Pattern accelerating: ${hook_type} + ${structure} in ${niche} has ${recentPosts.length} recent high-signal posts`,
      })
    }
  }

  for (const pattern of existingPatterns || []) {
    const key = `${pattern.niche}|${pattern.hook_type}|${pattern.structure}|${pattern.cta_type}`
    if (seenKeys.has(key)) continue

    await supabase
      .from('patterns')
      .update({ status: 'dormant', post_ids: [] })
      .eq('id', pattern.id)
  }

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

  return { patternsProcessed: Object.keys(groups).length, patternsDetected: seenKeys.size, alertsGenerated: newAlerts.length }
}

export function calculateEngagementScore(metrics: { likes?: number; comments?: number; views?: number }) {
  const { likes = 0, comments = 0, views = 0 } = metrics
  if (views === 0) return 0

  const engagementRate = ((likes + comments * 2) / views) * 100

  let score = Math.min(100, Math.round(engagementRate * 10))

  if (views > 100000) score = Math.min(100, score + 10)
  if (comments > 1000) score = Math.min(100, score + 5)

  return Math.max(0, Math.min(100, score))
}
