import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const SMARTLEAD_API = 'https://server.smartlead.ai/api/v1'
const SMARTLEAD_TOKEN = process.env.SMARTLEAD_API_KEY

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id

    // Fetch campaign
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

    // Call Smartlead to create campaign
    let smartleadCampaignId = campaign.smartlead_campaign_id

    if (!smartleadCampaignId && SMARTLEAD_TOKEN) {
      try {
        const slRes = await fetch(`${SMARTLEAD_API}/campaigns`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SMARTLEAD_TOKEN}`,
          },
          body: JSON.stringify({
            name: campaign.name,
            client_ids: [],
            timezone: campaign.timezone || 'Europe/London',
          }),
        })

        if (slRes.ok) {
          const slData = await slRes.json()
          smartleadCampaignId = String(slData.id)
        }
      } catch {
        // Smartlead creation failed — continue without it
      }
    }

    // Update campaign status and smartlead ID
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
        .update({ status: 'contacted', last_activity: `Added to campaign: ${campaign.name}`, last_activity_at: new Date().toISOString() })
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
