import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Normalise engagement score 0-100 relative to batch max
function normaliseScores(tweets: any[]): any[] {
  const maxEng = Math.max(...tweets.map(t => t.engagement || 0), 1)
  return tweets.map(t => ({
    ...t,
    engagement_score: Math.round(((t.engagement || 0) / maxEng) * 100),
  }))
}

export async function POST(req: NextRequest) {
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Expected an array of tweet objects' }, { status: 400 })
  }

  if (body.length === 0) {
    return NextResponse.json({ inserted: 0, suggestions: 0 })
  }

  // Enrich each tweet with normalised score
  const enriched = normaliseScores(body)

  // Build rows for insertion
  const rows = enriched.map((t: any) => {
    // _source format: "query:keyword_used" or "account:@handle"
    const source = t._source || ''
    const keyword = source.startsWith('query:') ? source.slice(6) : null

    return {
      handle: (t.handle || '').toLowerCase(),
      display_name: t.display_name || '',
      content: t.tweet_text || t.content || '',
      tweet_url: t.tweet_url || '',
      likes: t.likes || 0,
      retweets: t.retweets || 0,
      replies: t.replies || 0,
      views: t.views || 0,
      engagement_score: t.engagement_score,
      scraped_at: t.timestamp || new Date().toISOString(),
      source: keyword || source,
    }
  }).filter(r => r.content && r.handle)

  // Try to match keyword_id based on source keyword text
  const { data: keywords } = await supabase.from('research_keywords').select('id, keyword')
  const keywordMap = new Map((keywords || []).map((k: any) => [k.keyword.toLowerCase(), k.id]))

  const rowsWithKeyword = rows.map(r => ({
    ...r,
    keyword_id: keywordMap.get(r.source.toLowerCase()) || null,
  }))

  // Upsert — conflict on tweet_url (skip if empty url)
  const withUrl = rowsWithKeyword.filter(r => r.tweet_url)
  const withoutUrl = rowsWithKeyword.filter(r => !r.tweet_url)

  let inserted = 0
  if (withUrl.length > 0) {
    const { data: upserted, error } = await supabase
      .from('market_intelligence_posts')
      .upsert(withUrl, { onConflict: 'tweet_url', ignoreDuplicates: true })
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    inserted += upserted?.length || 0
  }
  if (withoutUrl.length > 0) {
    const { data: inserted2, error } = await supabase
      .from('market_intelligence_posts')
      .insert(withoutUrl)
      .select('id')
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted += inserted2?.length || 0
  }

  // Detect high-engagement accounts not already in competitors table
  const highEngagement = enriched.filter(t => t.engagement_score >= 60)
  const uniqueHandles = [...new Set(highEngagement.map(t => (t.handle || '').toLowerCase()))].filter(Boolean)

  let suggestionsCreated = 0

  if (uniqueHandles.length > 0) {
    // Check existing competitors
    const { data: existingComp } = await supabase
      .from('competitors')
      .select('account_url')

    const existingHandles = new Set(
      (existingComp || []).map((c: any) => {
        const url = c.account_url || ''
        const match = url.match(/\/@?([A-Za-z0-9_]+)\/?$/)
        return match ? match[1].toLowerCase() : ''
      }).filter(Boolean)
    )

    // Check existing suggestions
    const { data: existingSugg } = await supabase
      .from('competitor_suggestions')
      .select('handle')
      .in('handle', uniqueHandles)

    const existingSuggHandles = new Set((existingSugg || []).map((s: any) => s.handle.toLowerCase()))

    // Determine niche from source keyword → keywords table
    // Group tweets by handle to calculate avg engagement and pick sample post
    const handleGroups: Record<string, any[]> = {}
    for (const t of enriched) {
      const h = (t.handle || '').toLowerCase()
      if (!handleGroups[h]) handleGroups[h] = []
      handleGroups[h].push(t)
    }

    const suggestions = []
    for (const handle of uniqueHandles) {
      if (existingHandles.has(handle) || existingSuggHandles.has(handle)) continue

      const tweets = handleGroups[handle] || []
      const avgEng = Math.round(tweets.reduce((s: number, t: any) => s + t.engagement_score, 0) / Math.max(tweets.length, 1))
      if (avgEng < 60) continue

      const best = tweets.sort((a: any, b: any) => b.engagement_score - a.engagement_score)[0]

      // Infer niche from the keyword source
      const sourceKeyword = (best._source || '').startsWith('query:') ? best._source.slice(6).toLowerCase() : ''
      const { data: matchedKw } = await supabase
        .from('research_keywords')
        .select('niche')
        .ilike('keyword', `%${sourceKeyword}%`)
        .limit(1)
        .single()

      suggestions.push({
        handle,
        display_name: best.display_name || handle,
        niche: matchedKw?.niche || 'Other',
        avg_engagement: avgEng,
        sample_post: (best.tweet_text || best.content || '').slice(0, 280),
        tweet_url: best.tweet_url || '',
        status: 'pending',
        suggested_at: new Date().toISOString(),
      })
    }

    if (suggestions.length > 0) {
      const { error: suggErr } = await supabase
        .from('competitor_suggestions')
        .upsert(suggestions, { onConflict: 'handle', ignoreDuplicates: true })
      if (!suggErr) suggestionsCreated = suggestions.length
    }
  }

  return NextResponse.json({ inserted, suggestions: suggestionsCreated })
}
