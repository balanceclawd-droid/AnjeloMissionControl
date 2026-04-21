import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function GET() {
  const { data, error } = await supabase
    .from('ambassador_replies')
    .select('*, ambassador_contacts(name, email, company, role)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contact_id, campaign_id, thread_text, draft_a, draft_b } = body

    const { data, error } = await supabase
      .from('ambassador_replies')
      .insert({
        contact_id,
        campaign_id,
        thread_text: thread_text || '',
        draft_a: draft_a || '',
        draft_b: draft_b || '',
        status: 'pending',
      })
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
