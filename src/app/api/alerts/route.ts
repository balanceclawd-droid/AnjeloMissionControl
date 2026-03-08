import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dismissed = searchParams.get('dismissed')

  let query = supabase.from('alerts').select('*')

  if (dismissed !== null) {
    query = query.eq('dismissed', dismissed === 'true')
  }

  const { data: alerts, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(alerts)
}

export async function PUT(req: NextRequest) {
  const body = await req.json()
  const { id, dismissed } = body
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const { error } = await supabase
    .from('alerts')
    .update({ dismissed: !!dismissed })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
