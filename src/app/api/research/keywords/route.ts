import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { data, error } = await supabase
    .from('research_keywords')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  let body
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { niche, keyword } = body
  if (!niche || !keyword) {
    return NextResponse.json({ error: 'niche and keyword are required' }, { status: 400 })
  }

  const validNiches = ['CEX', 'DEX', 'DeFi', 'Gaming', 'Memecoin', 'Other']
  if (!validNiches.includes(niche)) {
    return NextResponse.json({ error: `niche must be one of: ${validNiches.join(', ')}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('research_keywords')
    .insert({ niche, keyword: keyword.trim() })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Keyword already exists for this niche' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
