import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const allowed = ['status', 'linkedin_url', 'twitter_url', 'website_url', 'notes', 'name', 'company', 'role', 'campaign_id', 'next_step']
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data, error } = await supabase
      .from('ambassador_contacts')
      .update(updates)
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { error } = await supabase
      .from('ambassador_contacts')
      .delete()
      .eq('id', params.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
