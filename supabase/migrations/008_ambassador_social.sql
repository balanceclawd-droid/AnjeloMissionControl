-- Add extended social fields to ambassador contacts
alter table ambassador_contacts add column if not exists linkedin_url text;
alter table ambassador_contacts add column if not exists twitter_url text;
alter table ambassador_contacts add column if not exists website_url text;
alter table ambassador_contacts add column if not exists twitch_url text;
alter table ambassador_contacts add column if not exists youtube_url text;
alter table ambassador_contacts add column if not exists tiktok_url text;
alter table ambassador_contacts add column if not exists instagram_url text;
alter table ambassador_contacts add column if not exists discord_url text;
