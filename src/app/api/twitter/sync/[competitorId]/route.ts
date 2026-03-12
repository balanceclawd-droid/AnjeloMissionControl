import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

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
      const post = {
        competitor_id: competitor.id,
        platform: 'twitter',
        content: tweet.full_text,
        posted_at: new Date(tweet.created_at).toISOString(),
        engagement_score: scores[i],
        hook_type: null,
        structure: null,
        flagged_as_pattern: false,
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
