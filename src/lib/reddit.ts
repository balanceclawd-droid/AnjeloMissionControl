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

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '9d78581915msh37c618ff0b5cf2fp1b7969jsn06c2d4f7fb04'
const RAPIDAPI_HOST = 'reddit3.p.rapidapi.com'

export async function scrapeSubreddit(
  subreddit: string,
  sort: 'hot' | 'new' | 'top' = 'hot',
  limit = 25
): Promise<RedditPost[]> {
  const subredditUrl = encodeURIComponent(`https://www.reddit.com/r/${subreddit}`)
  // Always fetch top posts from last 24h — keeps data fresh and relevant
  const url = `https://${RAPIDAPI_HOST}/v1/reddit/posts?url=${subredditUrl}&filter=top&t=day`

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Reddit API error ${res.status} for r/${subreddit}`)
  const raw = await res.json()

  // reddit3 RapidAPI returns { meta: {...}, body: [...posts] }
  // Native Reddit returns { data: { children: [{data: post}] } }
  let posts: any[] = []
  if (Array.isArray(raw?.body)) {
    posts = raw.body // flat post objects
  } else if (Array.isArray(raw?.data?.children)) {
    posts = raw.data.children.map((c: any) => c.data || c)
  } else if (Array.isArray(raw)) {
    posts = raw
  }

  const cutoff = Date.now() - 48 * 60 * 60 * 1000 // 48 hours ago

  return posts
    .filter((p: any) => {
      const d = p.data || p
      const createdMs = (d.created_utc || 0) * 1000
      return createdMs >= cutoff // only last 48h
    })
    .map((p: any) => {
    const d = p.data || p // flat or wrapped
    const title = d.title || ''
    const words = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 3 && !STOPWORDS.has(w))
    return {
      reddit_post_id: d.id,
      title,
      body: d.selftext || '',
      author: d.author || '',
      url: d.url || '',
      permalink: `https://reddit.com${d.permalink || ''}`,
      score: d.score || 0,
      upvote_ratio: d.upvote_ratio || 0,
      num_comments: d.num_comments || 0,
      created_utc: new Date((d.created_utc || 0) * 1000).toISOString(),
      flair: d.link_flair_text || null,
      topics: [...new Set(words)].slice(0, 10) as string[],
    }
  })
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
      sample_titles: v.samples, // now [{title, permalink}] objects
    }))
    .sort((a, b) => b.mention_count - a.mention_count)
    .slice(0, 20)
}
