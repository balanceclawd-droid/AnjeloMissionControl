import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// Subreddits relevant to each client vertical
const VERTICAL_SUBREDDITS: Record<string, string[]> = {
  ai_trading: ['algotrading', 'ai_trading', 'stocks', 'Trading', 'Daytrading'],
  cex: ['CryptoCurrency', 'CryptoMarkets', 'stocks'],
  gaming_web3: ['web3gaming', 'NFTGaming', 'PlayToEarn', 'gamefi', 'MarbleLeague'],
}

// Keywords that indicate a post is a good inception opportunity
const OPPORTUNITY_KEYWORDS: Record<string, string[]> = {
  ai_trading: [
    'ai trading', 'algo', 'bot', 'automated', 'strategy', 'backtest',
    'signal', 'indicator', 'profitable', 'loss', 'losing', 'drawdown',
    'recommend', 'suggestions', 'looking for', 'what do you use', 'how do you',
    'anyone tried', 'experience with', 'best tool', 'best platform',
    'copy trading', 'mirror', 'portfolio', 'risk management',
  ],
  cex: [
    'exchange', 'fees', 'kyc', 'withdrawal', 'recommend', 'best exchange',
    'which platform', 'anyone use', 'looking for', 'deposit', 'custody',
  ],
  gaming_web3: [
    'play to earn', 'p2e', 'nft game', 'web3 game', 'scholarship',
    'recommend', 'looking for', 'anyone tried', 'best game', 'earning',
  ],
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Get client
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, vertical')
    .eq('id', params.id)
    .single()

  if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const vertical = client.vertical
  const targetSubreddits = VERTICAL_SUBREDDITS[vertical] || []
  const keywords = OPPORTUNITY_KEYWORDS[vertical] || []

  if (targetSubreddits.length === 0) {
    return NextResponse.json([])
  }

  // Get subreddit IDs
  const { data: subs } = await supabase
    .from('reddit_subreddits')
    .select('id, subreddit')
    .in('subreddit', targetSubreddits)

  if (!subs || subs.length === 0) return NextResponse.json([])

  const subIds = subs.map((s: any) => s.id)

  // Date filter — today / week (default 7d) / all (30d)
  const dateParam = req.nextUrl.searchParams.get('date') || 'week'
  const cutoffMs = dateParam === 'today'
    ? Date.now() - 24 * 60 * 60 * 1000
    : dateParam === 'all'
    ? Date.now() - 30 * 24 * 60 * 60 * 1000
    : Date.now() - 7 * 24 * 60 * 60 * 1000
  const cutoff = new Date(cutoffMs).toISOString()

  const { data: posts, error: postsErr } = await supabase
    .from('reddit_posts')
    .select(`
      id, title, body, permalink, score, num_comments, created_utc, signal_strength, flair,
      reddit_subreddits!inner(subreddit, niche)
    `)
    .in('subreddit_id', subIds)
    .in('signal_strength', ['high', 'medium'])
    .gte('created_utc', cutoff)
    .order('num_comments', { ascending: false })
    .limit(100)

  if (postsErr) return NextResponse.json({ error: postsErr.message }, { status: 500 })

  // Score each post for inception relevance
  const scored = (posts || []).map((post: any) => {
    const text = `${post.title} ${post.body}`.toLowerCase()
    const matchedKeywords = keywords.filter(kw => text.includes(kw))
    const relevanceScore = matchedKeywords.length * 10 + post.num_comments * 0.5 + (post.signal_strength === 'high' ? 20 : 10)

    // Categorise the opportunity type
    let opportunity_type = 'general'
    if (/\?/.test(post.title)) opportunity_type = 'question' // asking for advice
    else if (/(lost|losing|losing money|drawdown|fail|struggle|frustrated)/i.test(text)) opportunity_type = 'pain_point'
    else if (/(recommend|suggest|looking for|best|which|anyone use)/i.test(text)) opportunity_type = 'recommendation_request'
    else if (/(how do|how to|what is|explain|newbie|beginner)/i.test(text)) opportunity_type = 'education'

    return {
      ...post,
      matchedKeywords,
      relevanceScore,
      opportunity_type,
    }
  })
  .filter((p: any) => p.relevanceScore > 10) // only genuinely relevant
  .sort((a: any, b: any) => b.relevanceScore - a.relevanceScore)
  .slice(0, 15)

  return NextResponse.json(scored)
}
