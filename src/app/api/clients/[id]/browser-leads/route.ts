import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const VERTICAL_NICHES: Record<string, string> = {
  ai_trading: 'DeFi',
  cex: 'CEX',
  gaming_web3: 'Gaming',
}

const VERTICAL_SUBREDDITS: Record<string, string[]> = {
  ai_trading: ['algotrading', 'ai_trading', 'stocks', 'Trading', 'Daytrading'],
  cex: ['CryptoCurrency', 'CryptoMarkets', 'stocks'],
  gaming_web3: ['web3gaming', 'NFTGaming', 'PlayToEarn', 'gamefi', 'MarbleLeague'],
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, vertical')
    .eq('id', params.id)
    .single()

  if (clientErr || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const vertical = client.vertical
  const niche = VERTICAL_NICHES[vertical] || ''
  const subreddits = VERTICAL_SUBREDDITS[vertical] || []
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 20), 50)

  let query = supabase
    .from('reddit_browser_leads')
    .select('*')
    .order('relevance_score', { ascending: false })
    .order('collected_at', { ascending: false })
    .limit(limit)

  if (niche) query = query.eq('niche', niche)
  if (subreddits.length > 0) query = query.in('subreddit', subreddits)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data || [])
}
