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

    if (TOKEN && smartleadCampaignId) {
      // Campaign already linked — just add new leads
      await addLeadsToSmartlead(smartleadCampaignId, contacts)
    } else if (TOKEN) {
      // 1. Create Smartlead campaign
      const newId = await createSmartleadCampaign(campaign.name)
      if (!newId) {
        return NextResponse.json({ error: 'Failed to create Smartlead campaign' }, { status: 500 })
      }
      smartleadCampaignId = newId

      // 2. Add sequences (steps)
      await addSequencesToSmartlead(smartleadCampaignId, campaign)

      // 3. Set schedule
      await setSmartleadSchedule(smartleadCampaignId, campaign)

      // 4. Pause campaign (must be paused to configure), then add leads
      await pauseSmartleadCampaign(smartleadCampaignId)
      await addLeadsToSmartlead(smartleadCampaignId, contacts)

      // 5. Activate
      await activateSmartleadCampaign(smartleadCampaignId)
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
  } catch (e) {
    console.error('Launch error:', e)
    return NextResponse.json({ error: 'Launch failed' }, { status: 500 })
  }
}

async function createSmartleadCampaign(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SMARTLEAD_BASE}/campaigns/create?api_key=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return String(data.id)
  } catch {
    return null
  }
}

async function addSequencesToSmartlead(campaignId: string, campaign: Record<string, unknown>) {
  const steps = [
    { num: 1, body: campaign.step1_template as string, delay: 0 },
    { num: 2, body: campaign.step2_template as string, delay: 3 },
    { num: 3, body: campaign.step3_template as string, delay: 7 },
  ].filter(s => s.body && s.body.trim())

  if (!steps.length) return

  const sequences = steps.map((s, i) => ({
    id: null,
    seq_number: i + 1,
    subject: s.num === 1 ? 'Following up' : '',
    email_body: s.body,
    seq_delay_details: { delay_in_days: s.delay },
  }))

  try {
    await fetch(
      `${SMARTLEAD_BASE}/campaigns/${campaignId}/sequences?api_key=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequences }),
      }
    )
  } catch (e) {
    console.error('Sequences error:', e)
  }
}

async function setSmartleadSchedule(campaignId: string, campaign: Record<string, unknown>) {
  const scheduleDays = (campaign.schedule_days as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri']
  const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
  const daysOfWeek = scheduleDays.map(d => dayMap[d] ?? 1)

  try {
    await fetch(
      `${SMARTLEAD_BASE}/campaigns/${campaignId}/schedule?api_key=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timezone: campaign.timezone || 'Europe/London',
          days_of_the_week: daysOfWeek,
          start_hour: campaign.schedule_time ? campaign.schedule_time.split(':')[0] + ':00' : '09:00',
          end_hour: '17:00',
          min_time_btw_emails: 30,
          max_leads_per_day: 50,
        }),
      }
    )
  } catch (e) {
    console.error('Schedule error:', e)
  }
}

async function pauseSmartleadCampaign(campaignId: string) {
  try {
    await fetch(
      `${SMARTLEAD_BASE}/campaigns/${campaignId}/status?api_key=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAUSED' }),
      }
    )
  } catch (e) {
    console.error('Pause error:', e)
  }
}

async function activateSmartleadCampaign(campaignId: string) {
  try {
    await fetch(
      `${SMARTLEAD_BASE}/campaigns/${campaignId}/status?api_key=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' }),
      }
    )
  } catch (e) {
    console.error('Activate error:', e)
  }
}

async function addLeadsToSmartlead(campaignId: string, contacts: Array<{ email: string; name: string; company: string; role: string }> | null) {
  if (!contacts?.length) return

  const leadsPayload = contacts.map(c => ({
    email: c.email,
    first_name: c.name?.split(' ')[0] || '',
    last_name: c.name?.split(' ').slice(1).join(' ') || '',
    company_name: c.company || '',
    role: c.role || '',
  }))

  try {
    await fetch(
      `${SMARTLEAD_BASE}/campaigns/${campaignId}/leads?api_key=${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadsPayload),
      }
    )
  } catch (e) {
    console.error('Add leads error:', e)
  }
}