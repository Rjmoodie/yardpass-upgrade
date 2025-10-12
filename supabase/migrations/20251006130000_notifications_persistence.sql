-- Create notifications table to persist in-app and push notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null check (type in ('success', 'error', 'warning', 'info')),
  action_url text,
  event_type text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

comment on table public.notifications is 'Stores in-app notification history and delivery metadata for each user.';

alter table public.notifications enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their notifications" on public.notifications;
drop policy if exists "Users can insert their notifications" on public.notifications;
drop policy if exists "Users can update their notifications" on public.notifications;
drop policy if exists "Users can delete their notifications" on public.notifications;

-- Create policies
create policy "Users can view their notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their notifications"
  on public.notifications
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their notifications"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their notifications"
  on public.notifications
  for delete
  using (auth.uid() = user_id);
