-- Add client_id column for idempotency
ALTER TABLE public.event_comments ADD COLUMN IF NOT EXISTS client_id text;

-- Create unique constraint to prevent duplicate client submissions
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comment_client
ON public.event_comments(post_id, author_user_id, client_id)
WHERE client_id IS NOT NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_comments_post_id ON public.event_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_created_at ON public.event_comments(created_at);

-- Function to atomically maintain comment counts
CREATE OR REPLACE FUNCTION public.handle_comment_count_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts SET comment_count = COALESCE(comment_count,0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE event_posts SET comment_count = GREATEST(COALESCE(comment_count,0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;