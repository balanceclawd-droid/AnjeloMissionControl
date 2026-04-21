import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const SMARTLEAD_BASE = 'https://server.smartlead.ai/api/v1'
const TOKEN = process.env.SMARTLEAD_API_KEY

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id

    const { data: campaign, error: campaignError } = await supabase
      .from('ambassador_campaigns')
      .select('*')
      .eq('id', campaignId)
      .maybeSingle()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.status === 'active') {
      return NextResponse.json({ error: 'Campaign is already active' }, { status: 400 })
    }

    // Fetch new contacts assigned to this campaign
    const { data: contacts } = await supabase
      .from('ambassador_contacts')
      .select('id, email, name, company, role')
      .eq('campaign_id', campaignId)
      .eq('status', 'new')
      .limit(200)

    let smartleadCampaignId = campaign.smartlead_campaign_id

    if (TOKEN) {
      // 1. Create Smartlead campaign if not already linked
      if (!smartleadCampaignId) {
        try {
          const createRes = await fetch(
            `${SMARTLEAD_BASE}/campaigns/create?api_key=${TOKEN}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: campaign.name }),
            }
          )

          if (createRes.ok) {
            const createData = await createRes.json()
            smartleadCampaignId = String(createData.id)
          } else {
            const errText = await createRes.text()
            console.error('Smartlead create error:', errText)
          }
        } catch (e) {
          console.error('Smartlead create failed:', e)
        }
      }

      // 2. Add leads to Smartlead campaign
      if (smartleadCampaignId && contacts?.length) {
        const leadsPayload = contacts.map(c => ({
          email: c.email,
          first_name: c.name?.split(' ')[0] || '',
          last_name: c.name?.split(' ').slice(1).join(' ') || '',
          company_name: c.company || '',
        }))

        try {
          await fetch(
            `${SMARTLEAD_BASE}/campaigns/${smartleadCampaignId}/leads?api_key=${TOKEN}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(leadsPayload),
            }
          )
        } catch (e) {
          console.error('Smartlead add leads error:', e)
        }

        // 3. Update campaign settings (sequences, schedule)
        try {
          await fetch(
            `${SMARTLEAD_BASE}/campaigns/${smartleadCampaignId}/settings?api_key=${TOKEN}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: campaign.name,
                max_leads_per_day: 50,
                min_time_btw_emails: 30,
                stop_lead_settings: 'REPLY_TO_AN_EMAIL',
                track_settings: 'DONT_TRACK_EMAIL_OPEN',
              }),
            }
          )
        } catch (e) {
          console.error('Smartlead settings error:', e)
        }
      }
    }

    // Update campaign status
    await supabase
      .from('ambassador_campaigns')
      .update({
        status: 'active',
        smartlead_campaign_id: smartleadCampaignId,
        launched_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    // Update contacts to contacted
    if (contacts?.length) {
      await supabase
        .from('ambassador_contacts')
        .update({
          status: 'contacted',
          smartlead_lead_id: null,
          last_activity: `Launched: ${campaign.name}`,
          last_activity_at: new Date().toISOString(),
        })
        .in('id', contacts.map(c => c.id))
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      smartlead_campaign_id: smartleadCampaignId,
      contacts_added: contacts?.length || 0,
    })
  } catch {
    return NextResponse.json({ error: 'Launch failed' }, { status: 500 })
  }
}