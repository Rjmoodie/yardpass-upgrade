-- Extend follow graph to support user follows and messaging relationships
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_status') THEN
    CREATE TYPE follow_status AS ENUM ('pending', 'accepted', 'declined');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_target') THEN
    -- Add user target type if missing
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumlabel = 'user'
        AND enumtypid = 'follow_target'::regtype
    ) THEN
      ALTER TYPE follow_target ADD VALUE 'user';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_actor') THEN
    CREATE TYPE follow_actor AS ENUM ('user', 'organization');
  END IF;
END $$;

ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS follower_type follow_actor NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS follower_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status follow_status NOT NULL DEFAULT 'accepted';

-- Ensure uniqueness now considers actor type and org follower
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'follows'
      AND indexname = 'idx_follows_user_target'
  ) THEN
    -- keep for compatibility
    NULL;
  END IF;
END $$;

-- Rebuild unique constraint if legacy exists
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_user_id_target_type_target_id_key;
ALTER TABLE public.follows ADD CONSTRAINT follows_actor_unique UNIQUE (follower_type, follower_user_id, follower_org_id, target_type, target_id);

-- Backfill statuses for existing follows
UPDATE public.follows SET status = 'accepted' WHERE status IS NULL;

-- Policies: allow actors to manage their requests
CREATE POLICY "follows_update_actor" ON public.follows
FOR UPDATE USING (
  CASE
    WHEN follower_type = 'user' THEN auth.uid() = follower_user_id
    ELSE EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = follower_org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner','admin','manager')
    )
  END
)
WITH CHECK (
  status IN ('pending','accepted','declined')
);

CREATE POLICY "follows_update_target_user" ON public.follows
FOR UPDATE USING (
  target_type = 'user' AND target_id = auth.uid()
)
WITH CHECK (
  status IN ('accepted','declined')
);

-- Followers counts view for quick lookups
CREATE OR REPLACE VIEW public.follow_stats AS
SELECT
  target_type,
  target_id,
  COUNT(*) FILTER (WHERE status = 'accepted') AS follower_count,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
FROM public.follows
GROUP BY target_type, target_id;

CREATE OR REPLACE VIEW public.following_stats AS
SELECT
  COALESCE(follower_user_id::text, follower_org_id::text) AS actor_id,
  follower_type,
  COUNT(*) FILTER (WHERE status = 'accepted') AS following_count
FROM public.follows
GROUP BY actor_id, follower_type;

-- Messaging schema -----------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_participant_type') THEN
    CREATE TYPE conversation_participant_type AS ENUM ('user', 'organization');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_request_status') THEN
    CREATE TYPE conversation_request_status AS ENUM ('open', 'pending', 'accepted', 'declined');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT,
  request_status conversation_request_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  participant_type conversation_participant_type NOT NULL,
  participant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, participant_type, participant_user_id, participant_org_id)
);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_type conversation_participant_type NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent'
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;

-- Participant can view their conversations
CREATE POLICY "conversation_view" ON public.direct_conversations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = direct_conversations.id
      AND (
        (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid()) OR
        (cp.participant_type = 'organization' AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = cp.participant_org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin','manager')
        ))
      )
  )
);

CREATE POLICY "conversation_update" ON public.direct_conversations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = direct_conversations.id
      AND (
        (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid()) OR
        (cp.participant_type = 'organization' AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = cp.participant_org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin','manager')
        ))
      )
  )
)
WITH CHECK (true);

CREATE POLICY "conversation_insert" ON public.direct_conversations
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversation_participant_view" ON public.conversation_participants
FOR SELECT USING (
  (participant_type = 'user' AND participant_user_id = auth.uid()) OR
  (participant_type = 'organization' AND EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = participant_org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','manager')
  ))
);

CREATE POLICY "conversation_participant_insert" ON public.conversation_participants
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "direct_messages_view" ON public.direct_messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = direct_messages.conversation_id
      AND (
        (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid()) OR
        (cp.participant_type = 'organization' AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = cp.participant_org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin','manager')
        ))
      )
  )
);

CREATE POLICY "direct_messages_insert" ON public.direct_messages
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = direct_messages.conversation_id
      AND (
        (direct_messages.sender_type = 'user' AND cp.participant_type = 'user' AND cp.participant_user_id = auth.uid()) OR
        (direct_messages.sender_type = 'organization' AND cp.participant_type = 'organization' AND cp.participant_org_id = direct_messages.sender_org_id AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = direct_messages.sender_org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin','manager')
        ))
      )
  )
);

-- Convenience view to fetch inbox with latest message
CREATE OR REPLACE VIEW public.messaging_inbox AS
SELECT
  dc.id,
  dc.subject,
  dc.request_status,
  dc.last_message_at,
  dc.created_at,
  dc.metadata,
  jsonb_agg(
    jsonb_build_object(
      'participant_type', cp.participant_type,
      'participant_user_id', cp.participant_user_id,
      'participant_org_id', cp.participant_org_id,
      'joined_at', cp.joined_at,
      'last_read_at', cp.last_read_at
    )
    ORDER BY cp.joined_at
  ) AS participants
FROM public.direct_conversations dc
JOIN public.conversation_participants cp ON cp.conversation_id = dc.id
GROUP BY dc.id;

-- Update last_message_at trigger
CREATE OR REPLACE FUNCTION public.refresh_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.direct_conversations
    SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_direct_messages_refresh ON public.direct_messages;
CREATE TRIGGER trg_direct_messages_refresh
AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.refresh_conversation_timestamp();
