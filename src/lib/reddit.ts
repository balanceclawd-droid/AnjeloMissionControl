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

// Niche-specific topic keywords — what we actually care about detecting
const NICHE_TOPICS: Record<string, string[]> = {
  DeFi: [
    'yield','liquidity','staking','airdrop','exploit','hack','bridge','governance',
    'protocol','tvl','gas','fees','defi','lending','borrowing','vault','farming',
    'swap','pool','token','dao','audit','rug','rugpull','flashloan','arbitrage',
  ],
  DEX: [
    'liquidity','pool','swap','fees','slippage','impermanent','volume','pair',
    'routing','aggregator','amm','orderbook','limit','concentrated',
  ],
  Gaming: [
    'tournament','season','rank','meta','patch','nft','reward','guild','marketplace',
    'p2e','play-to-earn','scholarship','clan','leaderboard','prize','drop','mint',
    'floor','opensea','steam','launch','beta','update','nerf','buff','grind',
  ],
  CEX: [
    'withdrawal','deposit','listing','delisting','trading','volume','fees','kyc',
    'regulation','sec','hack','breach','leverage','futures','margin','liquidation',
    'binance','coinbase','kraken','bybit','okx','custody','insurance',
  ],
  Memecoin: [
    'pump','dump','launch','presale','rug','community','holder','wallet','airdrop',
    'bonk','pepe','doge','shib','solana','trending','viral','meme','snipe','bundle',
    'migration','raydium','pumpfun','moonshot',
  ],
  General: [
    'bitcoin','btc','ethereum','eth','crypto','blockchain','web3','nft','defi',
    'regulation','sec','etf','bull','bear','market','price','adoption','wallet',
    'layer2','l2','zk','scaling','institutional',
  ],
}

// Fallback for unrecognised niches
const FALLBACK_TOPICS = [
  'bitcoin','ethereum','crypto','nft','defi','web3','token','wallet','blockchain',
  'trading','market','launch','hack','regulation','airdrop','staking',
]

export function extractTopicsFromPost(title: string, body: string, niche: string): string[] {
  return extractTopics(title, body, niche)
}

function extractTopics(title: string, body: string, niche: string): string[] {
  const text = `${title} ${body}`.toLowerCase()
  const keywords = NICHE_TOPICS[niche] || FALLBACK_TOPICS
  return keywords.filter(kw => text.includes(kw))
}

// Scrape a batch of subreddits via Reddit's free public JSON API — no Apify needed
export async function scrapeSubredditsViaApify(subreddits: string[], maxPostsPerSub = 25, nicheMap: Record<string, string> = {}): Promise<{ subreddit: string; posts: RedditPost[] }[]> {
  const results: { subreddit: string; posts: RedditPost[] }[] = []
  const cutoff = Date.now() - 48 * 60 * 60 * 1000

  for (const subreddit of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=${maxPostsPerSub}`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AnjeloMissionControl/1.0' },
        signal: AbortSignal.timeout(10000),
      })

      if (!res.ok) {
        results.push({ subreddit, posts: [] })
        continue
      }

      const data = await res.json()
      const children: any[] = data?.data?.children || []
      const niche = nicheMap[subreddit.toLowerCase()] || 'General'
      const posts: RedditPost[] = []

      for (const child of children) {
        const item = child.data
        if (!item || item.stickied) continue

        const createdAt = item.created_utc ? item.created_utc * 1000 : 0
        if (createdAt && createdAt < cutoff) continue

        const isSelf = item.is_self || false
        const comments = item.num_comments || 0
        const body = item.selftext || ''

        if (item.over_18) continue
        if (!isSelf && comments < 3) continue
        if (isSelf && body.length < 30 && comments < 3) continue

        let signal_strength: 'high' | 'medium' | 'low'
        if (isSelf && comments >= 10) signal_strength = 'high'
        else if (isSelf && comments >= 5) signal_strength = 'medium'
        else if (!isSelf && comments >= 15) signal_strength = 'medium'
        else signal_strength = 'low'

        const title = item.title || ''
        posts.push({
          reddit_post_id: item.id || '',
          title,
          body,
          author: item.author || '',
          url: item.url || '',
          permalink: `https://reddit.com${item.permalink || ''}`,
          score: item.score || 0,
          upvote_ratio: item.upvote_ratio || 0,
          num_comments: comments,
          created_utc: new Date(item.created_utc * 1000).toISOString(),
          flair: item.link_flair_text || null,
          topics: extractTopics(title, body, niche),
          signal_strength,
        })
      }

      results.push({ subreddit, posts })

      // Small delay to be polite to Reddit's API
      await sleep(500)
    } catch {
      results.push({ subreddit, posts: [] })
    }
  }

  return results
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
