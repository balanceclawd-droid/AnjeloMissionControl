import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: metrics, error } = await supabase
    .from('weekly_metrics')
    .select('*')
    .eq('client_id', params.id)
    .order('week_ending', { ascending: false })
    .order('submitted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(metrics)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const { week_ending, metric_type, data } = body
  if (!week_ending || !metric_type || !data) {
    return NextResponse.json({ error: 'week_ending, metric_type, and data required' }, { status: 400 })
  }

  const clientId = parseInt(params.id, 10)
  if (isNaN(clientId)) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  let parsedData
  try { parsedData = typeof data === 'string' ? JSON.parse(data) : data } catch { return NextResponse.json({ error: 'Invalid data JSON' }, { status: 400 }) }

  const { data: metric, error } = await supabase
    .from('weekly_metrics')
    .insert({
      client_id: clientId,
      week_ending,
      metric_type,
      data: parsedData,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(metric, { status: 201 })
}
