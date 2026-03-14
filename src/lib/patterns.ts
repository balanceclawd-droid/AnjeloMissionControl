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

export interface PostClassification {
  hook_type: string | null
  hook_text: string | null
  structure: string | null
  cta_type: string | null
  visual_type: string | null
  visual_description: string | null
  flagged_as_pattern: boolean
}

const HOOK_TYPES = [
  'partnership_signal',
  'launch_update',
  'proof_of_results',
  'hot_take',
  'speculative_alpha',
  'identity_signal',
  'educational_breakdown',
  'community_bait',
  'meme_humor',
  'bold_claim',
  'statement',
] as const

const STRUCTURE_TYPES = [
  'thread',
  'listicle',
  'media-only',
  'one-liner',
  'educational',
  'storytelling',
  'short-form',
] as const

const CTA_TYPES = ['engagement', 'conversion', 'follow', 'link_click', 'none'] as const
const VISUAL_TYPES = ['video', 'image', 'carousel', 'media_hint', 'text_only'] as const

// Read LLM config at call time (not module load) so Vercel picks up env vars correctly
function getLlmConfig() {
  return {
    baseUrl: process.env.LLM_CLASSIFIER_BASE_URL?.trim(),
    apiKey: process.env.LLM_CLASSIFIER_API_KEY?.trim(),
    model: process.env.LLM_CLASSIFIER_MODEL?.trim(),
    timeoutMs: Number(process.env.LLM_CLASSIFIER_TIMEOUT_MS || 12000),
  }
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ')
}

function buildPatternDescription(input: {
  niche: string
  hook_type: string
  structure: string
  cta_type: string
  competitorCount: number
  avgScore: number
}) {
  const { niche, hook_type, structure, cta_type, competitorCount, avgScore } = input
  const hook = formatLabel(hook_type)
  const structureLabel = formatLabel(structure)
  const cta = formatLabel(cta_type)

  if (hook_type === 'community_bait') {
    return `${competitorCount} ${niche} competitors are using conversation-bait ${structureLabel} posts to trigger ${cta}. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'proof_of_results') {
    return `${competitorCount} ${niche} competitors are leaning on proof/results-led ${structureLabel} posts. These signal traction and average ${Math.round(avgScore)} engagement.`
  }
  if (hook_type === 'launch_update') {
    return `${competitorCount} ${niche} competitors are using launch/update style ${structureLabel} posts to push ${cta}. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'bold_claim' || hook_type === 'hot_take') {
    return `${competitorCount} ${niche} competitors are using opinionated ${structureLabel} posts to push ${cta}. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'identity_signal') {
    return `${competitorCount} ${niche} competitors are using identity/status signalling in ${structureLabel} posts. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'educational_breakdown') {
    return `${competitorCount} ${niche} competitors are using educational ${structureLabel} posts to drive ${cta}. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'speculative_alpha') {
    return `${competitorCount} ${niche} competitors are using alpha/speculation hooks in ${structureLabel} posts. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'partnership_signal') {
    return `${competitorCount} ${niche} competitors are using partnership/credibility signals in ${structureLabel} posts. Avg engagement score: ${Math.round(avgScore)}.`
  }
  if (hook_type === 'meme_humor') {
    return `${competitorCount} ${niche} competitors are using humor/meme framing in ${structureLabel} posts. Avg engagement score: ${Math.round(avgScore)}.`
  }

  return `${competitorCount} ${niche} competitors are repeating a ${hook} + ${structureLabel} + ${cta} pattern. Avg engagement score: ${Math.round(avgScore)}.`
}

function isActionablePattern(input: {
  hook_type: string
  structure: string
  cta_type: string
  competitorCount: number
  avgScore: number
  postCount: number
}) {
  const { hook_type, structure, cta_type, competitorCount, avgScore, postCount } = input

  if (competitorCount < 2 || postCount < 2) return false
  if (cta_type === 'none' && avgScore < 60) return false
  if (hook_type === 'statement' && avgScore < 55) return false
  if (hook_type === 'statement' && structure === 'short-form' && cta_type === 'link_click' && avgScore < 75) return false
  if (hook_type === 'statement' && structure === 'short-form' && cta_type === 'none') return false
  if (hook_type === 'community_bait' && avgScore < 50) return false
  if (hook_type === 'proof_of_results' && avgScore < 45) return false
  if (hook_type === 'launch_update' && competitorCount < 2) return false
  if (hook_type === 'meme_humor' && avgScore < 55) return false

  return true
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
  if (/\b(partner|partnership|teaming up|working with|collab|collaboration|powered by|with @)\b/i.test(lower)) return 'partnership_signal'
  if (/\b(breaking|just in|live now|launching|now live|introduced|announcing|rolled out|shipping|released|release)\b/i.test(text)) return 'launch_update'
  if (/\b(case study|results|grew|growth|revenue|followers|users|signups|volume|proof|receipts|milestone|hit \d|crossed \d|top players)\b/i.test(lower)) return 'proof_of_results'
  if (/\b(hot take|unpopular opinion|controversial|everyone is wrong|stop|nobody talks about|the truth about)\b/i.test(lower)) return 'hot_take'
  if (/\b(alpha|edge|secret|cheat code|early|before everyone|signal|playbook|market is sleeping|underrated)\b/i.test(lower)) return 'speculative_alpha'
  if (/\b(we are|we're|i am|i'm|built different|for the builders|for traders|for gamers|real ones|if you know you know)\b/i.test(lower)) return 'identity_signal'
  if (/\b(why|how|what if|reason #?\d+|here'?s how|step by step|breakdown|explainer|guide)\b/i.test(lower)) return 'educational_breakdown'
  if (/\b(reply|comment|what do you think|thoughts\??|agree\??|who else|which one|pick one)\b/i.test(lower) || text.includes('?')) return 'community_bait'
  if (/\b(meme|lol|lmao|😂|😭|bro|nah|imagine)\b/i.test(lower)) return 'meme_humor'
  if (/\b(win|dominate|faster|better|best|never|always|everybody|no one)\b/i.test(lower)) return 'bold_claim'
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

function buildHeuristicClassification(input: {
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
  const highSignal =
    (input.engagement_score || 0) >= 70 ||
    (input.bookmark_count || 0) >= 20 ||
    (input.quote_count || 0) >= 10 ||
    (input.conversation_depth || 0) >= 25

  return {
    hook_type,
    hook_text,
    structure,
    cta_type,
    visual_type,
    visual_description: visual_type === 'media_hint' ? 'Likely link-led media post inferred from tweet shape' : null,
    flagged_as_pattern: Boolean(highSignal && hook_type && structure && cta_type && cta_type !== 'none'),
  } satisfies PostClassification
}

function hasLlmClassifierConfig() {
  const { baseUrl, apiKey, model } = getLlmConfig()
  return Boolean(baseUrl && apiKey && model)
}

function extractJsonObject(text: string) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] || trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const firstBrace = candidate.indexOf('{')
    const lastBrace = candidate.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('LLM response was not valid JSON')
  }
}

function pickEnumValue<T extends readonly string[]>(value: unknown, allowed: T): T[number] | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '_')
  return (allowed.find((item) => item.toLowerCase() === normalized) || null) as T[number] | null
}

function sanitizeLlmClassification(payload: any, fallback: PostClassification): PostClassification {
  const hook_type = pickEnumValue(payload?.hook_type, HOOK_TYPES) || fallback.hook_type
  const structure = pickEnumValue(payload?.structure, STRUCTURE_TYPES) || fallback.structure
  const cta_type = pickEnumValue(payload?.cta_type, CTA_TYPES) || fallback.cta_type
  const visual_type = pickEnumValue(payload?.visual_type, VISUAL_TYPES) || fallback.visual_type
  const hook_text = typeof payload?.hook_text === 'string' ? payload.hook_text.trim().slice(0, 140) : fallback.hook_text
  const visual_description = typeof payload?.visual_description === 'string'
    ? payload.visual_description.trim().slice(0, 180) || null
    : fallback.visual_description

  const flagged_as_pattern = typeof payload?.flagged_as_pattern === 'boolean'
    ? payload.flagged_as_pattern
    : fallback.flagged_as_pattern

  return {
    hook_type,
    hook_text,
    structure,
    cta_type,
    visual_type,
    visual_description,
    flagged_as_pattern,
  }
}

async function fetchLlmClassification(input: {
  content?: string | null
  engagement_score?: number | null
  bookmark_count?: number | null
  quote_count?: number | null
  conversation_depth?: number | null
}) {
  if (!hasLlmClassifierConfig()) return null

  const { baseUrl, apiKey, model: llmModel, timeoutMs } = getLlmConfig()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: llmModel,
        temperature: 0.1,
        messages: [
          {
            role: 'system',
            content:
              'You classify competitive social posts into a strict taxonomy for marketing analytics. Return JSON only. Choose only from the provided enums. Do not explain your answer.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              task: 'Classify this competitive social post',
              enums: {
                hook_type: HOOK_TYPES,
                structure: STRUCTURE_TYPES,
                cta_type: CTA_TYPES,
                visual_type: VISUAL_TYPES,
              },
              required_output_shape: {
                hook_type: 'enum',
                hook_text: 'string|null',
                structure: 'enum',
                cta_type: 'enum',
                visual_type: 'enum',
                visual_description: 'string|null',
                flagged_as_pattern: 'boolean',
              },
              guidance: [
                'Infer likely visuals from the copy only; do not hallucinate specific assets unless hinted.',
                'flagged_as_pattern should be true only if the post is a strong, replicable format rather than a generic update.',
                'hook_text should be the shortest meaningful opening hook.',
              ],
              post: {
                content: input.content || '',
                engagement_score: input.engagement_score || 0,
                bookmark_count: input.bookmark_count || 0,
                quote_count: input.quote_count || 0,
                conversation_depth: input.conversation_depth || 0,
              },
            }),
          },
        ],
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`LLM classifier error (${response.status}): ${text}`)
    }

    const data = await response.json()
    const rawContent = data?.choices?.[0]?.message?.content
    const content = Array.isArray(rawContent)
      ? rawContent.map((part: any) => part?.text || '').join('')
      : rawContent

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('LLM classifier returned empty content')
    }

    return extractJsonObject(content)
  } finally {
    clearTimeout(timeout)
  }
}

export function classifyCompetitivePost(input: {
  content?: string | null
  engagement_score?: number | null
  bookmark_count?: number | null
  quote_count?: number | null
  conversation_depth?: number | null
}) {
  return buildHeuristicClassification(input)
}

export async function classifyCompetitivePostWithFallback(input: {
  content?: string | null
  engagement_score?: number | null
  bookmark_count?: number | null
  quote_count?: number | null
  conversation_depth?: number | null
}) {
  const heuristic = buildHeuristicClassification(input)

  if (!hasLlmClassifierConfig()) {
    return { ...heuristic, classifier_source: 'heuristic', classifier_error: null }
  }

  try {
    const llmPayload = await fetchLlmClassification(input)
    const merged = sanitizeLlmClassification(llmPayload, heuristic)
    return { ...merged, classifier_source: 'llm', classifier_error: null }
  } catch (error: any) {
    console.error('[Patterns] LLM classification failed, falling back to heuristics:', error?.message || error)
    return { ...heuristic, classifier_source: 'heuristic_fallback', classifier_error: error?.message || 'Unknown LLM classification error' }
  }
}

export async function backfillPostClassifications(options?: {
  limit?: number
  force?: boolean
  competitorId?: number
}) {
  const force = Boolean(options?.force)
  let query = supabase
    .from('competitive_posts')
    .select('id, competitor_id, content, engagement_score, bookmark_count, quote_count, conversation_depth, hook_type, hook_text, structure, cta_type, visual_type, visual_description, flagged_as_pattern')
    .order('posted_at', { ascending: false })
    .limit(options?.limit || 500)

  if (options?.competitorId != null) {
    query = query.eq('competitor_id', options.competitorId)
  }

  if (!force) {
    query = query.or('hook_type.is.null,structure.is.null,cta_type.is.null,visual_type.is.null')
  }

  const { data: posts, error } = await query
  if (error) throw error

  let updated = 0
  let llmClassified = 0
  let heuristicClassified = 0
  const errors: string[] = []

  for (const post of posts || []) {
    const classified = await classifyCompetitivePostWithFallback(post as any)
    const nextPayload = {
      hook_type: classified.hook_type,
      hook_text: classified.hook_text,
      structure: classified.structure,
      cta_type: classified.cta_type,
      visual_type: classified.visual_type,
      visual_description: classified.visual_description,
      flagged_as_pattern: Boolean(classified.flagged_as_pattern),
    }

    const changed =
      post.hook_type !== nextPayload.hook_type ||
      post.hook_text !== nextPayload.hook_text ||
      post.structure !== nextPayload.structure ||
      post.cta_type !== nextPayload.cta_type ||
      post.visual_type !== nextPayload.visual_type ||
      post.visual_description !== nextPayload.visual_description ||
      Boolean(post.flagged_as_pattern) !== nextPayload.flagged_as_pattern

    if (!changed && force === false) continue

    const { error: updateError } = await supabase
      .from('competitive_posts')
      .update(nextPayload)
      .eq('id', post.id)

    if (updateError) {
      errors.push(`Post ${post.id}: ${updateError.message}`)
      continue
    }

    // Capture LLM errors for debugging
    if (classified.classifier_source === 'heuristic_fallback' && classified.classifier_error) {
      errors.push(`LLM fallback on post ${post.id}: ${classified.classifier_error}`)
    }

    updated++
    if (classified.classifier_source === 'llm') llmClassified++
    else heuristicClassified++
  }

  return {
    scanned: posts?.length || 0,
    updated,
    llmClassified,
    heuristicClassified,
    errors,
  }
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

function verticalMatchesNiche(vertical: string, niche: string) {
  const v = (vertical || '').toLowerCase()
  const n = (niche || '').toLowerCase()

  if (!v || !n) return false
  if (v === 'other') return true
  if (v === 'trading_platform' || v === 'ai_trading' || v === 'cex') return ['cex', 'dex', 'defi', 'trading', 'exchange'].some(token => n.includes(token))
  if (v === 'defi') return ['dex', 'defi', 'amm', 'swap'].some(token => n.includes(token))
  if (v === 'gaming_web3') return ['gaming', 'gamefi', 'web3', 'nft'].some(token => n.includes(token))
  if (v === 'nft') return ['nft', 'web3', 'gaming'].some(token => n.includes(token))
  if (v === 'social') return ['social', 'creator', 'community'].some(token => n.includes(token))
  return n.includes(v)
}

function buildReplicationTactic(pattern: any) {
  const steps: string[] = []

  if (pattern.hook_type === 'proof_of_results') {
    steps.push('Lead with a concrete outcome, milestone, or proof point in the first line')
  } else if (pattern.hook_type === 'community_bait') {
    steps.push('Open with a sharp question or polarising choice that invites replies')
  } else if (pattern.hook_type === 'educational_breakdown') {
    steps.push('Turn the post into a teachable breakdown with one clear takeaway per section')
  } else if (pattern.hook_type === 'launch_update') {
    steps.push('Frame the update around what is newly available right now and who it helps')
  } else if (pattern.hook_type === 'hot_take' || pattern.hook_type === 'bold_claim') {
    steps.push('Use a strong opinionated opener, then support it with one proof point')
  } else {
    steps.push(`Test a ${formatLabel(pattern.hook_type)} opening line instead of a generic announcement`)
  }

  if (pattern.structure === 'thread') {
    steps.push('Expand it into a short thread with a punchy first post and 3-5 supporting beats')
  } else if (pattern.structure === 'listicle') {
    steps.push('Package it as a numbered list so readers instantly understand the value')
  } else if (pattern.structure === 'storytelling') {
    steps.push('Wrap the message in a mini story or POV moment rather than feature copy')
  } else if (pattern.structure === 'educational') {
    steps.push('Use a teaching format with simple examples instead of abstract claims')
  } else {
    steps.push(`Keep the format ${formatLabel(pattern.structure)} so it stays lightweight to test`)
  }

  if (pattern.cta_type === 'engagement') {
    steps.push('End with one reply-driving prompt to increase discussion and distribution')
  } else if (pattern.cta_type === 'conversion') {
    steps.push('Close with one direct action: apply, sign up, join, or get access')
  } else if (pattern.cta_type === 'link_click') {
    steps.push('Attach a link only after the main hook has earned attention')
  } else if (pattern.cta_type === 'follow') {
    steps.push('Use the CTA to grow the audience if the content is part of a wider series')
  }

  return steps.slice(0, 3)
}

export async function getClientReplicationRecommendations() {
  const [{ data: clients, error: clientsError }, { data: patterns, error: patternsError }] = await Promise.all([
    supabase.from('clients').select('*').eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('patterns').select('*').in('status', ['emerging', 'active']).order('avg_engagement_score', { ascending: false }).limit(30),
  ])

  if (clientsError) throw clientsError
  if (patternsError) throw patternsError

  const recommendations = (clients || []).map((client: any) => {
    const matchedPatterns = (patterns || [])
      .filter((pattern: any) => verticalMatchesNiche(client.vertical, pattern.niche))
      .sort((a: any, b: any) => {
        const statusScore = (value: string) => (value === 'active' ? 2 : value === 'emerging' ? 1 : 0)
        return statusScore(b.status) - statusScore(a.status) || (b.avg_engagement_score || 0) - (a.avg_engagement_score || 0)
      })
      .slice(0, 3)

    return {
      client_id: client.id,
      client_name: client.name,
      client_vertical: client.vertical,
      recommendations: matchedPatterns.map((pattern: any) => ({
        pattern_id: pattern.id,
        niche: pattern.niche,
        status: pattern.status,
        title: `${formatLabel(pattern.hook_type)} + ${formatLabel(pattern.structure)}`,
        why_it_matters: pattern.pattern_description,
        replicate_steps: buildReplicationTactic(pattern),
        suggested_cta: formatLabel(pattern.cta_type),
        avg_engagement_score: pattern.avg_engagement_score,
        competitor_count: pattern.competitor_count,
      })),
    }
  })

  const clientsWithSuggestions = recommendations.filter((item) => item.recommendations.length > 0)

  return {
    overview: {
      active_clients: clients?.length || 0,
      matched_clients: clientsWithSuggestions.length,
      active_pattern_pool: patterns?.length || 0,
      llm_enabled: hasLlmClassifierConfig(),
      generated_at: new Date().toISOString(),
    },
    recommendations,
  }
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

    if (!isActionablePattern({
      hook_type,
      structure,
      cta_type,
      competitorCount: competitorIds.length,
      avgScore: highSignalPosts.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / Math.max(highSignalPosts.length, 1),
      postCount: highSignalPosts.length,
    })) continue

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
    const desc = buildPatternDescription({
      niche,
      hook_type,
      structure,
      cta_type,
      competitorCount: competitorIds.length,
      avgScore,
    })

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
      if (avgScore >= 60 || competitorIds.length >= 3) severity = 'medium'
      if (competitorIds.length >= 4 || avgScore >= 80) severity = 'high'

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
