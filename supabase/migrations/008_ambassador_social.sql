-- Add social fields to ambassador contacts
alter table ambassador_contacts add column if not exists linkedin_url text;
alter table ambassador_contacts add column if not exists twitter_url text;
alter table ambassador_contacts add column if not exists website_url text;
