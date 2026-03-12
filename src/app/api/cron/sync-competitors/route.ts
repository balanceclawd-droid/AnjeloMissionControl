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
    return supabase.from('competitive_posts').update(post).eq('id', existing.id)
  }

  return supabase.from('competitive_posts').insert(post)
}

async function syncCompetitor(competitor: any): Promise<{ name: string; synced: number; error?: string }> {
  try {
    const username = extractUsername(competitor.account_url, competitor.name)
    const userData = await twitterFetch(`/user?username=${encodeURIComponent(username)}`)
    const userId = userData?.result?.data?.user?.result?.rest_id
    if (!userId) return { name: competitor.name, synced: 0, error: `User not found: @${username}` }

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

    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i]
      const { error } = await saveCompetitivePost({
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
      if (error) {
        console.error(`[Cron] competitive_posts save error for ${competitor.name}:`, error.message)
      } else {
        synced++
      }
    }

    return { name: competitor.name, synced }
  } catch (err: any) {
    return { name: competitor.name, synced: 0, error: err.message }
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!RAPIDAPI_KEY) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 })
  }

  const { data: competitors, error } = await supabase
    .from('competitors')
    .select('*')
    .eq('platform', 'twitter')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ message: 'No Twitter competitors to sync', results: [] })
  }

  const results = []
  for (const competitor of competitors) {
    const result = await syncCompetitor(competitor)
    results.push(result)
    await new Promise(r => setTimeout(r, 1000))
  }

  const totalSynced = results.reduce((sum, r) => sum + r.synced, 0)
  console.log(`[Cron] Synced ${totalSynced} tweets across ${competitors.length} competitors`)

  const today = new Date().toISOString().slice(0, 10)
  let clientSnapshots = 0

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, twitter_url')
    .not('twitter_url', 'is', null)

  if (clients && clients.length > 0) {
    for (const client of clients) {
      try {
        const username = extractUsername(client.twitter_url, client.name)
        const userData = await twitterFetch(`/user?username=${encodeURIComponent(username)}`)
        const legacy = userData?.result?.data?.user?.result?.legacy
        if (!legacy) {
          console.log(`[Cron] Client ${client.name}: user not found @${username}`)
          continue
        }

        const { error: insertErr } = await supabase.from('client_twitter_snapshots').upsert({
          client_id: client.id,
          followers_count: legacy.followers_count ?? 0,
          tweet_count: legacy.statuses_count ?? 0,
          snapshot_date: today,
        }, { onConflict: 'client_id,snapshot_date' })

        if (insertErr) {
          console.error(`[Cron] client_twitter_snapshots upsert error for ${client.name}:`, insertErr.message)
        } else {
          clientSnapshots++
        }
        await new Promise(r => setTimeout(r, 1000))
      } catch (err: any) {
        console.log(`[Cron] Client ${client.name} snapshot error: ${err.message}`)
      }
    }
  }

  console.log(`[Cron] Took ${clientSnapshots} client Twitter snapshots`)

  let alertsCreated = 0
  let patternsCreated = 0

  try {
    const { data: hotPosts } = await supabase
      .from('competitive_posts')
      .select('*, competitors(name, niche)')
      .gte('engagement_score', 80)
      .gte('posted_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())

    if (hotPosts && hotPosts.length > 0) {
      for (const post of hotPosts) {
        const { data: existing } = await supabase
          .from('alerts')
          .select('id')
          .eq('alert_type', 'engagement_spike')
          .like('message', `%${post.twitter_post_id}%`)
          .limit(1)

        if (!existing || existing.length === 0) {
          const preview = post.content?.substring(0, 80) || 'No content'
          await supabase.from('alerts').insert({
            alert_type: 'engagement_spike',
            niche: post.competitors?.niche || null,
            severity: post.engagement_score === 100 ? 'critical' : 'high',
            message: `🔥 ${post.competitors?.name}: Score ${post.engagement_score}/100 — "${preview}..." [${post.twitter_post_id}]`,
            dismissed: false,
          })
          alertsCreated++
        }
      }
    }

    if (competitors) {
      for (const comp of competitors) {
        const { data: recentPosts } = await supabase
          .from('competitive_posts')
          .select('posted_at')
          .eq('competitor_id', comp.id)
          .order('posted_at', { ascending: false })
          .limit(1)

        if (recentPosts && recentPosts.length > 0) {
          const lastPost = new Date(recentPosts[0].posted_at)
          const daysSilent = (Date.now() - lastPost.getTime()) / (1000 * 60 * 60 * 24)

          if (daysSilent >= 5) {
            const { data: existing } = await supabase
              .from('alerts')
              .select('id')
              .eq('alert_type', 'competitor_silent')
              .like('message', `%${comp.name}%`)
              .eq('dismissed', false)
              .limit(1)

            if (!existing || existing.length === 0) {
              await supabase.from('alerts').insert({
                alert_type: 'competitor_silent',
                niche: comp.niche || null,
                severity: 'medium',
                message: `🔇 ${comp.name} has been silent for ${Math.floor(daysSilent)} days. Last post: ${lastPost.toISOString().slice(0, 10)}`,
                dismissed: false,
              })
              alertsCreated++
            }
          }
        }
      }
    }

    if (clients) {
      for (const client of clients) {
        const { data: snaps } = await supabase
          .from('client_twitter_snapshots')
          .select('*')
          .eq('client_id', client.id)
          .order('snapshot_date', { ascending: false })
          .limit(2)

        if (snaps && snaps.length === 2) {
          const drop = snaps[1].followers_count - snaps[0].followers_count
          if (drop >= 50) {
            await supabase.from('alerts').insert({
              alert_type: 'follower_drop',
              severity: drop >= 200 ? 'critical' : 'high',
              message: `📉 ${client.name} lost ${drop} followers (${snaps[1].followers_count} → ${snaps[0].followers_count})`,
              dismissed: false,
            })
            alertsCreated++
          }
        }
      }
    }

    const { data: topPosts } = await supabase
      .from('competitive_posts')
      .select('*, competitors(name, niche)')
      .gte('engagement_score', 60)
      .order('engagement_score', { ascending: false })
      .limit(50)

    if (topPosts && topPosts.length > 0) {
      const nicheGroups: Record<string, any[]> = {}
      for (const p of topPosts) {
        const niche = p.competitors?.niche || 'Unknown'
        if (!nicheGroups[niche]) nicheGroups[niche] = []
        nicheGroups[niche].push(p)
      }

      for (const [niche, posts] of Object.entries(nicheGroups)) {
        if (posts.length < 3) continue

        const questionPosts = posts.filter((p: any) => p.content?.includes('?'))
        if (questionPosts.length >= 2) {
          const avgScore = Math.round(questionPosts.reduce((s: number, p: any) => s + p.engagement_score, 0) / questionPosts.length)
          const uniqueCompetitors = new Set(questionPosts.map((p: any) => p.competitors?.name)).size

          if (uniqueCompetitors >= 2) {
            const { data: existing } = await supabase
              .from('patterns')
              .select('id')
              .eq('niche', niche)
              .eq('hook_type', 'question')
              .eq('status', 'emerging')
              .limit(1)

            if (!existing || existing.length === 0) {
              await supabase.from('patterns').insert({
                niche,
                hook_type: 'question',
                structure: 'short-form',
                cta_type: 'engagement',
                pattern_description: `${uniqueCompetitors} ${niche} competitors using question hooks with avg score ${avgScore}`,
                post_ids: questionPosts.slice(0, 5).map((p: any) => p.id),
                competitor_count: uniqueCompetitors,
                avg_engagement_score: avgScore,
                status: 'emerging',
              })
              patternsCreated++
            }
          }
        }

        const mediaPosts = posts.filter((p: any) => p.content && p.content.length < 50 && p.content.includes('http'))
        if (mediaPosts.length >= 2) {
          const avgScore = Math.round(mediaPosts.reduce((s: number, p: any) => s + p.engagement_score, 0) / mediaPosts.length)
          const uniqueCompetitors = new Set(mediaPosts.map((p: any) => p.competitors?.name)).size

          if (uniqueCompetitors >= 2) {
            const { data: existing } = await supabase
              .from('patterns')
              .select('id')
              .eq('niche', niche)
              .eq('hook_type', 'media-only')
              .eq('status', 'emerging')
              .limit(1)

            if (!existing || existing.length === 0) {
              await supabase.from('patterns').insert({
                niche,
                hook_type: 'media-only',
                structure: 'media-only',
                cta_type: 'none',
                pattern_description: `${uniqueCompetitors} ${niche} competitors getting high engagement with media-only posts (avg score ${avgScore})`,
                post_ids: mediaPosts.slice(0, 5).map((p: any) => p.id),
                competitor_count: uniqueCompetitors,
                avg_engagement_score: avgScore,
                status: 'emerging',
              })
              patternsCreated++
            }
          }
        }

        const identityPosts = posts.filter((p: any) => p.content && p.content.length < 100 && !p.content.includes('http') && !p.content.includes('?'))
        if (identityPosts.length >= 2) {
          const avgScore = Math.round(identityPosts.reduce((s: number, p: any) => s + p.engagement_score, 0) / identityPosts.length)
          const uniqueCompetitors = new Set(identityPosts.map((p: any) => p.competitors?.name)).size

          if (uniqueCompetitors >= 2) {
            const { data: existing } = await supabase
              .from('patterns')
              .select('id')
              .eq('niche', niche)
              .eq('hook_type', 'identity')
              .eq('status', 'emerging')
              .limit(1)

            if (!existing || existing.length === 0) {
              await supabase.from('patterns').insert({
                niche,
                hook_type: 'identity',
                structure: 'one-liner',
                cta_type: 'none',
                pattern_description: `${uniqueCompetitors} ${niche} competitors using bold identity one-liners with avg score ${avgScore}`,
                post_ids: identityPosts.slice(0, 5).map((p: any) => p.id),
                competitor_count: uniqueCompetitors,
                avg_engagement_score: avgScore,
                status: 'emerging',
              })
              patternsCreated++
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error(`[Cron] Alert/pattern detection error:`, err.message)
  }

  console.log(`[Cron] Created ${alertsCreated} alerts, ${patternsCreated} patterns`)

  return NextResponse.json({ totalSynced, results, clientSnapshots, alertsCreated, patternsCreated })
}
