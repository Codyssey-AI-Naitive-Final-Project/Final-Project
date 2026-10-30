-- Run this migration in the Supabase SQL Editor to enable account-based workout plans.
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null check (activity_type in ('RUN', 'FOOTBALL', 'STRENGTH', 'OTHER')),
  title text not null check (char_length(title) between 1 and 100),
  planned_date date not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  distance_km numeric(7,2) check (distance_km is null or distance_km between 0.1 and 1000),
  note text check (note is null or char_length(note) <= 250),
  created_at timestamptz not null default now()
);

alter table public.workout_plans enable row level security;
revoke all on public.workout_plans from anon;
grant select, insert, update, delete on public.workout_plans to authenticated;

drop policy if exists "Users can read own workout plans" on public.workout_plans;
create policy "Users can read own workout plans" on public.workout_plans
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert own workout plans" on public.workout_plans;
create policy "Users can insert own workout plans" on public.workout_plans
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update own workout plans" on public.workout_plans;
create policy "Users can update own workout plans" on public.workout_plans
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own workout plans" on public.workout_plans;
create policy "Users can delete own workout plans" on public.workout_plans
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists workout_plans_user_date_idx
  on public.workout_plans (user_id, planned_date asc);
