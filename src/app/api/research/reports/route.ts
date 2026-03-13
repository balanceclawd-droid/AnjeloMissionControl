import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  let query = supabase
    .from('research_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (type === 'daily' || type === 'weekly') {
    query = query.eq('report_type', type)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}
