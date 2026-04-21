import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const SMARTLEAD_API = 'https://server.smartlead.ai/api/v1'
const SMARTLEAD_TOKEN = process.env.SMARTLEAD_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { reply_id, chosen_option, edited_body } = await req.json()
    if (!reply_id || !chosen_option) {
      return NextResponse.json({ error: 'reply_id and chosen_option required' }, { status: 400 })
    }

    // Fetch reply and contact
    const { data: reply, error: replyError } = await supabase
      .from('ambassador_replies')
      .select('*, ambassador_contacts(id, email, name, company, campaign_id, smartlead_lead_id)')
      .eq('id', reply_id)
      .maybeSingle()

    if (replyError || !reply) {
      return NextResponse.json({ error: 'Reply not found' }, { status: 404 })
    }

    const contact = reply.ambassador_contacts
    const finalBody = edited_body || (
      chosen_option === 'A' ? reply.draft_a : reply.draft_b
    )

    if (!finalBody) {
      return NextResponse.json({ error: 'No draft text found for selected option' }, { status: 400 })
    }

    // Update reply status
    const statusMap: Record<string, string> = {
      A: 'approved_a',
      B: 'approved_b',
      edited_a: 'edited_a',
      edited_b: 'edited_b',
    }
    const newStatus = statusMap[chosen_option] || 'approved_a'

    await supabase
      .from('ambassador_replies')
      .update({ status: newStatus, processed_at: new Date().toISOString() })
      .eq('id', reply_id)

    // Send via Smartlead if token available and lead_id exists
    if (SMARTLEAD_TOKEN && contact?.smartlead_lead_id && contact?.campaign_id) {
      try {
        await fetch(`${SMARTLEAD_API}/campaigns/${contact.campaign_id}/reply-email-thread`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SMARTLEAD_TOKEN}`,
          },
          body: JSON.stringify({
            lead_id: contact.smartlead_lead_id,
            email_body: finalBody,
          }),
        })
      } catch (e) {
        console.error('Smartlead send error:', e)
        // Non-fatal — we still saved the draft locally
      }
    }

    // Store final body as a thread entry
    await supabase.from('ambassador_threads').insert({
      contact_id: contact?.id,
      direction: 'outbound',
      body: finalBody,
    })

    // Store as tone example if approved (not edited)
    if (chosen_option === 'A' || chosen_option === 'B') {
      await supabase.from('ambassador_tone_examples').insert({
        body: finalBody,
        source: 'approved',
      })

      // Update contact status
      if (contact?.id) {
        await supabase
          .from('ambassador_contacts')
          .update({
            status: 'replied',
            last_activity: `Reply approved and sent (Option ${chosen_option})`,
            last_activity_at: new Date().toISOString(),
          })
          .eq('id', contact.id)
      }
    }

    return NextResponse.json({ success: true, status: newStatus })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Send failed' }, { status: 500 })
  }
}
