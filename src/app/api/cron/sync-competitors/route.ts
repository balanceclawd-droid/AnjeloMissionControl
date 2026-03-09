import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY
const RAPIDAPI_HOST = process.env.RAPIDAPI_TWITTER_HOST || 'twitter241.p.rapidapi.com'
const CRON_SECRET = process.env.CRON_SECRET

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

function extractUsername(accountUrl: string | null, name: string): string {
  if (accountUrl) {
    const match = accountUrl.match(/(?:twitter\.com|x\.com)\/([^/?]+)/)
    if (match) return match[1]
  }
  return name.replace(/^@/, '')
}

function calculateEngagementScores(tweets: { likes: number; retweets: number; replies: number; bookmarks: number; quotes: number }[]): number[] {
  if (tweets.length === 0) return []
  const rawScores = tweets.map(t => t.likes * 2 + t.retweets * 3 + t.replies * 1 + t.bookmarks * 4 + t.quotes * 2)
  const maxRaw = Math.max(...rawScores)
  if (maxRaw === 0) return rawScores.map(() => 0)
  return rawScores.map(s => Math.min(100, Math.round((s / maxRaw) * 100)))
}

async function syncCompetitor(competitor: any): Promise<{ name: string; synced: number; error?: string }> {
  try {
    const username = extractUsername(competitor.account_url, competitor.name)
    const userData = await twitterFetch(`/user?username=${encodeURIComponent(username)}`)
    const userId = userData?.result?.data?.user?.result?.rest_id
    if (!userId) return { name: competitor.name, synced: 0, error: `User not found: @${username}` }

    const tweetsData = await twitterFetch(`/user-tweets?user=${userId}&count=20`)
    const instructions = tweetsData?.result?.timeline?.instructions || []
    const addEntries = instructions.find((i: any) => i.type === 'TimelineAddEntries')
    const entries = addEntries?.entries || []

    const tweetEntries = entries.filter(
      (e: any) => e.content?.entryType === 'TimelineTimelineItem' &&
        e.content?.itemContent?.__typename === 'TimelineTweet'
    )

    const tweets = tweetEntries.map((entry: any) => {
      const legacy = entry.content.itemContent.tweet_results.result.legacy
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
    }).filter((t: any) => t.id_str && t.full_text)

    const scores = calculateEngagementScores(tweets)
    let synced = 0

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i]
      const { data: existing } = await supabase
        .from('competitive_posts')
        .select('id')
        .eq('competitor_id', competitor.id)
        .eq('twitter_post_id', tweet.id_str)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('competitive_posts')
          .update({
            engagement_score: scores[i],
            bookmark_count: tweet.bookmarks,
            quote_count: tweet.quotes,
            conversation_depth: tweet.replies + tweet.quotes,
          })
          .eq('id', existing.id)
        if (!error) synced++
      } else {
        const { error } = await supabase.from('competitive_posts').insert({
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
        })
        if (!error) synced++
      }
    }

    return { name: competitor.name, synced }
  } catch (err: any) {
    return { name: competitor.name, synced: 0, error: err.message }
  }
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 })
  }

  // Get all Twitter competitors
  const { data: competitors, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('platform', 'twitter')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ message: 'No Twitter competitors to sync', results: [] })
  }

  // Sync each competitor sequentially to avoid rate limits
  const results = []
  for (const competitor of competitors) {
    const result = await syncCompetitor(competitor)
    results.push(result)
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000))
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  console.log(`[Cron] Synced ${totalSynced} new tweets across ${competitors.length} competitors`)

  // Snapshot Twitter followers for all clients with a twitter_url
  const today = new Date().toISOString().slice(0, 10)
  let clientSnapshots = 0

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, twitter_url')
    .not('twitter_url', 'is', null)

  if (clients && clients.length > 0) {
    for (const client of clients) {
      try {
        // Skip if snapshot already exists for today
        const { data: existing } = await supabase
          .from('client_twitter_snapshots')
          .select('id')
          .eq('client_id', client.id)
          .eq('snapshot_date', today)
          .maybeSingle()

        if (existing) continue

        const username = extractUsername(client.twitter_url, client.name)
        const userData = await twitterFetch(`/user?username=${encodeURIComponent(username)}`)
        const legacy = userData?.result?.data?.user?.result?.legacy
        if (!legacy) {
          console.log(`[Cron] Client ${client.name}: user not found @${username}`)
          continue
        }

        const { error: insertErr } = await supabase.from('client_twitter_snapshots').insert({
          client_id: client.id,
          followers_count: legacy.followers_count ?? 0,
          tweet_count: legacy.statuses_count ?? 0,
          snapshot_date: today,
        })

        if (!insertErr) clientSnapshots++
        await new Promise(r => setTimeout(r, 1000))
      } catch (err: any) {
        console.log(`[Cron] Client ${client.name} snapshot error: ${err.message}`)
      }
    }
  }

  console.log(`[Cron] Took ${clientSnapshots} client Twitter snapshots`)

  return NextResponse.json({ totalSynced, results, clientSnapshots })
}
