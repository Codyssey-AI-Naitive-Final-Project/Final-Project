-- Run this migration in the Supabase SQL Editor.
create table if not exists public.activity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('RUN', 'FOOTBALL', 'OTHER')),
  title text not null check (char_length(title) between 1 and 100),
  distance_km numeric(7,2) check (distance_km is null or distance_km between 0.1 and 1000),
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  rpe integer not null check (rpe between 1 and 10),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.activity_records enable row level security;
revoke all on public.activity_records from anon;
grant select, insert, update, delete on public.activity_records to authenticated;

drop policy if exists "Users can read own activity records" on public.activity_records;
create policy "Users can read own activity records" on public.activity_records
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own activity records" on public.activity_records;
create policy "Users can insert own activity records" on public.activity_records
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own activity records" on public.activity_records;
create policy "Users can update own activity records" on public.activity_records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own activity records" on public.activity_records;
create policy "Users can delete own activity records" on public.activity_records
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists activity_records_user_occurred_idx
  on public.activity_records (user_id, occurred_at desc);

create table if not exists public.coach_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text check (goal is null or char_length(goal) <= 120),
  experience text check (experience is null or experience in ('초보', '중급', '숙련')),
  updated_at timestamptz not null default now()
);

alter table public.coach_profiles enable row level security;
revoke all on public.coach_profiles from anon;
grant select, insert, update, delete on public.coach_profiles to authenticated;
drop policy if exists "Users can manage own coach profile" on public.coach_profiles;
create policy "Users can manage own coach profile" on public.coach_profiles
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
