-- Ambassador Outreach System Schema
-- Run this in your Supabase SQL editor

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
  last_activity text,
  next_step text,
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
  contact_id uuid references ambassador_contacts(id),
  campaign_id uuid references ambassador_campaigns(id),
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
  contact_id uuid references ambassador_contacts(id),
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body text not null,
  sent_at timestamptz default now()
);

-- RLS policies
alter table ambassador_contacts enable row level security;
alter table ambassador_campaigns enable row level security;
alter table ambassador_replies enable row level security;
alter table ambassador_threads enable row level security;

create policy "Public read-write ambassador" on ambassador_contacts for all using (true) with check (true);
create policy "Public read-write ambassador" on ambassador_campaigns for all using (true) with check (true);
create policy "Public read-write ambassador" on ambassador_replies for all using (true) with check (true);
create policy "Public read-write ambassador" on ambassador_threads for all using (true) with check (true);
