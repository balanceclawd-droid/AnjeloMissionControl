import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const days = parseInt(searchParams.get('days') || '7', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceDate = since.toISOString().split('T')[0]

  let query = supabase
    .from('reddit_trending')
    .select('*')
    .gte('trend_date', sinceDate)
    .order('mention_count', { ascending: false })
    .limit(limit)

  if (niche) query = query.eq('niche', niche)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
