-- Final security fixes

-- 1. Enable RLS on cultural_guides table
alter table public.cultural_guides enable row level security;

-- 2. Remove the problematic views that expose auth.users
-- These views cross-join with auth.users which exposes user data
drop view if exists public.user_can_post_event_v;
drop view if exists public.user_event_badge_v;

-- 3. Create secure replacement functions instead of views
create or replace function public.get_user_event_badge(p_user_id uuid, p_event_id uuid)
returns text
language sql stable 
set search_path = public
security definer
as $$
  select tt.badge_label
  from public.tickets t
  join public.ticket_tiers tt on tt.id = t.tier_id
  where t.owner_user_id = p_user_id 
    and t.event_id = p_event_id
    and t.status in ('issued','transferred','redeemed')
  order by tt.price_cents desc nulls last, tt.sort_index asc
  limit 1;
$$;

-- Grant execute permission to authenticated users only
grant execute on function public.get_user_event_badge(uuid, uuid) to authenticated;