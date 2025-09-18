-- Just set proper replica identity for real-time updates (the most critical part)
ALTER TABLE public.event_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.event_comments REPLICA IDENTITY FULL;  
ALTER TABLE public.event_posts REPLICA IDENTITY FULL;
ALTER TABLE public.follows REPLICA IDENTITY FULL;