import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: metrics, error } = await supabase
    .from('weekly_metrics')
    .select('*')
    .eq('client_id', params.id)
    .order('week_ending', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(metrics)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { week_ending, metric_type, data } = body
  if (!week_ending || !metric_type || !data) {
    return NextResponse.json({ error: 'week_ending, metric_type, and data required' }, { status: 400 })
  }

  const { data: metric, error } = await supabase
    .from('weekly_metrics')
    .insert({
      client_id: parseInt(params.id, 10),
      week_ending,
      metric_type,
      data: typeof data === 'string' ? JSON.parse(data) : data,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(metric, { status: 201 })
}
