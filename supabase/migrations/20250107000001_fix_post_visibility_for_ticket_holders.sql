-- Fix post visibility: Allow ticket holders to see posts from events they have tickets for
-- This ensures that when someone creates a post, they can see it and others with tickets can see it too

-- Drop the existing restrictive policy
drop policy if exists posts_read_public on public.event_posts;

-- Create a new policy that allows reading posts from:
-- 1. Public events (anyone can see)
-- 2. Events where you're a manager (organizer/admin can see)
-- 3. Events where you have a ticket (ticket holders can see)
create policy posts_read_public_or_related
  on public.event_posts for select
  using (
    exists (
      select 1 
      from public.events e 
      where e.id = event_id 
        and (
          e.visibility = 'public' 
          or public.is_event_manager(e.id)
          or exists (
            select 1 
            from public.tickets t 
            where t.event_id = e.id 
              and t.owner_user_id = auth.uid() 
              and t.status in ('issued','transferred','redeemed')
          )
        )
    )
  );
