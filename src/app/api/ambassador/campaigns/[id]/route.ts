import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

const SMARTLEAD_BASE = 'https://server.smartlead.ai/api/v1'
const TOKEN = process.env.SMARTLEAD_API_KEY

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    const allowed = ['name', 'step1_template', 'step2_template', 'step3_template', 'schedule_days', 'schedule_time', 'timezone', 'status']
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data: campaign, error: fetchError } = await supabase
      .from('ambassador_campaigns')
      .select('*')
      .eq('id', params.id)
      .maybeSingle()

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Update local DB
    const { data, error } = await supabase
      .from('ambassador_campaigns')
      .update(updates)
      .eq('id', params.id)
      .select()
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    // Sync to Smartlead if linked
    if (TOKEN && campaign.smartlead_campaign_id) {
      await syncCampaignToSmartlead(campaign.smartlead_campaign_id, body)
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

async function syncCampaignToSmartlead(smartleadId: string, changes: Record<string, unknown>) {
  // Sync name
  if (changes.name) {
    await fetch(`${SMARTLEAD_BASE}/campaigns/${smartleadId}?api_key=${TOKEN}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: changes.name }),
    }).catch(console.error)
  }

  // Sync sequences (step templates)
  const steps = [
    { num: 1, body: changes.step1_template as string, delay: 0 },
    { num: 2, body: changes.step2_template as string, delay: 3 },
    { num: 3, body: changes.step3_template as string, delay: 7 },
  ].filter(s => s.body && s.body.trim())

  if (steps.length > 0) {
    const sequences = steps.map((s, i) => ({
      id: null,
      seq_number: i + 1,
      subject: s.num === 1 ? 'Following up' : '',
      email_body: s.body,
      seq_delay_details: { delay_in_days: s.delay },
    }))

    await fetch(`${SMARTLEAD_BASE}/campaigns/${smartleadId}/sequences?api_key=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequences }),
    }).catch(console.error)
  }

  // Sync schedule
  if (changes.schedule_days || changes.schedule_time || changes.timezone) {
    const dayMap: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
    const scheduleDays = (changes.schedule_days as string[]) || ['mon', 'tue', 'wed', 'thu', 'fri']
    const daysOfWeek = scheduleDays.map(d => dayMap[d] ?? 1)

    await fetch(`${SMARTLEAD_BASE}/campaigns/${smartleadId}/schedule?api_key=${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timezone: (changes.timezone as string) || 'Europe/London',
        days_of_the_week: daysOfWeek,
        start_hour: ((changes.schedule_time as string) || '09:00').split(':')[0] + ':00',
        end_hour: '17:00',
        min_time_btw_emails: 30,
        max_leads_per_day: 50,
      }),
    }).catch(console.error)
  }
}