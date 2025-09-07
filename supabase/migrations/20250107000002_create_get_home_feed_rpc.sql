-- Create RPC function for home feed
-- This function returns events with their recent posts for the home feed

create or replace function public.get_home_feed(
  p_user_id uuid,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  cover_image_url text,
  start_at timestamptz,
  end_at timestamptz,
  venue text,
  city text,
  created_by uuid,
  total_posts bigint,
  total_comments bigint,
  recent_posts jsonb
)
language plpgsql
security definer
as $$
begin
  return query
  with user_events as (
    -- Get events where user is organizer or has tickets
    select distinct e.id
    from public.events e
    where (
      e.visibility = 'public'
      or e.created_by = p_user_id
      or exists (
        select 1 
        from public.tickets t 
        where t.event_id = e.id 
          and t.owner_user_id = p_user_id 
          and t.status in ('issued','transferred','redeemed')
      )
    )
  ),
  event_posts_summary as (
    select 
      ep.event_id,
      count(*) as total_posts,
      sum(ep.comment_count) as total_comments,
      jsonb_agg(
        jsonb_build_object(
          'id', ep.id,
          'authorName', up.display_name,
          'authorUserId', ep.author_user_id,
          'isOrganizer', ep.author_user_id = e.created_by,
          'content', ep.text,
          'mediaUrls', ep.media_urls,
          'likes', ep.like_count,
          'commentCount', ep.comment_count,
          'createdAt', ep.created_at
        ) order by ep.created_at desc
      ) filter (where ep.id is not null) as recent_posts
    from public.event_posts ep
    join public.events e on e.id = ep.event_id
    left join public.user_profiles up on up.user_id = ep.author_user_id
    where ep.event_id in (select id from user_events)
    group by ep.event_id
  )
  select 
    e.id,
    e.title,
    e.description,
    e.category,
    e.cover_image_url,
    e.start_at,
    e.end_at,
    e.venue,
    e.city,
    e.created_by,
    coalesce(eps.total_posts, 0) as total_posts,
    coalesce(eps.total_comments, 0) as total_comments,
    coalesce(eps.recent_posts, '[]'::jsonb) as recent_posts
  from public.events e
  left join event_posts_summary eps on eps.event_id = e.id
  where e.id in (select id from user_events)
  order by e.start_at asc
  limit p_limit
  offset p_offset;
end;
$$;
