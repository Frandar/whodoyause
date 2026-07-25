-- 003: "suggest an edit" — neighbors propose corrections (e.g. a wrong phone or
-- email); founders review and apply them manually. Users never edit the live
-- recommendation directly. This table is the founders' review queue.
-- Apply via the Supabase SQL editor or: psql "$DATABASE_URL" -f db/migrations/003_edit_suggestion.sql

create table if not exists edit_suggestion (
  id                uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references recommendation(id) on delete cascade,
  suggested_by      uuid not null references app_user(id),
  message           text,                              -- optional "what's wrong" note
  proposed          jsonb not null default '{}'::jsonb, -- corrected fields the neighbor supplied
  created_at        timestamptz not null default now()
);

create index if not exists idx_edit_suggestion_recommendation on edit_suggestion (recommendation_id);
create index if not exists idx_edit_suggestion_created on edit_suggestion (created_at desc);
