-- Set proper replica identity for real-time updates
ALTER TABLE public.event_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.event_comments REPLICA IDENTITY FULL;  
ALTER TABLE public.event_posts REPLICA IDENTITY FULL;
ALTER TABLE public.follows REPLICA IDENTITY FULL;

-- Drop any existing conflicting triggers first
DROP TRIGGER IF EXISTS event_reactions_like_count_trigger ON public.event_reactions;
DROP TRIGGER IF EXISTS event_comments_count_trigger ON public.event_comments;
DROP TRIGGER IF EXISTS inc_like_count_trigger ON public.event_reactions;
DROP TRIGGER IF EXISTS inc_comment_count_trigger ON public.event_comments;

-- Create proper triggers for automatic count updates
CREATE TRIGGER event_reactions_bump_like_count
    AFTER INSERT OR DELETE ON public.event_reactions
    FOR EACH ROW
    EXECUTE FUNCTION public._bump_like_count();

CREATE TRIGGER event_comments_bump_comment_count  
    AFTER INSERT OR DELETE ON public.event_comments
    FOR EACH ROW
    EXECUTE FUNCTION public._bump_comment_count();

-- Ensure the count columns are properly initialized for existing data
UPDATE public.event_posts 
SET like_count = (
    SELECT COUNT(*)::integer 
    FROM public.event_reactions r 
    WHERE r.post_id = event_posts.id AND r.kind = 'like'
)
WHERE like_count != (
    SELECT COUNT(*)::integer 
    FROM public.event_reactions r 
    WHERE r.post_id = event_posts.id AND r.kind = 'like'
);

UPDATE public.event_posts 
SET comment_count = (
    SELECT COUNT(*)::integer 
    FROM public.event_comments c 
    WHERE c.post_id = event_posts.id
)
WHERE comment_count != (
    SELECT COUNT(*)::integer 
    FROM public.event_comments c 
    WHERE c.post_id = event_posts.id
);