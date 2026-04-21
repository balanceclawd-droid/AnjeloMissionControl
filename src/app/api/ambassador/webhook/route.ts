import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// Smartlead sends POST when a prospect replies to an email
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Smartlead webhook payload structure
    const {
      campaign_id,
      lead_id,
      email_id,
      from_email,
      to_email,
      subject,
      thread_id,
      email_body,
    } = body

    // Find contact by smartlead lead ID
    const { data: contact } = await supabase
      .from('ambassador_contacts')
      .select('id, email, campaign_id')
      .eq('smartlead_lead_id', String(lead_id))
      .maybeSingle()

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found for lead' }, { status: 404 })
    }

    // Save thread entry
    await supabase.from('ambassador_threads').insert({
      contact_id: contact.id,
      direction: 'inbound',
      subject: subject || null,
      body: email_body || '',
    })

    // Create reply record for draft generation
    const { data: reply, error: replyError } = await supabase
      .from('ambassador_replies')
      .insert({
        contact_id: contact.id,
        campaign_id: contact.campaign_id,
        thread_text: email_body || '',
        status: 'pending',
      })
      .select()
      .maybeSingle()

    if (replyError) {
      console.error('Webhook reply insert error:', replyError)
      return NextResponse.json({ error: replyError.message }, { status: 500 })
    }

    return NextResponse.json({ received: true, reply_id: reply?.id })
  } catch (e) {
    console.error('Webhook error:', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
