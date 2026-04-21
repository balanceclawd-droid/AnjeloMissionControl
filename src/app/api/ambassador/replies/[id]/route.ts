import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { action, edited_text } = body

    const { data: reply, error: fetchError } = await supabase
      .from('ambassador_replies')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError || !reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    let newStatus = reply.status
    let updateFields: Record<string, unknown> = { processed_at: new Date().toISOString() }

    if (action === 'approved') {
      newStatus = reply.draft_a ? 'approved_a' : 'approved_b'
    } else if (action === 'edited') {
      newStatus = edited_text === reply.draft_a ? 'edited_a' : 'edited_b'
    } else if (action === 'discarded') {
      newStatus = 'discarded'
    }

    updateFields.status = newStatus

    // If edited, also log the edited text as a thread entry
    if ((action === 'edited') && edited_text) {
      await supabase.from('ambassador_threads').insert({
        contact_id: reply.contact_id,
        direction: 'outbound',
        body: edited_text,
      })
    }

    const { data, error } = await supabase
      .from('ambassador_replies')
      .update(updateFields)
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update contact status based on reply action
    if (reply.contact_id) {
      const statusMap: Record<string, string> = {
        approved_a: 'replied',
        approved_b: 'replied',
        edited_a: 'replied',
        edited_b: 'replied',
        discarded: 'contacted',
      }
      const newContactStatus = statusMap[newStatus]
      if (newContactStatus) {
        await supabase
          .from('ambassador_contacts')
          .update({
            status: newContactStatus,
            last_activity: `Reply ${action}ed`,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', reply.contact_id)
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
