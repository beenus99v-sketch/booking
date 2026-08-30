-- Run this once in Supabase: SQL Editor -> New query -> Run.
-- This creates a private per-user bookings table for cloud sync.

create table if not exists public.bookings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists bookings_user_id_idx on public.bookings(user_id);
create index if not exists bookings_updated_at_idx on public.bookings(updated_at);

alter table public.bookings enable row level security;

drop policy if exists "Users can read own bookings" on public.bookings;
create policy "Users can read own bookings"
on public.bookings for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own bookings" on public.bookings;
create policy "Users can insert own bookings"
on public.bookings for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own bookings" on public.bookings;
create policy "Users can update own bookings"
on public.bookings for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own bookings" on public.bookings;
create policy "Users can delete own bookings"
on public.bookings for delete
to authenticated
using (auth.uid() = user_id);
