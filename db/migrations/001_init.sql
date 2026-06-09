create extension if not exists "pgcrypto";

create table if not exists app_user (
  id            uuid primary key,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

create table if not exists recommendation (
  id                uuid primary key default gen_random_uuid(),
  business_name     text not null,
  category          text not null,
  note              text,
  created_by        uuid not null references app_user(id),
  endorsement_count int  not null default 0,
  search_vector     tsvector,
  created_at        timestamptz not null default now()
);

create unique index if not exists uq_recommendation_business_category
  on recommendation (lower(business_name), category);
create index if not exists idx_recommendation_category
  on recommendation (category);
create index if not exists idx_recommendation_search
  on recommendation using gin (search_vector);

create table if not exists endorsement (
  id                 uuid primary key default gen_random_uuid(),
  recommendation_id  uuid not null references recommendation(id) on delete cascade,
  user_id            uuid not null references app_user(id),
  created_at         timestamptz not null default now(),
  unique (recommendation_id, user_id)
);

create or replace function recommendation_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.business_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.note,'')), 'C');
  return new;
end
$$ language plpgsql;

drop trigger if exists trg_recommendation_search on recommendation;
create trigger trg_recommendation_search
  before insert or update on recommendation
  for each row execute function recommendation_search_trigger();

create or replace function endorsement_count_trigger() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update recommendation set endorsement_count = endorsement_count + 1
      where id = new.recommendation_id;
  elsif (tg_op = 'DELETE') then
    update recommendation set endorsement_count = endorsement_count - 1
      where id = old.recommendation_id;
  end if;
  return null;
end
$$ language plpgsql;

drop trigger if exists trg_endorsement_count on endorsement;
create trigger trg_endorsement_count
  after insert or delete on endorsement
  for each row execute function endorsement_count_trigger();
