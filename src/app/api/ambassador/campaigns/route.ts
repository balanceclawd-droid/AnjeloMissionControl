import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabase
    .from('ambassador_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, step1_template, step2_template, step3_template, schedule_days, schedule_time, timezone } = body

    const { data, error } = await supabase
      .from('ambassador_campaigns')
      .insert({
        name: name || 'Untitled Campaign',
        step1_template: step1_template || '',
        step2_template: step2_template || '',
        step3_template: step3_template || '',
        schedule_days: schedule_days || ['mon', 'tue', 'wed', 'thu', 'fri'],
        schedule_time: schedule_time || '09:00',
        timezone: timezone || 'Europe/London',
        status: 'draft',
      })
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
