-- ============================================================
-- AMBASSADOR OUTREACH SYSTEM — Full Schema
-- Run this in Supabase SQL Editor (Settings → SQL Editor)
-- ============================================================

-- Contacts table
create table if not exists ambassador_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  company text,
  role text,
  notes text,
  status text not null default 'new' check (status in ('new', 'contacted', 'replied', 'interested', 'not_interested', 'converted')),
  campaign_id uuid,
  smartlead_lead_id text,
  last_activity text,
  next_step text,
  linkedin_url text,
  twitter_url text,
  website_url text,
  twitch_url text,
  youtube_url text,
  tiktok_url text,
  instagram_url text,
  discord_url text,
  last_activity_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaigns table
create table if not exists ambassador_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  smartlead_campaign_id text,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'completed')),
  step1_template text,
  step2_template text,
  step3_template text,
  schedule_days text[],
  schedule_time text,
  timezone text default 'Europe/London',
  launched_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Replies table (inbox)
create table if not exists ambassador_replies (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references ambassador_contacts(id) on delete cascade,
  campaign_id uuid references ambassador_campaigns(id) on delete set null,
  thread_text text,
  draft_a text,
  draft_b text,
  status text not null default 'pending' check (status in ('pending', 'approved_a', 'approved_b', 'edited_a', 'edited_b', 'discarded')),
  received_at timestamptz default now(),
  processed_at timestamptz,
  created_at timestamptz default now()
);

-- Thread history
create table if not exists ambassador_threads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references ambassador_contacts(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body text not null,
  sent_at timestamptz default now()
);

-- Settings
create table if not exists ambassador_settings (
  id uuid primary key default gen_random_uuid(),
  opportunity_brief text not null default '',
  default_timezone text not null default 'Europe/London',
  send_window_start text not null default '09:00',
  send_window_end text not null default '17:00',
  webhook_url text not null default '/api/ambassador/webhook',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tone examples (from approved replies)
create table if not exists ambassador_tone_examples (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  source text not null default 'manual' check (source in ('approved', 'manual')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table ambassador_contacts enable row level security;
alter table ambassador_campaigns enable row level security;
alter table ambassador_replies enable row level security;
alter table ambassador_threads enable row level security;
alter table ambassador_settings enable row level security;
alter table ambassador_tone_examples enable row level security;

create policy "Public rw ambassador_contacts" on ambassador_contacts for all using (true) with check (true);
create policy "Public rw ambassador_campaigns" on ambassador_campaigns for all using (true) with check (true);
create policy "Public rw ambassador_replies" on ambassador_replies for all using (true) with check (true);
create policy "Public rw ambassador_threads" on ambassador_threads for all using (true) with check (true);
create policy "Public rw ambassador_settings" on ambassador_settings for all using (true) with check (true);
create policy "Public rw ambassador_tone_examples" on ambassador_tone_examples for all using (true) with check (true);
