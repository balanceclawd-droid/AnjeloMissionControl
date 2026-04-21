export type ContactStatus = 'new' | 'contacted' | 'replied' | 'interested' | 'not_interested' | 'converted'

export type Contact = {
  id: string
  name: string
  email: string
  company: string
  role: string
  notes: string
  status: ContactStatus
  campaign_id: string | null
  smartlead_lead_id: string | null
  last_activity: string | null
  next_step: string | null
  last_activity_at: string
  created_at: string
  updated_at: string
}

export type Campaign = {
  id: string
  name: string
  smartlead_campaign_id: string | null
  status: 'draft' | 'active' | 'paused' | 'completed'
  step1_template: string
  step2_template: string
  step3_template: string
  schedule_days: string[]
  schedule_time: string
  timezone: string
  launched_at: string | null
  created_at: string
  updated_at: string
}

export type Reply = {
  id: string
  contact_id: string
  campaign_id: string | null
  thread_text: string
  draft_a: string | null
  draft_b: string | null
  status: 'pending' | 'approved_a' | 'approved_b' | 'edited_a' | 'edited_b' | 'discarded'
  received_at: string
  processed_at: string | null
  created_at: string
  contact?: Contact
}

export type DraftReply = {
  id: string
  contact_id: string
  option_a: string
  option_b: string
  status: 'pending' | 'approved' | 'edited' | 'discarded'
  approved_option: 'A' | 'B' | null
  final_body: string | null
  created_at: string
  approved_at: string | null
}

export type AmbassadorSettings = {
  id: string
  opportunity_brief: string
  default_timezone: string
  send_window_start: string
  send_window_end: string
  webhook_url: string
  created_at: string
  updated_at: string
}

export type ToneExample = {
  id: string
  body: string
  source: 'approved' | 'manual'
  created_at: string
}

export type EmailMessage = {
  id: string
  contact_id: string
  direction: 'outbound' | 'inbound'
  subject: string | null
  body: string
  sent_at: string
}
