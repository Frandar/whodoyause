-- 002: optional contact fields on recommendations + notes on endorsements.
-- Additive and idempotent: nullable columns, no backfill, no trigger changes.
-- Apply via the Supabase SQL editor or: psql "$DATABASE_URL" -f db/migrations/002_contact_and_endorsement_notes.sql

alter table recommendation
  add column if not exists phone        text,
  add column if not exists email        text,
  add column if not exists website      text,
  add column if not exists contact_name text,   -- point of contact ("ask for ...")
  add column if not exists social_link  text;

-- Contact fields are deliberately NOT added to search_vector: nobody searches by
-- phone/website, so the existing recommendation_search_trigger stays unchanged.

alter table endorsement
  add column if not exists note text;
