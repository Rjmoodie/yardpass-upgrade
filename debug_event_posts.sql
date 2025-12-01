-- Debug SQL queries to understand event posts and organizer structure
-- Run these in Supabase SQL Editor to diagnose the issue

-- 1. Check the event structure and ownership
SELECT 
    e.id,
    e.title,
    e.created_by,
    e.owner_context_type,
    e.owner_context_id,
    e.visibility
FROM events.events e
WHERE e.id = '28309929-28e7-4bda-af28-6e0b47485ce1';

-- 2. Check all posts for this event and their authors
SELECT 
    ep.id as post_id,
    ep.author_user_id,
    ep.text,
    ep.created_at,
    ep.deleted_at,
    up.display_name as author_name,
    up.username as author_username
FROM events.event_posts ep
LEFT JOIN public.user_profiles up ON up.user_id = ep.author_user_id
WHERE ep.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
    AND ep.deleted_at IS NULL
ORDER BY ep.created_at DESC;

-- 3. Check if event creator matches any post authors
SELECT 
    e.id as event_id,
    e.created_by as event_creator,
    ep.id as post_id,
    ep.author_user_id as post_author,
    CASE 
        WHEN e.created_by = ep.author_user_id THEN 'YES - CREATOR'
        ELSE 'NO'
    END as is_event_creator,
    up.display_name as author_name
FROM events.events e
CROSS JOIN events.event_posts ep
LEFT JOIN public.user_profiles up ON up.user_id = ep.author_user_id
WHERE e.id = '28309929-28e7-4bda-af28-6e0b47485ce1'
    AND ep.event_id = e.id
    AND ep.deleted_at IS NULL
ORDER BY ep.created_at DESC;

-- 4. Check organization membership if event is org-owned
SELECT 
    e.id as event_id,
    e.owner_context_type,
    e.owner_context_id as org_id,
    o.name as org_name,
    om.user_id as org_member_id,
    up.display_name as member_name,
    up.username as member_username,
    om.role as member_role
FROM events.events e
LEFT JOIN organizations.organizations o ON o.id = e.owner_context_id
LEFT JOIN public.org_memberships om ON om.org_id = e.owner_context_id
LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
WHERE e.id = '28309929-28e7-4bda-af28-6e0b47485ce1'
ORDER BY om.role, up.display_name;

-- 5. Check if post authors are organization members (for org-owned events)
SELECT 
    ep.id as post_id,
    ep.author_user_id as post_author_id,
    up.display_name as post_author_name,
    e.owner_context_type,
    e.owner_context_id as org_id,
    CASE 
        WHEN e.owner_context_type = 'organization' AND e.owner_context_id IS NOT NULL THEN
            CASE 
                WHEN EXISTS (
                    SELECT 1 FROM public.org_memberships om 
                    WHERE om.org_id = e.owner_context_id 
                    AND om.user_id = ep.author_user_id
                ) THEN 'YES - ORG MEMBER'
                WHEN e.created_by = ep.author_user_id THEN 'YES - EVENT CREATOR'
                ELSE 'NO - NOT MEMBER OR CREATOR'
            END
        WHEN e.owner_context_type = 'individual' THEN
            CASE 
                WHEN e.owner_context_id = ep.author_user_id THEN 'YES - INDIVIDUAL OWNER'
                WHEN e.created_by = ep.author_user_id THEN 'YES - EVENT CREATOR'
                ELSE 'NO'
            END
        ELSE
            CASE 
                WHEN e.created_by = ep.author_user_id THEN 'YES - EVENT CREATOR'
                ELSE 'NO'
            END
    END as is_organizer,
    e.created_by as event_creator_id,
    e.owner_context_id as owner_context_id
FROM events.event_posts ep
JOIN events.events e ON e.id = ep.event_id
LEFT JOIN public.user_profiles up ON up.user_id = ep.author_user_id
WHERE ep.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
    AND ep.deleted_at IS NULL
ORDER BY ep.created_at DESC;

-- 6. Summary: Count organizer vs attendee posts
WITH post_status AS (
    SELECT 
        ep.id as post_id,
        ep.author_user_id,
        e.created_by,
        e.owner_context_type,
        e.owner_context_id,
        CASE 
            WHEN e.created_by = ep.author_user_id THEN true
            WHEN e.owner_context_type = 'individual' AND e.owner_context_id = ep.author_user_id THEN true
            WHEN e.owner_context_type = 'organization' AND e.owner_context_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.org_memberships om 
                WHERE om.org_id = e.owner_context_id 
                AND om.user_id = ep.author_user_id
            ) THEN true
            ELSE false
        END as is_organizer
    FROM events.event_posts ep
    JOIN events.events e ON e.id = ep.event_id
    WHERE ep.event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
        AND ep.deleted_at IS NULL
)
SELECT 
    is_organizer,
    COUNT(*) as post_count,
    STRING_AGG(post_id::text, ', ') as post_ids
FROM post_status
GROUP BY is_organizer;

