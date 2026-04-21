-- Ambassador Outreach System — Extended Schema
-- Run AFTER 006_ambassador.sql

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

-- Thread history
create table if not exists ambassador_threads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references ambassador_contacts(id) on delete cascade,
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text,
  body text not null,
  sent_at timestamptz not null default now()
);

-- Tone examples (from approved replies)
create table if not exists ambassador_tone_examples (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  source text not null default 'manual' check (source in ('approved', 'manual')),
  created_at timestamptz not null default now()
);

-- Add columns to ambassador_contacts if not present
alter table ambassador_contacts add column if not exists smartlead_lead_id text;

-- Add columns to ambassador_replies if not present
alter table ambassador_replies add column if not exists draft_a text;
alter table ambassador_replies add column if not exists draft_b text;

-- RLS
alter table ambassador_settings enable row level security;
alter table ambassador_threads enable row level security;
alter table ambassador_tone_examples enable row level security;

create policy "Public rw ambassador_settings" on ambassador_settings for all using (true) with check (true);
create policy "Public rw ambassador_threads" on ambassador_threads for all using (true) with check (true);
create policy "Public rw ambassador_tone_examples" on ambassador_tone_examples for all using (true) with check (true);
