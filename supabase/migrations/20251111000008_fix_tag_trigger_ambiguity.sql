-- ============================================================================
-- Fix Ambiguous Column Reference in Tag Learning Trigger
-- ============================================================================
-- Issue: "column reference \"tag\" is ambiguous" when inserting tickets
-- Cause: learn_tags_from_ticket_purchase trigger has ambiguous column ref
-- Solution: Fully qualify all column references in the trigger function
-- ============================================================================

-- Fix the update_user_tag_preferences function to fully qualify columns
CREATE OR REPLACE FUNCTION public.update_user_tag_preferences(
  p_user_id uuid,
  p_event_id uuid,
  p_weight_delta numeric DEFAULT 1.0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  event_tags text[];
BEGIN
  -- Get tags from the event (fully qualified)
  SELECT e.tags INTO event_tags
  FROM events.events e
  WHERE e.id = p_event_id;

  -- Delegate to the tags-based helper
  PERFORM public.update_user_tag_preferences_from_tags(
    p_user_id,
    event_tags,
    p_weight_delta
  );
END;
$$;

-- Fix the tags-based helper to fully qualify all references
CREATE OR REPLACE FUNCTION public.update_user_tag_preferences_from_tags(
  p_user_id uuid,
  p_tags text[],
  p_weight_delta numeric DEFAULT 1.0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tag text;
BEGIN
  -- No tags? Nothing to do.
  IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH v_tag IN ARRAY p_tags
  LOOP
    INSERT INTO public.user_tag_preferences (
      user_id, tag, weight, interaction_count, last_interacted_at
    )
    VALUES (p_user_id, v_tag, p_weight_delta, 1, now())
    ON CONFLICT (user_id, tag) DO UPDATE SET
      weight            = user_tag_preferences.weight + p_weight_delta,
      interaction_count = user_tag_preferences.interaction_count + 1,
      last_interacted_at = now();
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.update_user_tag_preferences IS
  'Updates user tag preferences based on tags of a specific event (fixed ambiguous column references).';

COMMENT ON FUNCTION public.update_user_tag_preferences_from_tags IS
  'Updates user tag preferences given a set of tags directly (fixed ambiguous column references).';


