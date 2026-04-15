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

-- Chat sessions
create table if not exists chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  title      text not null default 'New Chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table chats enable row level security;

create policy "Users can manage own chats"
  on chats for all
  using (auth.uid() = user_id);

-- Auto-update chats.updated_at when a new message is added
create or replace function touch_chat_updated_at()
returns trigger language plpgsql as $$
begin
  update chats set updated_at = now() where id = NEW.chat_id;
  return NEW;
end;
$$;

create trigger messages_touch_chat
  after insert on messages
  for each row when (NEW.chat_id is not null)
  execute procedure touch_chat_updated_at();

-- Chat messages
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('user', 'ai')),
  content    text not null,
  verse_data jsonb,
  chat_id    uuid references chats(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists messages_chat_id_idx on messages(chat_id, created_at);

alter table messages enable row level security;

create policy "Users can manage own messages"
  on messages for all
  using (auth.uid() = user_id);

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
