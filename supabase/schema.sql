-- Run this in your Supabase SQL editor

-- Profiles table
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  deity       text,
  source      text,
  language    text default 'English',
  onboarded   boolean default false,
  created_at  timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;

create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Optional: Saved verses table (for future use)
create table if not exists saved_verses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  chapter     int,
  verse       int,
  sanskrit    text,
  translation text,
  note        text,
  saved_at    timestamptz default now()
);

alter table saved_verses enable row level security;

create policy "Users can manage own saved verses"
  on saved_verses for all
  using (auth.uid() = user_id);
