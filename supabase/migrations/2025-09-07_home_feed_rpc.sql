-- 1) RPC: get_home_feed
-- Returns events related to the viewer (organizer or ticket-holder),
-- plus organizer display_name, compact ticket tiers, and recent posts (limit param).
create or replace function public.get_home_feed(p_user_id uuid, p_post_limit int default 3)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  start_at timestamptz,
  end_at timestamptz,
  venue text,
  city text,
  cover_image_url text,
  created_by uuid,
  visibility event_visibility,
  organizer_display_name text,
  ticket_tiers jsonb,
  recent_posts jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with related_events as (
    select e.*
    from public.events e
    where
      -- Anonymous viewers: only public events
      (p_user_id is null and e.visibility = 'public')
      or
      -- Authenticated viewers: organizer or ticket-holder
      (p_user_id is not null and (
        e.created_by = p_user_id
        or exists (
          select 1
          from public.tickets t
          where t.event_id = e.id
            and t.owner_user_id = p_user_id
            and t.status = 'issued'
        )
      ))
  )
  select
    e.id,
    e.title,
    e.description,
    e.category,
    e.start_at,
    e.end_at,
    e.venue,
    e.city,
    e.cover_image_url,
    e.created_by,
    e.visibility,
    up.display_name as organizer_display_name,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', tt.id,
        'name', tt.name,
        'price_cents', tt.price_cents,
        'badge_label', tt.badge_label,
        'quantity', tt.quantity
      ) order by tt.sort_index nulls last, tt.created_at)
      from public.ticket_tiers tt
      where tt.event_id = e.id and tt.status = 'active'
    ), '[]'::jsonb) as ticket_tiers,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'text', p.text,
        'media_urls', coalesce(p.media_urls, '{}'::text[])::jsonb,
        'created_at', p.created_at,
        'like_count', p.like_count,
        'comment_count', p.comment_count,
        'author_display_name', a.display_name,
        'author_user_id', p.author_user_id,
        'is_organizer', (p.author_user_id = e.created_by)
      ) order by p.created_at desc)
      from (
        select p2.*
        from public.event_posts p2
        where p2.event_id = e.id and p2.deleted_at is null
        order by p2.created_at desc
        limit least(coalesce(p_post_limit, 3), 50)
      ) p
      join public.user_profiles a on a.user_id = p.author_user_id
    ), '[]'::jsonb) as recent_posts
  from related_events e
  left join public.user_profiles up on up.user_id = e.created_by
  order by e.start_at asc;
$$;

-- 2) Permissions for the RPC
grant execute on function public.get_home_feed(uuid, int) to anon, authenticated;

-- 3) Helpful indexes (idempotent)
create index if not exists idx_tickets_owner_status_event on public.tickets(owner_user_id, status, event_id);
create index if not exists idx_event_posts_event_created on public.event_posts(event_id, created_at desc);
create index if not exists idx_ticket_tiers_event_sort on public.ticket_tiers(event_id, status, sort_index);

-- 4) Realtime for posts (safe if already added)
alter publication supabase_realtime add table public.event_posts;
