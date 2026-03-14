create table if not exists public.nakshathram_profiles (
  user_id text primary key,
  display_name text not null,
  password_hash text,
  password_enabled boolean not null default false,
  collection_consent boolean not null default false,
  local_learning_enabled boolean not null default false,
  cloud_sync_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nakshathram_typing_events (
  client_event_id text primary key,
  user_id text not null references public.nakshathram_profiles(user_id) on delete cascade,
  language text not null,
  roman_input text not null,
  roman_lower text not null,
  roman_signature text not null,
  native_word text not null,
  source text not null,
  device_id text,
  client_version text,
  note_path text,
  created_at timestamptz not null default now()
);

create index if not exists idx_nakshathram_typing_events_language_roman
  on public.nakshathram_typing_events (language, roman_lower);

create index if not exists idx_nakshathram_typing_events_language_signature
  on public.nakshathram_typing_events (language, roman_signature);

create index if not exists idx_nakshathram_typing_events_user
  on public.nakshathram_typing_events (user_id, created_at desc);

alter table public.nakshathram_profiles enable row level security;
alter table public.nakshathram_typing_events enable row level security;

drop policy if exists "profiles_select_public" on public.nakshathram_profiles;
create policy "profiles_select_public"
  on public.nakshathram_profiles
  for select
  to anon
  using (true);

drop policy if exists "profiles_upsert_public" on public.nakshathram_profiles;
create policy "profiles_upsert_public"
  on public.nakshathram_profiles
  for insert
  to anon
  with check (true);

drop policy if exists "profiles_update_public" on public.nakshathram_profiles;
create policy "profiles_update_public"
  on public.nakshathram_profiles
  for update
  to anon
  using (true)
  with check (true);

drop policy if exists "typing_events_select_public" on public.nakshathram_typing_events;
create policy "typing_events_select_public"
  on public.nakshathram_typing_events
  for select
  to anon
  using (true);

drop policy if exists "typing_events_insert_public" on public.nakshathram_typing_events;
create policy "typing_events_insert_public"
  on public.nakshathram_typing_events
  for insert
  to anon
  with check (true);

drop policy if exists "typing_events_update_public" on public.nakshathram_typing_events;
create policy "typing_events_update_public"
  on public.nakshathram_typing_events
  for update
  to anon
  using (true)
  with check (true);
