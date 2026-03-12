import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { backfillPostClassifications, detectPatterns, sanitizePatternPostIds } from '@/lib/patterns'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const niche = searchParams.get('niche')
  const status = searchParams.get('status')

  await sanitizePatternPostIds()

  let query = supabase.from('patterns').select('*')

  if (niche) query = query.eq('niche', niche)
  if (status) query = query.eq('status', status)

  const { data: patterns, error } = await query.order('avg_engagement_score', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(patterns)
}

export async function POST() {
  const backfill = await backfillPostClassifications()
  const detection = await detectPatterns()
  return NextResponse.json({ backfill, detection })
}
