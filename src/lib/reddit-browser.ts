export type BrowserLeadInput = {
  subreddit: string
  title: string
  permalink: string
  author?: string | null
  snippet?: string | null
  scoreText?: string | null
  commentCount?: number | null
  postedAtText?: string | null
  sourceQuery?: string | null
}

const NICHE_BY_SUBREDDIT: Record<string, string> = {
  algotrading: 'DeFi',
  ai_trading: 'DeFi',
  defi: 'DeFi',
  ethereum: 'DeFi',
  cryptocurrency: 'CEX',
  cryptomarkets: 'CEX',
  trading: 'CEX',
  daytrading: 'CEX',
  stocks: 'CEX',
  gamefi: 'Gaming',
  marbleleague: 'Gaming',
  nftgaming: 'Gaming',
  playtoearn: 'Gaming',
  web3gaming: 'Gaming',
  web3: 'General',
  memecoins: 'Memecoin',
  solana: 'Memecoin',
}

const KEYWORDS: Record<string, string[]> = {
  ai_trading: [
    'ai trading', 'algo', 'algorithmic', 'bot', 'automated', 'strategy', 'backtest',
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
  general: [
    'recommend', 'looking for', 'best', 'anyone tried', 'how do you', 'what do you use'
  ],
}

export function inferNiche(subreddit: string): string {
  return NICHE_BY_SUBREDDIT[subreddit.toLowerCase()] || 'General'
}

export function scoreBrowserLead(input: BrowserLeadInput) {
  const niche = inferNiche(input.subreddit)
  const keywordSet = niche === 'DeFi'
    ? KEYWORDS.ai_trading
    : niche === 'CEX'
    ? KEYWORDS.cex
    : niche === 'Gaming'
    ? KEYWORDS.gaming_web3
    : KEYWORDS.general

  const text = `${input.title} ${input.snippet || ''}`.toLowerCase()
  const matchedKeywords = keywordSet.filter(kw => text.includes(kw))
  const commentCount = Math.max(0, input.commentCount || 0)

  let opportunityType: 'question' | 'pain_point' | 'recommendation_request' | 'education' | 'general' = 'general'
  if (/\?/.test(input.title)) opportunityType = 'question'
  else if (/(lost|losing|drawdown|fail|struggle|frustrated|blew up|not profitable)/i.test(text)) opportunityType = 'pain_point'
  else if (/(recommend|suggest|looking for|best|which|anyone use|what do you use)/i.test(text)) opportunityType = 'recommendation_request'
  else if (/(how do|how to|what is|explain|newbie|beginner)/i.test(text)) opportunityType = 'education'

  const relevanceScore = matchedKeywords.length * 10 + commentCount * 0.5 + (opportunityType === 'question' ? 15 : opportunityType === 'recommendation_request' ? 12 : opportunityType === 'pain_point' ? 10 : opportunityType === 'education' ? 8 : 0)

  return {
    niche,
    matchedKeywords,
    opportunityType,
    relevanceScore,
  }
}
