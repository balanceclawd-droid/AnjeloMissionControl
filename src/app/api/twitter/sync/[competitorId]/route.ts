import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { classifyCompetitivePostWithFallback } from '@/lib/patterns'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const RAPIDAPI_HOST = process.env.RAPIDAPI_TWITTER_HOST || 'twitter241.p.rapidapi.com'

async function twitterFetch(endpoint: string) {
  const res = await fetch(`https://${RAPIDAPI_HOST}${endpoint}`, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY!,
      'x-rapidapi-host': RAPIDAPI_HOST,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twitter API error (${res.status}): ${text}`)
  }
  return res.json()
}

function extractUsername(competitor: { account_url: string | null; name: string }): string {
  if (competitor.account_url) {
    const match = competitor.account_url.match(/(?:twitter\.com|x\.com)\/([^/?]+)/)
    if (match) return match[1]
  }
  return competitor.name.replace(/^@/, '')
}

function calculateEngagementScores(tweets: { likes: number; retweets: number; replies: number; bookmarks: number; quotes: number }[]): number[] {
  if (tweets.length === 0) return []
  const rawScores = tweets.map(t => t.likes * 2 + t.retweets * 3 + t.replies * 1 + t.bookmarks * 4 + t.quotes * 2)
  const maxRaw = Math.max(...rawScores)
  if (maxRaw === 0) return rawScores.map(() => 0)
  return rawScores.map(s => Math.min(100, Math.round((s / maxRaw) * 100)))
}

function extractTweetEntries(tweetsData: any) {
  const instructions = tweetsData?.result?.timeline?.instructions || []
  const items = instructions.flatMap((instruction: any) => {
    if (Array.isArray(instruction.entries)) return instruction.entries
    if (instruction.entry) return [instruction.entry]
    return []
  })

  return items.filter(
    (entry: any) => entry.content?.entryType === 'TimelineTimelineItem' &&
      entry.content?.itemContent?.__typename === 'TimelineTweet'
  )
}

async function saveCompetitivePost(post: any) {
  const { data: existing, error: selectError } = await supabase
    .from('competitive_posts')
    .select('id')
    .eq('competitor_id', post.competitor_id)
    .eq('twitter_post_id', post.twitter_post_id)
    .maybeSingle()

  if (selectError) return { error: selectError }

  if (existing?.id) {
    return supabase
      .from('competitive_posts')
      .update(post)
      .eq('id', existing.id)
  }

  return supabase
    .from('competitive_posts')
    .insert(post)
}

export async function POST(_req: NextRequest, { params }: { params: { competitorId: string } }) {
  try {
    if (!RAPIDAPI_KEY) {
      return NextResponse.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 })
    }

    const { data: competitor, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', params.competitorId)
      .single()

    if (compError || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    const username = extractUsername(competitor)
    const userData = await twitterFetch(`/user?username=${encodeURIComponent(username)}`)
    const userId = userData?.result?.data?.user?.result?.rest_id
    if (!userId) {
      return NextResponse.json({ error: `Could not find Twitter user: @${username}` }, { status: 404 })
    }

    const tweetsData = await twitterFetch(`/user-tweets?user=${userId}&count=20`)
    const tweetEntries = extractTweetEntries(tweetsData)

    const tweets = tweetEntries.map((entry: any) => {
      const legacy = entry.content?.itemContent?.tweet_results?.result?.legacy
      if (!legacy) return null
      return {
        id_str: legacy.id_str,
        full_text: legacy.full_text,
        created_at: legacy.created_at,
        likes: legacy.favorite_count || 0,
        retweets: legacy.retweet_count || 0,
        replies: legacy.reply_count || 0,
        bookmarks: legacy.bookmark_count || 0,
        quotes: legacy.quote_count || 0,
      }
    }).filter((t: any) => t && t.id_str && t.full_text)

    const scores = calculateEngagementScores(tweets)

    let synced = 0
    const errors: string[] = []

    for (const [i, tweet] of tweets.entries()) {
      const classification = await classifyCompetitivePostWithFallback({
        content: tweet.full_text,
        engagement_score: scores[i],
        bookmark_count: tweet.bookmarks,
        quote_count: tweet.quotes,
        conversation_depth: tweet.replies + tweet.quotes,
      })

      const post = {
        competitor_id: competitor.id,
        platform: 'twitter',
        content: tweet.full_text,
        posted_at: new Date(tweet.created_at).toISOString(),
        engagement_score: scores[i],
        hook_type: classification.hook_type,
        hook_text: classification.hook_text,
        structure: classification.structure,
        cta_type: classification.cta_type,
        visual_type: classification.visual_type,
        visual_description: classification.visual_description,
        flagged_as_pattern: classification.flagged_as_pattern,
        twitter_post_id: tweet.id_str,
        bookmark_count: tweet.bookmarks,
        quote_count: tweet.quotes,
        conversation_depth: tweet.replies + tweet.quotes,
      }

      const { error } = await saveCompetitivePost(post)
      if (error) {
        console.error(`[Twitter Sync] competitive_posts save error:`, error.message)
        errors.push(error.message)
      } else {
        synced++
      }
    }

    return NextResponse.json({ synced, total: tweets.length, errors })
  } catch (err: any) {
    console.error('Twitter sync error:', err)
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 })
  }
}

// PUT — ingest locally scraped tweets (Safari scraper, no RapidAPI needed)
export async function PUT(req: NextRequest, { params }: { params: { competitorId: string } }) {
  try {
    const body = await req.json()
    const tweets: any[] = body.tweets || []

    if (!tweets.length) {
      return NextResponse.json({ synced: 0, total: 0 })
    }

    const { data: competitor, error: compError } = await supabase
      .from('competitors')
      .select('*')
      .eq('id', params.competitorId)
      .single()

    if (compError || !competitor) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 })
    }

    // Normalise engagement scores relative to batch
    const rawScores = tweets.map(t => (t.likes || 0) * 2 + (t.retweets || 0) * 3 + (t.replies || 0) + (t.bookmarks || 0) * 4)
    const maxRaw = Math.max(...rawScores, 1)
    const scores = rawScores.map(s => Math.min(100, Math.round((s / maxRaw) * 100)))

    let synced = 0
    const errors: string[] = []

    for (const [i, tweet] of tweets.entries()) {
      const content = tweet.text || tweet.full_text || ''
      if (!content) continue

      const classification = await classifyCompetitivePostWithFallback({
        content,
        engagement_score: scores[i],
        bookmark_count: tweet.bookmarks || 0,
        quote_count: tweet.quotes || 0,
        conversation_depth: (tweet.replies || 0) + (tweet.quotes || 0),
      })

      const post = {
        competitor_id: competitor.id,
        platform: 'twitter',
        content,
        posted_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : new Date().toISOString(),
        engagement_score: scores[i],
        hook_type: classification.hook_type,
        hook_text: classification.hook_text,
        structure: classification.structure,
        cta_type: classification.cta_type,
        visual_type: classification.visual_type,
        visual_description: classification.visual_description,
        flagged_as_pattern: classification.flagged_as_pattern,
        twitter_post_id: String(tweet.id || tweet.id_str || ''),
        bookmark_count: tweet.bookmarks || 0,
        quote_count: tweet.quotes || 0,
        conversation_depth: (tweet.replies || 0) + (tweet.quotes || 0),
      }

      const { error } = await saveCompetitivePost(post)
      if (error) {
        errors.push(error.message)
      } else {
        synced++
      }
    }

    return NextResponse.json({ synced, total: tweets.length, errors })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Ingest failed' }, { status: 500 })
  }
}
