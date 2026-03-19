export interface RedditPost {
  reddit_post_id: string
  title: string
  body: string
  author: string
  url: string
  permalink: string
  score: number
  upvote_ratio: number
  num_comments: number
  created_utc: string // ISO string
  flair: string | null
  topics: string[]
  signal_strength: 'high' | 'medium' | 'low'
}

const STOPWORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
  'is','are','was','were','be','been','have','has','had','do','does','did','will',
  'would','could','should','may','might','can','it','its','this','that','these',
  'those','i','my','we','our','you','your','they','their','he','his','she','her',
  'what','how','why','when','where','who','which','not','no','so','if','as','up',
  'out','about','into','than','then','there','here','also','just','get','got','like',
  'more','some','any','all','one','two','new','best','good','great','need','want',
  'make','made','use','used','using','day','time','way','said','going','really',
  'very','much','many'
])

const APIFY_TOKEN = process.env.APIFY_TOKEN || ''
const APIFY_ACTOR_ID = 'FgJtjDwJCLhRH9saM'

// Trigger an Apify actor run for a batch of subreddits and return the dataset items
export async function scrapeSubredditsViaApify(subreddits: string[], maxPostsPerSub = 25): Promise<{ subreddit: string; posts: RedditPost[] }[]> {
  const startUrls = subreddits.map(s => ({
    url: `https://www.reddit.com/r/${s}/top/?t=day`,
  }))

  // Start the run
  const runRes = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startUrls,
      maxPostCount: maxPostsPerSub,
      maxComments: 0,
      sort: 'top',
      searchPosts: true,
      searchComments: false,
      searchCommunities: false,
      searchUsers: false,
      skipComments: true,
      skipCommunity: true,
      skipUserPosts: true,
      includeNSFW: false,
      debugMode: false,
      proxy: { useApifyProxy: true, apifyProxyGroups: ['RESIDENTIAL'] },
    }),
  })

  if (!runRes.ok) {
    const text = await runRes.text()
    throw new Error(`Apify run failed: ${runRes.status} — ${text}`)
  }

  const runData = await runRes.json()
  const runId = runData?.data?.id
  const datasetId = runData?.data?.defaultDatasetId
  if (!runId || !datasetId) throw new Error('Apify run did not return runId/datasetId')

  // Poll until finished (max 90s)
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    await sleep(5000)
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const statusData = await statusRes.json()
    const status = statusData?.data?.status
    if (status === 'SUCCEEDED') break
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify run ${status}`)
    }
  }

  // Fetch dataset items
  const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=1000`)
  if (!itemsRes.ok) throw new Error(`Failed to fetch Apify dataset: ${itemsRes.status}`)
  const items: any[] = await itemsRes.json()

  // Group by subreddit and map to RedditPost shape
  const grouped: Record<string, RedditPost[]> = {}
  const cutoff = Date.now() - 48 * 60 * 60 * 1000

  for (const item of items) {
    if (item.dataType !== 'post') continue

    const subreddit = item.parsedCommunityName || item.communityName?.replace('r/', '') || ''
    if (!subreddit) continue

    const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0
    if (createdAt < cutoff) continue // too old

    const isSelf = !item.link || item.link === item.url
    const comments = item.numberOfComments || 0
    const body = item.body || ''

    // Filter low-signal
    if (item.isAd) continue
    if (!isSelf && comments < 3) continue
    if (isSelf && body.length < 30 && comments < 3) continue

    // Signal strength
    let signal_strength: 'high' | 'medium' | 'low'
    if (isSelf && comments >= 10) signal_strength = 'high'
    else if (isSelf && comments >= 5) signal_strength = 'medium'
    else if (!isSelf && comments >= 15) signal_strength = 'medium'
    else signal_strength = 'low'

    const title = item.title || ''
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 3 && !STOPWORDS.has(w))

    const post: RedditPost = {
      reddit_post_id: item.parsedId || item.id || '',
      title,
      body,
      author: item.username || '',
      url: item.link || item.url || '',
      permalink: item.url || '',
      score: item.upVotes || 0,
      upvote_ratio: item.upVoteRatio || 0,
      num_comments: comments,
      created_utc: item.createdAt || new Date().toISOString(),
      flair: item.flair || null,
      topics: [...new Set(words)].slice(0, 10) as string[],
      signal_strength,
    }

    if (!grouped[subreddit]) grouped[subreddit] = []
    grouped[subreddit].push(post)
  }

  return subreddits.map(s => ({ subreddit: s, posts: grouped[s] || [] }))
}

// Legacy single-subreddit wrapper (kept for backwards compat)
export async function scrapeSubreddit(subreddit: string): Promise<RedditPost[]> {
  const results = await scrapeSubredditsViaApify([subreddit])
  return results[0]?.posts || []
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function detectTrends(posts: RedditPost[], niche: string) {
  const topicCounts: Record<string, { count: number; scores: number[]; samples: {title: string; permalink: string}[] }> = {}
  for (const post of posts) {
    for (const topic of post.topics) {
      if (!topicCounts[topic]) topicCounts[topic] = { count: 0, scores: [], samples: [] }
      topicCounts[topic].count++
      topicCounts[topic].scores.push(post.score)
      if (topicCounts[topic].samples.length < 3) {
        topicCounts[topic].samples.push({ title: post.title, permalink: post.permalink })
      }
    }
  }
  return Object.entries(topicCounts)
    .filter(([, v]) => v.count >= 2)
    .map(([topic, v]) => ({
      niche,
      topic,
      mention_count: v.count,
      avg_score: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
      sample_titles: v.samples,
    }))
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 20)
}
