-- Table for comment likes (similar to event_reactions for posts)
CREATE TABLE IF NOT EXISTS public.event_comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.event_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('like')),
  created_at timestamp with time zone DEFAULT now()
);

-- One like per user per comment
CREATE UNIQUE INDEX IF NOT EXISTS uniq_comment_like
  ON public.event_comment_reactions (comment_id, user_id, kind);

-- Helpful index for aggregations
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id
  ON public.event_comment_reactions (comment_id);

-- Enable RLS
ALTER TABLE public.event_comment_reactions ENABLE ROW LEVEL SECURITY;

-- Allow logged-in users to like/unlike
CREATE POLICY "comment_reacts_insert_own"
  ON public.event_comment_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_reacts_delete_own"
  ON public.event_comment_reactions FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "comment_reacts_read_all"
  ON public.event_comment_reactions FOR SELECT
  USING (true);