import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabase
    .from('ambassador_settings')
    .select('*')
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return defaults if no settings row exists
  if (!data) {
    return NextResponse.json({
      id: null,
      opportunity_brief: '',
      default_timezone: 'Europe/London',
      send_window_start: '09:00',
      send_window_end: '17:00',
      webhook_url: '/api/ambassador/webhook',
    })
  }

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { opportunity_brief, default_timezone, send_window_start, send_window_end } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (opportunity_brief !== undefined) updates.opportunity_brief = opportunity_brief
    if (default_timezone !== undefined) updates.default_timezone = default_timezone
    if (send_window_start !== undefined) updates.send_window_start = send_window_start
    if (send_window_end !== undefined) updates.send_window_end = send_window_end

    const { data: existing } = await supabase
      .from('ambassador_settings')
      .select('id')
      .maybeSingle()

    let result
    if (existing) {
      const { data, error } = await supabase
        .from('ambassador_settings')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .maybeSingle()
      result = data
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { data, error } = await supabase
        .from('ambassador_settings')
        .insert(updates)
        .select()
        .maybeSingle()
      result = data
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
