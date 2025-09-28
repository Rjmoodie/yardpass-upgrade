-- Clear all reactions and reset counts completely
DELETE FROM public.event_reactions;
UPDATE public.event_posts SET like_count = 0, comment_count = 0;
UPDATE public.event_video_counters SET likes = 0, comments = 0, shares = 0;