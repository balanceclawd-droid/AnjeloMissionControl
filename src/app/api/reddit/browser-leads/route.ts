import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { scoreBrowserLead, type BrowserLeadInput } from '@/lib/reddit-browser'

export const dynamic = 'force-dynamic'

type LeadPayload = BrowserLeadInput & {
  sourceKind?: 'browser' | 'manual'
}

export async function GET(req: NextRequest) {
  const niche = req.nextUrl.searchParams.get('niche') || ''
  const subreddit = req.nextUrl.searchParams.get('subreddit') || ''
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100)

  let query = supabase
    .from('reddit_browser_leads')
    .select('*')
    .order('relevance_score', { ascending: false })
    .order('collected_at', { ascending: false })
    .limit(limit)

  if (niche) query = query.eq('niche', niche)
  if (subreddit) query = query.ilike('subreddit', subreddit)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const leads = Array.isArray(body?.leads) ? body.leads as LeadPayload[] : []
  if (leads.length === 0) {
    return NextResponse.json({ error: 'leads[] required' }, { status: 400 })
  }

  const rows = leads
    .filter(lead => lead?.title && lead?.permalink && lead?.subreddit)
    .map(lead => {
      const scored = scoreBrowserLead(lead)
      return {
        subreddit: lead.subreddit,
        niche: scored.niche,
        title: lead.title,
        permalink: lead.permalink,
        author: lead.author || null,
        snippet: lead.snippet || '',
        score_text: lead.scoreText || null,
        comment_count: Math.max(0, lead.commentCount || 0),
        posted_at_text: lead.postedAtText || null,
        opportunity_type: scored.opportunityType,
        matched_keywords: scored.matchedKeywords,
        relevance_score: scored.relevanceScore,
        source_query: lead.sourceQuery || null,
        source_kind: lead.sourceKind || 'browser',
      }
    })

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No valid leads found' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('reddit_browser_leads')
    .upsert(rows, { onConflict: 'permalink' })
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: data?.length || 0, leads: data || [] })
}
