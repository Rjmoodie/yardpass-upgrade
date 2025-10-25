

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "campaigns";


ALTER SCHEMA "campaigns" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE SCHEMA IF NOT EXISTS "events";


ALTER SCHEMA "events" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "messaging";


ALTER SCHEMA "messaging" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "ml";


ALTER SCHEMA "ml" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE SCHEMA IF NOT EXISTS "organizations";


ALTER SCHEMA "organizations" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "payments";


ALTER SCHEMA "payments" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "ref";


ALTER SCHEMA "ref" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "sponsorship";


ALTER SCHEMA "sponsorship" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "ticketing";


ALTER SCHEMA "ticketing" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "users";


ALTER SCHEMA "users" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."ad_placement" AS ENUM (
    'feed',
    'story',
    'event_banner',
    'search_results'
);


ALTER TYPE "public"."ad_placement" OWNER TO "postgres";


CREATE TYPE "public"."campaign_objective" AS ENUM (
    'ticket_sales',
    'brand_awareness',
    'engagement',
    'event_promotion'
);


ALTER TYPE "public"."campaign_objective" OWNER TO "postgres";


CREATE TYPE "public"."campaign_status" AS ENUM (
    'draft',
    'scheduled',
    'active',
    'paused',
    'completed',
    'archived'
);


ALTER TYPE "public"."campaign_status" OWNER TO "postgres";


CREATE TYPE "public"."conversation_participant_type" AS ENUM (
    'user',
    'organization'
);


ALTER TYPE "public"."conversation_participant_type" OWNER TO "postgres";


CREATE TYPE "public"."conversation_request_status" AS ENUM (
    'open',
    'pending',
    'accepted',
    'declined'
);


ALTER TYPE "public"."conversation_request_status" OWNER TO "postgres";


CREATE TYPE "public"."creative_media_type" AS ENUM (
    'image',
    'video',
    'existing_post'
);


ALTER TYPE "public"."creative_media_type" OWNER TO "postgres";


CREATE TYPE "public"."event_visibility" AS ENUM (
    'public',
    'unlisted',
    'private'
);


ALTER TYPE "public"."event_visibility" OWNER TO "postgres";


CREATE TYPE "public"."follow_actor" AS ENUM (
    'user',
    'organization'
);


ALTER TYPE "public"."follow_actor" OWNER TO "postgres";


CREATE TYPE "public"."follow_status" AS ENUM (
    'pending',
    'accepted',
    'declined'
);


ALTER TYPE "public"."follow_status" OWNER TO "postgres";


CREATE TYPE "public"."follow_target" AS ENUM (
    'organizer',
    'event',
    'user'
);


ALTER TYPE "public"."follow_target" OWNER TO "postgres";


CREATE TYPE "public"."frequency_period" AS ENUM (
    'session',
    'day',
    'week'
);


ALTER TYPE "public"."frequency_period" OWNER TO "postgres";


CREATE TYPE "public"."home_feed_row" AS (
	"event_id" "uuid",
	"title" "text",
	"description" "text",
	"category" "text",
	"cover_image_url" "text",
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"venue" "text",
	"city" "text",
	"visibility" "public"."event_visibility",
	"created_by" "uuid",
	"organizer_display_name" "text",
	"organizer_avatar_url" "text",
	"recent_posts" "jsonb",
	"ticket_tiers" "jsonb"
);


ALTER TYPE "public"."home_feed_row" OWNER TO "postgres";


CREATE TYPE "public"."invite_status" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'revoked'
);


ALTER TYPE "public"."invite_status" OWNER TO "postgres";


CREATE TYPE "public"."job_status" AS ENUM (
    'draft',
    'queued',
    'sending',
    'sent',
    'failed'
);


ALTER TYPE "public"."job_status" OWNER TO "postgres";


CREATE TYPE "public"."message_channel" AS ENUM (
    'email',
    'sms'
);


ALTER TYPE "public"."message_channel" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'paid',
    'refunded',
    'canceled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."org_role" AS ENUM (
    'viewer',
    'editor',
    'admin',
    'owner'
);


ALTER TYPE "public"."org_role" OWNER TO "postgres";


CREATE TYPE "public"."owner_context" AS ENUM (
    'individual',
    'organization'
);


ALTER TYPE "public"."owner_context" OWNER TO "postgres";


CREATE TYPE "public"."pacing_strategy" AS ENUM (
    'even',
    'accelerated'
);


ALTER TYPE "public"."pacing_strategy" OWNER TO "postgres";


CREATE TYPE "public"."recurrence_pattern" AS ENUM (
    'weekly',
    'monthly'
);


ALTER TYPE "public"."recurrence_pattern" OWNER TO "postgres";


CREATE TYPE "public"."role_type" AS ENUM (
    'organizer',
    'scanner',
    'staff',
    'volunteer',
    'vendor',
    'guest'
);


ALTER TYPE "public"."role_type" OWNER TO "postgres";


CREATE TYPE "public"."sponsor_role" AS ENUM (
    'owner',
    'admin',
    'editor',
    'viewer'
);


ALTER TYPE "public"."sponsor_role" OWNER TO "postgres";


CREATE TYPE "public"."sponsorship_status" AS ENUM (
    'pending',
    'accepted',
    'live',
    'completed',
    'refunded',
    'cancelled'
);


ALTER TYPE "public"."sponsorship_status" OWNER TO "postgres";


CREATE TYPE "public"."ticket_status" AS ENUM (
    'issued',
    'transferred',
    'refunded',
    'redeemed',
    'void'
);


ALTER TYPE "public"."ticket_status" OWNER TO "postgres";


CREATE TYPE "public"."verification_status" AS ENUM (
    'none',
    'pending',
    'verified',
    'pro'
);


ALTER TYPE "public"."verification_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "analytics"."refresh_impression_rollups"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'analytics', 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW analytics.event_impressions_daily;
  REFRESH MATERIALIZED VIEW analytics.post_impressions_daily;
END $$;


ALTER FUNCTION "analytics"."refresh_impression_rollups"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_bump_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'like' THEN
      UPDATE public.event_posts
      SET like_count = like_count + 1
      WHERE id = NEW.post_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'like' THEN
      UPDATE public.event_posts
      SET like_count = GREATEST(like_count - 1, 0)
      WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."_bump_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_org_invitation"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_inv        org_invitations%rowtype;
  v_org_id     uuid;
  v_role       text;
  v_now        timestamptz := now();
  v_result     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;

  -- Lock the invite row to avoid race conditions
  SELECT *
    INTO v_inv
  FROM org_invitations
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  -- Already processed?
  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'status', 'already_accepted',
      'org_id', v_inv.org_id,
      'role', v_inv.role,
      'accepted_user_id', v_inv.accepted_user_id
    );
  ELSIF v_inv.status IN ('revoked', 'expired') THEN
    RAISE EXCEPTION 'Invitation is %', v_inv.status;
  END IF;

  -- Expired?
  IF v_inv.expires_at < v_now THEN
    UPDATE org_invitations
       SET status = 'expired'
     WHERE id = v_inv.id
       AND status = 'pending';
    RAISE EXCEPTION 'Invitation expired';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM org_memberships m
    WHERE m.org_id = v_inv.org_id
      AND m.user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this organization';
  END IF;

  -- Accept the invitation
  UPDATE org_invitations
     SET status = 'accepted',
         accepted_user_id = v_user_id,
         accepted_at = v_now
   WHERE id = v_inv.id;

  -- Add user to organization
  INSERT INTO org_memberships (org_id, user_id, role)
  VALUES (v_inv.org_id, v_user_id, v_inv.role);

  RETURN jsonb_build_object(
    'status', 'accepted',
    'org_id', v_inv.org_id,
    'role', v_inv.role,
    'accepted_user_id', v_user_id
  );
END;
$$;


ALTER FUNCTION "public"."accept_org_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_role_invite"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_inv        role_invites%rowtype;
  v_event_id   uuid;
  v_role       text;
  v_now        timestamptz := now();
  v_first_name text := '';
  v_result     jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;

  -- Lock the invite row to avoid race conditions when clicking twice
  SELECT *
    INTO v_inv
  FROM role_invites
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  -- Already processed?
  IF v_inv.status = 'accepted' THEN
    RETURN jsonb_build_object(
      'status','already_accepted',
      'event_id', v_inv.event_id,
      'role', v_inv.role,
      'accepted_user_id', v_inv.accepted_user_id
    );
  ELSIF v_inv.status IN ('revoked','expired') THEN
    RAISE EXCEPTION 'Invite is %', v_inv.status;
  END IF;

  -- Expired? (also mark it)
  IF v_inv.expires_at IS NOT NULL AND v_inv.expires_at < v_now THEN
    UPDATE role_invites
       SET status = 'expired'
     WHERE id = v_inv.id
       AND status = 'pending';
    RAISE EXCEPTION 'Invite expired';
  END IF;

  -- Optional recipient binding:
  -- if the invite specifies an email/phone, the current user must match
  IF v_inv.email IS NOT NULL THEN
    PERFORM 1
      FROM user_profiles up
     WHERE up.user_id = v_user_id
       AND lower(coalesce(up.email,'')) = lower(v_inv.email);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This invite is addressed to a different email.';
    END IF;
  END IF;

  IF v_inv.phone IS NOT NULL THEN
    -- naive normalization: strip +, -, spaces
    PERFORM 1
      FROM user_profiles up
     WHERE up.user_id = v_user_id
       AND regexp_replace(coalesce(up.phone,''), '[^0-9]', '', 'g')
           = regexp_replace(v_inv.phone, '[^0-9]', '', 'g');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This invite is addressed to a different phone.';
    END IF;
  END IF;

  v_event_id := v_inv.event_id;
  v_role     := v_inv.role;

  -- Optional: grab first name for downstream auditing (not required)
  SELECT split_part(coalesce(up.display_name,''), ' ', 1)
    INTO v_first_name
    FROM user_profiles up
   WHERE up.user_id = v_user_id;

  -- Upsert the role: set to active if it exists
  INSERT INTO event_roles (event_id, user_id, role, status, created_by, created_at)
  VALUES (v_event_id, v_user_id, v_role, 'active', coalesce(v_inv.invited_by, v_user_id), v_now)
  ON CONFLICT (event_id, user_id, role)
  DO UPDATE SET status = 'active';

  -- Mark this invite accepted
  UPDATE role_invites
     SET status = 'accepted',
         accepted_user_id = v_user_id,
         accepted_at = v_now
   WHERE id = v_inv.id;

  -- Revoke other duplicate pending invites to same event+role+recipient (nice-to-have cleanup)
  UPDATE role_invites
     SET status = 'revoked'
   WHERE id <> v_inv.id
     AND event_id = v_event_id
     AND role = v_role
     AND status = 'pending'
     AND (
          (email IS NOT NULL AND email = v_inv.email)
       OR (phone IS NOT NULL AND phone = v_inv.phone)
     );

  v_result := jsonb_build_object(
    'status', 'accepted',
    'event_id', v_event_id,
    'role', v_role,
    'user_id', v_user_id,
    'first_name', v_first_name
  );

  RETURN v_result;

EXCEPTION
  WHEN unique_violation THEN
    -- Role already existed concurrently; still mark invite accepted and return success
    UPDATE role_invites
       SET status = 'accepted',
           accepted_user_id = v_user_id,
           accepted_at = v_now
     WHERE id = v_inv.id;

    RETURN jsonb_build_object(
      'status', 'accepted',
      'event_id', v_inv.event_id,
      'role', v_inv.role,
      'user_id', v_user_id
    );
END;
$$;


ALTER FUNCTION "public"."accept_role_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.kind = 'like' THEN
    UPDATE public.event_posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."bump_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bump_reply_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.event_posts
  SET reply_count = reply_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."bump_reply_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_platform_fee"("p_amount_cents" integer, "p_organization_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  fee_percentage numeric;
  fee_cents integer;
BEGIN
  -- Get the platform fee percentage for the organization
  SELECT COALESCE(platform_fee_percentage, 0.05)
  INTO fee_percentage
  FROM public.payout_configurations
  WHERE organization_id = p_organization_id;
  
  -- Calculate fee (minimum 1 cent)
  fee_cents := GREATEST(1, ROUND(p_amount_cents * fee_percentage));
  
  -- Ensure fee doesn't exceed 50% of the amount
  fee_cents := LEAST(fee_cents, p_amount_cents / 2);
  
  RETURN fee_cents;
END $$;


ALTER FUNCTION "public"."calculate_platform_fee"("p_amount_cents" integer, "p_organization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_platform_fee"("p_amount_cents" integer, "p_organization_id" "uuid") IS 'Calculates platform fee for a given amount and organization';



CREATE OR REPLACE FUNCTION "public"."can_current_user_post"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT
    EXISTS (
      -- Direct event ownership check
      SELECT 1
      FROM public.events ev
      WHERE ev.id = p_event_id
        AND (
          ev.created_by = auth.uid()
          OR (
            ev.owner_context_type = 'individual'
            AND ev.owner_context_id = auth.uid()
          )
          OR (
            ev.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = ev.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role::text IN ('owner','admin','editor')
            )
          )
        )
    )
    OR EXISTS (
      -- Valid ticket holder check
      SELECT 1
      FROM public.tickets t
      WHERE t.event_id = p_event_id
        AND t.owner_user_id = auth.uid()
        AND t.status::text IN ('issued','transferred','redeemed')
    );
$$;


ALTER FUNCTION "public"."can_current_user_post"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_event"("p_user" "uuid", "p_event" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id AND t.owner_user_id = p_user AND t.status IN ('issued', 'transferred', 'redeemed')
    LEFT JOIN org_memberships m ON m.org_id = e.owner_context_id
                                AND e.owner_context_type = 'organization'
                                AND m.user_id = p_user
    WHERE e.id = p_event
      AND (
        e.visibility = 'public'
        OR e.created_by = p_user
        OR t.id IS NOT NULL
        OR m.user_id IS NOT NULL
      )
  );
$$;


ALTER FUNCTION "public"."can_view_event"("p_user" "uuid", "p_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_circuit_breaker"("p_service_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_state circuit_breaker_state%ROWTYPE;
        v_now timestamptz := now();
BEGIN
  SELECT * INTO v_state
  FROM public.circuit_breaker_state
  WHERE id = p_service_id
  FOR UPDATE; -- prevent concurrent half_open flips

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_proceed', true, 'state', 'closed');
  END IF;

  IF v_state.state = 'open' AND v_now >= COALESCE(v_state.next_attempt_at, v_now) THEN
    UPDATE public.circuit_breaker_state
    SET state = 'half_open', updated_at = v_now
    WHERE id = p_service_id;
    RETURN jsonb_build_object('can_proceed', true, 'state', 'half_open');
  END IF;

  RETURN jsonb_build_object(
    'can_proceed', v_state.state <> 'open',
    'state', v_state.state,
    'next_attempt_at', v_state.next_attempt_at
  );
END; $$;


ALTER FUNCTION "public"."check_circuit_breaker"("p_service_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_ip_address" "text" DEFAULT NULL::"text", "p_max_per_minute" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_current_minute TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER := 0;
  v_ip_hash TEXT;
  v_result JSONB;
BEGIN
  -- Get current minute window
  v_current_minute := DATE_TRUNC('minute', NOW());
  
  -- Hash IP if provided
  IF p_ip_address IS NOT NULL THEN
    v_ip_hash := hash_ip(p_ip_address);
  END IF;
  
  -- Check existing count for this minute
  SELECT COALESCE(count, 0) INTO v_current_count
  FROM public.rate_limits
  WHERE bucket = p_bucket
    AND minute = v_current_minute
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id) OR
      (p_ip_address IS NOT NULL AND ip_hash = v_ip_hash)
    );
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_per_minute THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', v_current_count,
      'limit', p_max_per_minute,
      'reset_at', v_current_minute + INTERVAL '1 minute'
    );
  END IF;
  
  -- Increment counter
  INSERT INTO public.rate_limits (user_id, ip_hash, bucket, minute, count)
  VALUES (
    p_user_id,
    v_ip_hash,
    p_bucket,
    v_current_minute,
    v_current_count + 1
  )
  ON CONFLICT (user_id, bucket, minute) 
  DO UPDATE SET count = rate_limits.count + 1
  WHERE rate_limits.user_id IS NOT NULL;
  
  -- Handle IP-based conflict separately (since user_id might be NULL)
  IF p_ip_address IS NOT NULL AND p_user_id IS NULL THEN
    INSERT INTO public.rate_limits (user_id, ip_hash, bucket, minute, count)
    VALUES (
      NULL,
      v_ip_hash,
      p_bucket,
      v_current_minute,
      v_current_count + 1
    )
    ON CONFLICT (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID), bucket, minute)
    DO UPDATE SET count = rate_limits.count + 1
    WHERE rate_limits.ip_hash = v_ip_hash;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current_count + 1,
    'limit', p_max_per_minute,
    'reset_at', v_current_minute + INTERVAL '1 minute'
  );
END;
$$;


ALTER FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_user_id" "uuid", "p_ip_address" "text", "p_max_per_minute" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_recalc_queue_health"() RETURNS TABLE("total_pending" integer, "high_priority_pending" integer, "oldest_pending_age" interval, "avg_processing_time" interval)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::integer AS total_pending,
    COUNT(*) FILTER (WHERE priority > 0)::integer AS high_priority_pending,
    MAX(now() - created_at) AS oldest_pending_age,
    AVG(processed_at - created_at) AS avg_processing_time
  FROM public.fit_recalc_queue
  WHERE status IS NULL OR status = 'pending';
END $$;


ALTER FUNCTION "public"."check_recalc_queue_health"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_recalc_queue_health"() IS 'Monitors the health of the recalculation queue';



CREATE OR REPLACE FUNCTION "public"."claim_order_ticketing"("p_order_id" "uuid") RETURNS boolean
    LANGUAGE "sql"
    AS $_$
  SELECT pg_try_advisory_xact_lock(
    ('x' || substr(replace($1::text,'-',''),1,8))::bit(32)::int,
    ('x' || substr(replace($1::text,'-',''),9,8))::bit(32)::int
  );
$_$;


ALTER FUNCTION "public"."claim_order_ticketing"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_holds"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Release all expired holds
  SELECT release_ticket_holds(NULL, NULL, 'expired') INTO v_result;
  
  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_holds"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_guest_sessions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.guest_otp_codes 
  WHERE expires_at < NOW();
  
  DELETE FROM public.guest_ticket_sessions 
  WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_guest_sessions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_assets"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM safety_talk_assets 
  WHERE type = 'audio' 
    AND created_at < NOW() - INTERVAL '30 days'
    AND talk_id NOT IN (
      SELECT id FROM safety_talks 
      WHERE updated_at > NOW() - INTERVAL '7 days'
    );
    
  DELETE FROM safety_talk_assets 
  WHERE type = 'signature' 
    AND created_at < NOW() - INTERVAL '90 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_assets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_keys"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Clean up old idempotency keys (24 hours)
  DELETE FROM public.idempotency_keys 
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  -- Clean up old rate limits (1 hour)
  DELETE FROM public.rate_limits 
  WHERE minute < NOW() - INTERVAL '1 hour';
  
  -- Log cleanup activity
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_old_keys"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_recalc_queue"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  deleted_count integer;
  additional_count integer;
BEGIN
  -- Delete processed items older than 7 days
  DELETE FROM public.fit_recalc_queue
  WHERE processed_at IS NOT NULL
  AND processed_at < now() - interval '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete failed items older than 30 days
  DELETE FROM public.fit_recalc_queue
  WHERE status = 'failed'
  AND created_at < now() - interval '30 days';
  
  GET DIAGNOSTICS additional_count = ROW_COUNT;
  
  -- Add both counts together
  deleted_count := deleted_count + additional_count;
  
  RETURN deleted_count;
END $$;


ALTER FUNCTION "public"."cleanup_recalc_queue"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cleanup_recalc_queue"() IS 'Cleans up old items from the recalculation queue';



CREATE OR REPLACE FUNCTION "public"."consume_ticket_holds"("p_hold_ids" "uuid"[], "p_order_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_hold_record RECORD;
  v_consumed_count integer := 0;
  v_total_quantity integer := 0;
BEGIN
  -- Process each hold
  FOR v_hold_record IN 
    SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
    FROM ticket_holds h
    WHERE h.id = ANY(p_hold_ids)
      AND h.status = 'active'
      AND h.expires_at > now()
    FOR UPDATE
  LOOP
    -- Use advisory lock for the tier
    PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
    
    -- Convert reserved to issued
    UPDATE ticket_tiers
    SET 
      reserved_quantity = reserved_quantity - v_hold_record.quantity,
      issued_quantity = issued_quantity + v_hold_record.quantity
    WHERE id = v_hold_record.tier_id;
    
    -- Mark hold as consumed
    UPDATE ticket_holds
    SET status = 'consumed', order_id = p_order_id
    WHERE id = v_hold_record.id;
    
    -- Log the operation
    INSERT INTO inventory_operations (
      tier_id, operation_type, quantity, session_id, user_id, order_id, metadata
    ) VALUES (
      v_hold_record.tier_id, 'purchase', v_hold_record.quantity,
      v_hold_record.session_id, v_hold_record.user_id, p_order_id,
      jsonb_build_object('hold_id', v_hold_record.id)
    );
    
    v_consumed_count := v_consumed_count + 1;
    v_total_quantity := v_total_quantity + v_hold_record.quantity;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed_holds', v_consumed_count,
    'total_quantity', v_total_quantity,
    'order_id', p_order_id
  );
END;
$$;


ALTER FUNCTION "public"."consume_ticket_holds"("p_hold_ids" "uuid"[], "p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_event_attendees"("p_event" "uuid") RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(DISTINCT owner_user_id)
  FROM tickets
  WHERE event_id = p_event
    AND status IN ('issued','transferred','redeemed');
$$;


ALTER FUNCTION "public"."count_event_attendees"("p_event" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_event_series"("p_org_id" "uuid", "p_created_by" "uuid", "p_name" "text", "p_description" "text", "p_recurrence" "public"."recurrence_pattern", "p_interval" integer, "p_series_start" timestamp with time zone, "p_series_end" "date", "p_max_events" integer, "p_timezone" "text", "p_template" "jsonb") RETURNS TABLE("event_id" "uuid", "start_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_series_id uuid;
  v_duration interval;
  v_cnt int := 0;
  v_start timestamptz;
  v_end   timestamptz;
  v_step interval;
BEGIN
  -- Duration from template (end_at - start_at) or fallback 2 hours
  v_duration := COALESCE(
    ((p_template->>'end_at')::timestamptz - (p_template->>'start_at')::timestamptz),
    interval '2 hours'
  );

  -- Determine step
  v_step := CASE p_recurrence
              WHEN 'weekly'  THEN make_interval(weeks => GREATEST(1,p_interval))
              WHEN 'monthly' THEN make_interval(months => GREATEST(1,p_interval))
            END;

  -- Insert series row
  INSERT INTO public.event_series(
    name, description, organization_id, created_by,
    recurrence, recurrence_interval, series_start, series_end,
    max_events, timezone, template
  ) VALUES (
    p_name, p_description, p_org_id, p_created_by,
    p_recurrence, p_interval, p_series_start, p_series_end,
    NULLIF(p_max_events,0), p_timezone, p_template
  )
  RETURNING id INTO v_series_id;

  -- Loop occurrences
  v_start := p_series_start;
  WHILE (v_start::date <= p_series_end) LOOP
    EXIT WHEN p_max_events IS NOT NULL AND v_cnt >= p_max_events;

    v_end := v_start + v_duration;

    INSERT INTO public.events(
      title, description, category, start_at, end_at, timezone,
      venue, address, city, country, lat, lng,
      cover_image_url, owner_context_type, owner_context_id,
      created_by, visibility, slug, link_token, series_id
    )
    VALUES(
      COALESCE(p_template->>'title','Untitled Event'),
      p_template->>'description',
      p_template->>'category',
      v_start, v_end, COALESCE(p_template->>'timezone', p_timezone),
      p_template->>'venue',
      p_template->>'address',
      p_template->>'city',
      p_template->>'country',
      NULLIF(p_template->>'lat','')::double precision,
      NULLIF(p_template->>'lng','')::double precision,
      p_template->>'cover_image_url',
      'organization',
      p_org_id,
      p_created_by,
      COALESCE((p_template->>'visibility')::public.event_visibility, 'public'),
      -- Basic slug generation
      regexp_replace(lower(COALESCE(p_template->>'title','untitled') || '-' || to_char(v_start, 'YYYYMMDD')), '[^a-z0-9\-]+', '-', 'g'),
      NULL,
      v_series_id
    )
    RETURNING id INTO event_id;

    start_at := v_start;
    v_cnt := v_cnt + 1;
    RETURN NEXT;

    -- Step forward
    v_start := v_start + v_step;
  END LOOP;

END $$;


ALTER FUNCTION "public"."create_event_series"("p_org_id" "uuid", "p_created_by" "uuid", "p_name" "text", "p_description" "text", "p_recurrence" "public"."recurrence_pattern", "p_interval" integer, "p_series_start" timestamp with time zone, "p_series_end" "date", "p_max_events" integer, "p_timezone" "text", "p_template" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_follow_notification"("target_user_id" "uuid", "follower_user_id" "uuid", "follower_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Insert notification for the user being followed
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    event_type,
    data,
    created_at
  ) VALUES (
    target_user_id,
    'info',
    'New Follow Request',
    follower_name || ' wants to follow you',
    'user_follow',
    jsonb_build_object(
      'follower_user_id', follower_user_id,
      'follower_name', follower_name,
      'follow_id', (SELECT id FROM public.follows WHERE follower_user_id = create_follow_notification.follower_user_id AND target_id = create_follow_notification.target_user_id ORDER BY created_at DESC LIMIT 1)
    ),
    NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the follow operation
    RAISE WARNING 'Failed to create follow notification: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."create_follow_notification"("target_user_id" "uuid", "follower_user_id" "uuid", "follower_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_next_month_partitions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_month date := date_trunc('month', now() + interval '1 month');
  partition_name text;
BEGIN
  -- Create event_impressions partition
  partition_name := 'event_impressions_p_' || to_char(next_month, 'YYYYMM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.event_impressions_p
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month::timestamptz,
      (next_month + interval '1 month')::timestamptz
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;

  -- Create ticket_analytics partition
  partition_name := 'ticket_analytics_p_' || to_char(next_month, 'YYYYMM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.ticket_analytics_p
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month::timestamptz,
      (next_month + interval '1 month')::timestamptz
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END $$;


ALTER FUNCTION "public"."create_next_month_partitions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_next_month_partitions"() IS 'Creates partitions for the next month to ensure continuous data storage';



CREATE OR REPLACE FUNCTION "public"."create_organization_with_membership"("p_name" "text", "p_handle" "text", "p_logo_url" "text" DEFAULT NULL::"text", "p_creator_id" "uuid" DEFAULT "auth"."uid"()) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Insert organization
  INSERT INTO public.organizations (name, handle, logo_url, created_by, verification_status)
  VALUES (p_name, p_handle, p_logo_url, p_creator_id, 'none')
  RETURNING id INTO v_org_id;
  
  -- Insert membership for creator as owner
  INSERT INTO public.org_memberships (org_id, user_id, role)
  VALUES (v_org_id, p_creator_id, 'owner');
  
  RETURN v_org_id;
END;
$$;


ALTER FUNCTION "public"."create_organization_with_membership"("p_name" "text", "p_handle" "text", "p_logo_url" "text", "p_creator_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_org_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT (auth.jwt() ->> 'org_id')::uuid
$$;


ALTER FUNCTION "public"."current_org_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decr_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.kind = 'like' THEN
    UPDATE public.event_posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN OLD;
END; $$;


ALTER FUNCTION "public"."decr_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_credits_fifo"("p_amount" integer, "p_wallet_id" "uuid" DEFAULT NULL::"uuid", "p_org_wallet_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("lot_id" "uuid", "deducted" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_lot RECORD;
  v_remaining INTEGER := p_amount;
  v_to_deduct INTEGER;
BEGIN
  -- Validate inputs
  IF (p_wallet_id IS NULL AND p_org_wallet_id IS NULL) THEN
    RAISE EXCEPTION 'Must provide either wallet_id or org_wallet_id';
  END IF;
  
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Deduction amount must be positive';
  END IF;
  
  -- Loop through lots FIFO (oldest first, expiring first)
  FOR v_lot IN
    SELECT id, quantity_remaining
    FROM public.credit_lots
    WHERE (
      (p_wallet_id IS NOT NULL AND wallet_id = p_wallet_id) OR
      (p_org_wallet_id IS NOT NULL AND org_wallet_id = p_org_wallet_id)
    )
    AND quantity_remaining > 0
    AND (expires_at IS NULL OR expires_at > now())
    ORDER BY 
      -- Expiring credits first (if any)
      CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
      expires_at ASC NULLS LAST,
      -- Then oldest credits first
      created_at ASC
    FOR UPDATE SKIP LOCKED -- Prevent deadlocks in concurrent spending
  LOOP
    EXIT WHEN v_remaining <= 0;
    
    -- Deduct from this lot
    v_to_deduct := LEAST(v_lot.quantity_remaining, v_remaining);
    
    UPDATE public.credit_lots
    SET 
      quantity_remaining = quantity_remaining - v_to_deduct,
      depleted_at = CASE 
        WHEN quantity_remaining - v_to_deduct = 0 THEN now() 
        ELSE depleted_at 
      END
    WHERE id = v_lot.id;
    
    v_remaining := v_remaining - v_to_deduct;
    
    -- Return this deduction
    lot_id := v_lot.id;
    deducted := v_to_deduct;
    RETURN NEXT;
  END LOOP;
  
  -- Check if we had enough credits
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Insufficient credits: needed %, only had %', p_amount, p_amount - v_remaining;
  END IF;
END;
$$;


ALTER FUNCTION "public"."deduct_credits_fifo"("p_amount" integer, "p_wallet_id" "uuid", "p_org_wallet_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."deduct_credits_fifo"("p_amount" integer, "p_wallet_id" "uuid", "p_org_wallet_id" "uuid") IS 'FIFO credit deduction - deducts from oldest/expiring lots first';



CREATE OR REPLACE FUNCTION "public"."dlq_enqueue_webhook"("p_correlation_id" "uuid", "p_webhook_type" "text", "p_payload" "jsonb", "p_original_timestamp" timestamp with time zone, "p_failure_reason" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.dead_letter_webhooks(
    correlation_id, webhook_type, payload, original_timestamp, failure_reason, status
  ) VALUES (
    p_correlation_id, p_webhook_type, p_payload, p_original_timestamp, p_failure_reason, 'pending'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;


ALTER FUNCTION "public"."dlq_enqueue_webhook"("p_correlation_id" "uuid", "p_webhook_type" "text", "p_payload" "jsonb", "p_original_timestamp" timestamp with time zone, "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dlq_pop_next"("p_webhook_type" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "correlation_id" "uuid", "webhook_type" "text", "payload" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM public.dead_letter_webhooks
    WHERE status IN ('pending','failed')
      AND (p_webhook_type IS NULL OR webhook_type = p_webhook_type)
    ORDER BY updated_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.dead_letter_webhooks d
  SET status = 'retrying', retry_count = d.retry_count + 1, last_retry_at = now(), updated_at = now()
  FROM cte
  WHERE d.id = cte.id
  RETURNING d.id, d.correlation_id, d.webhook_type, d.payload;
END; $$;


ALTER FUNCTION "public"."dlq_pop_next"("p_webhook_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dlq_set_status"("p_id" "uuid", "p_status" "text", "p_failure_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.dead_letter_webhooks
  SET status = p_status,
      failure_reason = COALESCE(p_failure_reason, failure_reason),
      updated_at = now()
  WHERE id = p_id;
END; $$;


ALTER FUNCTION "public"."dlq_set_status"("p_id" "uuid", "p_status" "text", "p_failure_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_next_month_partitions"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_month date := date_trunc('month', now() + interval '1 month');
  partition_name text;
BEGIN
  -- Create event_impressions partition if missing
  partition_name := 'event_impressions_p_' || to_char(next_month, 'YYYYMM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.event_impressions_p
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month::timestamptz,
      (next_month + interval '1 month')::timestamptz
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;

  -- Create ticket_analytics partition if missing
  partition_name := 'ticket_analytics_p_' || to_char(next_month, 'YYYYMM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.ticket_analytics_p
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month::timestamptz,
      (next_month + interval '1 month')::timestamptz
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END $$;


ALTER FUNCTION "public"."ensure_next_month_partitions"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ensure_next_month_partitions"() IS 'Automatically creates next months partition tables if they dont exist';



CREATE OR REPLACE FUNCTION "public"."ensure_org_wallet_exists"("p_org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_wallet_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id = p_org_id
      AND om.user_id = v_uid
      AND om.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_wallet_id FROM public.org_wallets WHERE org_id = p_org_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.org_wallets (org_id) VALUES (p_org_id) RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;


ALTER FUNCTION "public"."ensure_org_wallet_exists"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_wallet_exists_for_auth_user"() RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE 
  uid uuid := auth.uid();
  wid uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Atomic upsert with ON CONFLICT
  INSERT INTO wallets (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  -- Fetch wallet id
  SELECT id INTO wid FROM wallets WHERE user_id = uid;
  RETURN wid;
END;
$$;


ALTER FUNCTION "public"."ensure_wallet_exists_for_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_sql"("sql_query" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result jsonb;
    query_lower text;
BEGIN
    -- Convert to lowercase for safety checks
    query_lower := lower(trim(sql_query));
    
    -- Security: Only allow SELECT statements
    IF NOT query_lower LIKE 'select%' THEN
        RAISE EXCEPTION 'Only SELECT statements are allowed';
    END IF;
    
    -- Security: Block dangerous keywords
    IF query_lower ~* '\b(delete|insert|update|drop|create|alter|truncate|grant|revoke)\b' THEN
        RAISE EXCEPTION 'Query contains forbidden operations';
    END IF;
    
    -- Execute the query and return results as JSON
    EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (%s) t', sql_query) INTO result;
    
    -- Return empty array if no results
    RETURN COALESCE(result, '[]'::jsonb);
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Query execution failed: %', SQLERRM;
END;
$$;


ALTER FUNCTION "public"."execute_sql"("sql_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."extend_ticket_holds"("p_session_id" "text", "p_extend_minutes" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rows integer := 0;
  v_new_expiration timestamptz := now() + interval '1 minute' * COALESCE(p_extend_minutes, 10);
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_id required');
  END IF;

  UPDATE ticket_holds
  SET expires_at = v_new_expiration
  WHERE session_id = p_session_id
    AND status = 'active'
    AND expires_at > now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_rows,
    'expires_at', v_new_expiration
  );
END;
$$;


ALTER FUNCTION "public"."extend_ticket_holds"("p_session_id" "text", "p_extend_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_similar_events"("p_description_embedding" "public"."vector", "p_limit" integer DEFAULT 10, "p_threshold" numeric DEFAULT 0.7) RETURNS TABLE("event_id" "uuid", "similarity_score" numeric, "event_title" "text", "category" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    e.id AS event_id,
    1 - (e.description_embedding <=> p_description_embedding) AS similarity_score,
    e.title AS event_title,
    e.category
  FROM public.events e
  WHERE e.description_embedding IS NOT NULL
  AND 1 - (e.description_embedding <=> p_description_embedding) >= p_threshold
  ORDER BY e.description_embedding <=> p_description_embedding
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."find_similar_events"("p_description_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_similar_events"("p_description_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) IS 'Finds events with similar descriptions using vector similarity';



CREATE OR REPLACE FUNCTION "public"."find_similar_sponsors"("p_objectives_embedding" "public"."vector", "p_limit" integer DEFAULT 10, "p_threshold" numeric DEFAULT 0.7) RETURNS TABLE("sponsor_id" "uuid", "similarity_score" numeric, "sponsor_name" "text", "industry" "text")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT 
    sp.sponsor_id,
    1 - (sp.objectives_embedding <=> p_objectives_embedding) AS similarity_score,
    s.name AS sponsor_name,
    sp.industry
  FROM public.sponsor_profiles sp
  JOIN public.sponsors s ON s.id = sp.sponsor_id
  WHERE sp.objectives_embedding IS NOT NULL
  AND 1 - (sp.objectives_embedding <=> p_objectives_embedding) >= p_threshold
  ORDER BY sp.objectives_embedding <=> p_objectives_embedding
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."find_similar_sponsors"("p_objectives_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_similar_sponsors"("p_objectives_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) IS 'Finds sponsors with similar objectives using vector similarity';



CREATE OR REPLACE FUNCTION "public"."fn_compute_match_score"("p_event_id" "uuid", "p_sponsor_id" "uuid") RETURNS TABLE("score" numeric, "breakdown" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  ins record;
  sp record;
  ev record;
  budget_fit numeric := 0.5;
  cat_overlap numeric := 0.5;
  geo_overlap numeric := 0.5;
  engagement_quality numeric := 0.5;
  obj_sim numeric := 0.5;
  audience_overlap numeric := 0.5;
  final_score numeric;
BEGIN
  -- Get event audience insights
  SELECT * INTO ins 
  FROM public.event_audience_insights 
  WHERE event_id = p_event_id;
  
  -- Get sponsor profile
  SELECT * INTO sp 
  FROM public.sponsor_profiles 
  WHERE sponsor_id = p_sponsor_id;
  
  -- Get event details
  SELECT * INTO ev 
  FROM public.events 
  WHERE id = p_event_id;

  -- Return early if data is missing
  IF sp IS NULL OR ev IS NULL THEN
    RETURN QUERY SELECT 0.0::numeric, '{}'::jsonb;
    RETURN;
  END IF;

  -- 1. Budget Fit (25% weight)
  IF sp.annual_budget_cents IS NOT NULL AND sp.annual_budget_cents > 0 THEN
    budget_fit := LEAST(1.0, (sp.annual_budget_cents::numeric / NULLIF(sp.annual_budget_cents, 0)));
  END IF;

  -- 2. Category Overlap
  IF sp.preferred_categories IS NOT NULL AND array_length(sp.preferred_categories, 1) > 0 THEN
    cat_overlap := CASE 
      WHEN LOWER(ev.category) = ANY (
        ARRAY(SELECT LOWER(x) FROM unnest(sp.preferred_categories) x)
      ) THEN 1.0
      ELSE 0.0
    END;
  END IF;

  -- 3. Geographic Overlap
  IF sp.regions IS NOT NULL AND ins.geo_distribution IS NOT NULL THEN
    geo_overlap := (
      SELECT COALESCE(
        (
          SELECT count(*)::numeric 
          FROM unnest(sp.regions) r
          WHERE r = ANY(ARRAY(SELECT key FROM jsonb_each_text(ins.geo_distribution)))
        ) / GREATEST(1, COALESCE(array_length(sp.regions, 1), 1)),
        0.0
      )
    );
  END IF;

  -- 4. Engagement Quality (15% weight)
  IF ins IS NOT NULL THEN
    engagement_quality := COALESCE(
      0.7 * COALESCE(ins.engagement_score, 0) + 
      0.3 * COALESCE(ins.ticket_conversion_rate, 0),
      0.5
    );
  END IF;

  -- 5. Vector Similarity (Objectives) (10% weight)
  IF sp.objectives_embedding IS NOT NULL AND ev.description_embedding IS NOT NULL THEN
    BEGIN
      -- Use inner product for normalized embeddings (faster than cosine)
      SELECT 1 - (sp2.objectives_embedding <=> ev2.description_embedding)
        INTO obj_sim
      FROM public.sponsor_profiles sp2, public.events ev2
      WHERE sp2.sponsor_id = p_sponsor_id AND ev2.id = p_event_id;
      
      obj_sim := COALESCE(obj_sim, 0.5);
    EXCEPTION
      WHEN OTHERS THEN
        obj_sim := 0.5;
    END;
  ELSE
    obj_sim := 0.5;
  END IF;

  -- 6. Audience Overlap (35% weight) - combines category and geo
  audience_overlap := 0.6 * cat_overlap + 0.4 * geo_overlap;

  -- Calculate final weighted score
  final_score := 
    0.25 * budget_fit +
    0.35 * audience_overlap +
    0.15 * geo_overlap +
    0.15 * engagement_quality +
    0.10 * obj_sim;

  -- Return score and detailed breakdown
  RETURN QUERY SELECT
    ROUND(final_score, 4),
    jsonb_build_object(
      'budget_fit', ROUND(budget_fit, 3),
      'audience_overlap', jsonb_build_object(
        'categories', ROUND(cat_overlap, 3), 
        'geo', ROUND(geo_overlap, 3),
        'combined', ROUND(audience_overlap, 3)
      ),
      'geo_overlap', ROUND(geo_overlap, 3),
      'engagement_quality', ROUND(engagement_quality, 3),
      'objectives_similarity', ROUND(obj_sim, 3),
      'weights', jsonb_build_object(
        'budget', 0.25,
        'audience', 0.35,
        'geo', 0.15,
        'engagement', 0.15,
        'objectives', 0.10
      )
    );
END $$;


ALTER FUNCTION "public"."fn_compute_match_score"("p_event_id" "uuid", "p_sponsor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_compute_match_score"("p_event_id" "uuid", "p_sponsor_id" "uuid") IS 'Optimized DB-native match scoring with vector similarity and detailed breakdown';



CREATE OR REPLACE FUNCTION "public"."fn_queue_recalc_on_event_insights"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Queue recalculation for all sponsors when event insights change
  INSERT INTO public.fit_recalc_queue (event_id, sponsor_id, reason, queued_at)
  SELECT NEW.event_id, sp.sponsor_id, 'event_insight_update', now()
  FROM public.sponsor_profiles sp
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."fn_queue_recalc_on_event_insights"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_queue_recalc_on_sponsor_profiles"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Queue recalculation for all events when sponsor profile changes
  INSERT INTO public.fit_recalc_queue (event_id, sponsor_id, reason, queued_at)
  SELECT eai.event_id, NEW.sponsor_id, 'sponsor_profile_update', now()
  FROM public.event_audience_insights eai
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."fn_queue_recalc_on_sponsor_profiles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_upsert_match"("p_event_id" "uuid", "p_sponsor_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE 
  r record;
BEGIN
  -- Compute the score
  SELECT * INTO r 
  FROM public.fn_compute_match_score(p_event_id, p_sponsor_id);
  
  -- Upsert into sponsorship_matches
  INSERT INTO public.sponsorship_matches (
    event_id, 
    sponsor_id, 
    score, 
    overlap_metrics, 
    updated_at
  )
  VALUES (
    p_event_id, 
    p_sponsor_id, 
    r.score, 
    r.breakdown, 
    now()
  )
  ON CONFLICT (event_id, sponsor_id) 
  DO UPDATE SET
    score = EXCLUDED.score, 
    overlap_metrics = EXCLUDED.overlap_metrics, 
    updated_at = now();
END $$;


ALTER FUNCTION "public"."fn_upsert_match"("p_event_id" "uuid", "p_sponsor_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_upsert_match"("p_event_id" "uuid", "p_sponsor_id" "uuid") IS 'Helper to compute and persist match score in one call';



CREATE OR REPLACE FUNCTION "public"."gen_qr_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text;
  tries int := 0;
  i int; 
  idx int;
BEGIN
  LOOP
    out := '';
    FOR i IN 1..8 LOOP
      idx := (get_byte(gen_random_bytes(1), 0) % length(alphabet)) + 1;
      out := out || substr(alphabet, idx, 1);
    END LOOP;

    -- Ensure uniqueness
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tickets WHERE qr_code = out);

    tries := tries + 1;
    IF tries > 8 THEN
      RAISE EXCEPTION 'Failed to generate unique qr_code after % tries', tries 
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN out;
END;
$$;


ALTER FUNCTION "public"."gen_qr_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_event_sponsors"("p_event_ids" "uuid"[]) RETURNS TABLE("event_id" "uuid", "primary_sponsor" "jsonb", "sponsors" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH base AS (
    SELECT
      so.event_id,
      s.name,
      s.logo_url,
      sp.tier,
      so.amount_cents,
      so.created_at
    FROM public.sponsorship_orders so
    JOIN public.sponsors s         ON s.id = so.sponsor_id
    JOIN public.sponsorship_packages sp ON sp.id = so.package_id
    WHERE so.event_id = ANY(p_event_ids)
      AND so.status IN ('accepted','live','completed')
      AND sp.is_active = true
  ),
  ranked AS (
    SELECT
      event_id,
      jsonb_build_object(
        'name', name,
        'logo_url', logo_url,
        'tier', tier,
        'amount_cents', amount_cents
      ) AS sponsor_obj,
      ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY amount_cents DESC, created_at ASC) AS rn
    FROM base
  ),
  agg AS (
    SELECT
      event_id,
      (SELECT sponsor_obj FROM ranked r2 WHERE r2.event_id = r.event_id AND r2.rn = 1) AS primary_sponsor,
      jsonb_agg(sponsor_obj ORDER BY rn) AS sponsors
    FROM ranked r
    GROUP BY event_id
  )
  SELECT event_id, primary_sponsor, sponsors FROM agg;
$$;


ALTER FUNCTION "public"."get_active_event_sponsors"("p_event_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_credits"("p_wallet_id" "uuid" DEFAULT NULL::"uuid", "p_org_wallet_id" "uuid" DEFAULT NULL::"uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(quantity_remaining), 0)
  INTO v_total
  FROM public.credit_lots
  WHERE (
    (p_wallet_id IS NOT NULL AND wallet_id = p_wallet_id) OR
    (p_org_wallet_id IS NOT NULL AND org_wallet_id = p_org_wallet_id)
  )
  AND quantity_remaining > 0
  AND (expires_at IS NULL OR expires_at > now());
  
  RETURN v_total;
END;
$$;


ALTER FUNCTION "public"."get_available_credits"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_credits"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") IS 'Returns total available credits (excluding expired lots)';



CREATE OR REPLACE FUNCTION "public"."get_campaign_analytics"("p_campaign_ids" "uuid"[], "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("campaign_id" "uuid", "org_id" "uuid", "date" "date", "impressions" bigint, "unique_users" bigint, "unique_sessions" bigint, "clicks" bigint, "conversions" bigint, "revenue_cents" bigint, "credits_spent" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT mv.*
  FROM campaign_analytics_daily mv
  JOIN campaigns c ON c.id = mv.campaign_id
  JOIN org_memberships om ON om.org_id = c.org_id
  WHERE mv.campaign_id = ANY(p_campaign_ids)
    AND mv.date BETWEEN p_start_date AND p_end_date
    AND om.user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_campaign_analytics"("p_campaign_ids" "uuid"[], "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_credit_lot_breakdown"("p_wallet_id" "uuid" DEFAULT NULL::"uuid", "p_org_wallet_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("lot_id" "uuid", "remaining" integer, "purchased" integer, "unit_price_cents" integer, "source" "text", "expires_at" timestamp with time zone, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.id,
    cl.quantity_remaining,
    cl.quantity_purchased,
    cl.unit_price_cents,
    cl.source,
    cl.expires_at,
    cl.created_at
  FROM public.credit_lots cl
  WHERE (
    (p_wallet_id IS NOT NULL AND cl.wallet_id = p_wallet_id) OR
    (p_org_wallet_id IS NOT NULL AND cl.org_wallet_id = p_org_wallet_id)
  )
  AND cl.quantity_remaining > 0
  ORDER BY 
    CASE WHEN cl.expires_at IS NULL THEN 1 ELSE 0 END,
    cl.expires_at ASC NULLS LAST,
    cl.created_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_credit_lot_breakdown"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_credit_lot_breakdown"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") IS 'Returns detailed breakdown of available credit lots for UI display';



CREATE OR REPLACE FUNCTION "public"."get_current_user_org_role"("p_org_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT m.role::text
  FROM public.org_memberships m
  WHERE m.org_id = p_org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_current_user_org_role"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_attendees"("p_event" "uuid", "p_limit" integer DEFAULT 60, "p_offset" integer DEFAULT 0) RETURNS TABLE("user_id" "uuid", "display_name" "text", "photo_url" "text", "joined_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
WITH per_user AS (
  SELECT
    t.owner_user_id AS user_id,
    MIN(t.created_at) AS joined_at
  FROM tickets t
  WHERE t.event_id = p_event
    AND t.status IN ('issued','transferred','redeemed')
  GROUP BY t.owner_user_id
)
SELECT
  pu.user_id,
  up.display_name,
  up.photo_url,
  pu.joined_at
FROM per_user pu
JOIN user_profiles up ON up.user_id = pu.user_id
ORDER BY pu.joined_at DESC, pu.user_id  -- stable order + tiebreaker
LIMIT p_limit OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_event_attendees"("p_event" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_kpis_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") RETURNS TABLE("event_id" "uuid", "d" "date", "orders" bigint, "units" bigint, "gmv_cents" bigint, "fees_cents" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    o.event_id,
    DATE_TRUNC('day', o.paid_at)::date AS d,
    COUNT(DISTINCT o.id) AS orders,
    SUM(oi.quantity) AS units,
    SUM(o.total_cents) AS gmv_cents,
    SUM(o.fees_cents) AS fees_cents
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.status = 'paid'
    AND o.event_id = ANY(p_event_ids)
    AND DATE_TRUNC('day', o.paid_at)::date >= p_from_date
    AND DATE_TRUNC('day', o.paid_at)::date <= p_to_date
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


ALTER FUNCTION "public"."get_event_kpis_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_posts"("p_event_ids" "uuid"[], "p_k" integer DEFAULT 3) RETURNS TABLE("id" "uuid", "event_id" "uuid", "text" "text", "created_at" timestamp with time zone, "media_urls" "text"[], "like_count" integer, "comment_count" integer, "author_user_id" "uuid", "author_display_name" "text", "author_is_organizer" boolean, "ticket_tier_id" "uuid", "author_badge_label" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  WITH ranked AS (
    SELECT 
      p.id,
      p.event_id,
      p.text,
      p.created_at,
      p.media_urls,
      p.like_count,
      p.comment_count,
      p.author_user_id,
      up.display_name as author_display_name,
      (p.author_user_id = e.created_by) as author_is_organizer,
      p.ticket_tier_id,
      -- Get the user's highest tier badge for this event (for attendees)
      CASE 
        WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
        ELSE COALESCE(get_user_event_badge(p.author_user_id, p.event_id), 'ATTENDEE')
      END as author_badge_label,
      ROW_NUMBER() OVER (PARTITION BY p.event_id ORDER BY p.created_at DESC) as rn
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    LEFT JOIN user_profiles up ON up.user_id = p.author_user_id
    WHERE p.event_id = ANY(p_event_ids)
      AND p.deleted_at IS NULL
      AND e.visibility = 'public'
  )
  SELECT 
    id, event_id, text, created_at, media_urls, 
    like_count, comment_count, author_user_id, 
    author_display_name, author_is_organizer, ticket_tier_id, author_badge_label
  FROM ranked
  WHERE rn <= p_k
$$;


ALTER FUNCTION "public"."get_event_posts"("p_event_ids" "uuid"[], "p_k" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_social_links"("links" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  -- Check if it's an array
  IF jsonb_typeof(links) != 'array' THEN
    RETURN false;
  END IF;
  
  -- Check array length
  IF jsonb_array_length(links) > 3 THEN
    RETURN false;
  END IF;
  
  -- Check each element structure
  FOR i IN 0..jsonb_array_length(links) - 1 LOOP
    IF NOT (
      links->i ? 'platform' AND 
      links->i ? 'url' AND 
      links->i ? 'is_primary' AND
      jsonb_typeof(links->i->'platform') = 'string' AND
      jsonb_typeof(links->i->'url') = 'string' AND
      jsonb_typeof(links->i->'is_primary') = 'boolean'
    ) THEN
      RETURN false;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$$;


ALTER FUNCTION "public"."validate_social_links"("links" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "events"."event_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "ticket_tier_id" "uuid",
    "text" "text",
    "media_urls" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone,
    "like_count" integer DEFAULT 0 NOT NULL,
    "comment_count" integer DEFAULT 0 NOT NULL,
    "deleted_at" timestamp with time zone,
    "post_type" "text" DEFAULT 'post'::"text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "reply_count" integer DEFAULT 0 NOT NULL,
    "share_count" integer DEFAULT 0 NOT NULL,
    "edited_at" timestamp with time zone,
    "pinned" boolean DEFAULT false NOT NULL,
    "link_url" "text",
    "link_meta" "jsonb" DEFAULT '{}'::"jsonb",
    "moderation_state" "text" DEFAULT 'clean'::"text" NOT NULL,
    "language" "text",
    CONSTRAINT "event_posts_moderation_state_check" CHECK (("moderation_state" = ANY (ARRAY['clean'::"text", 'flagged'::"text", 'removed'::"text"]))),
    CONSTRAINT "event_posts_post_type_check" CHECK (("post_type" = ANY (ARRAY['post'::"text", 'reshare'::"text", 'announcement'::"text", 'ad'::"text"]))),
    CONSTRAINT "event_posts_visibility_check" CHECK (("visibility" = ANY (ARRAY['public'::"text", 'followers'::"text", 'private'::"text"])))
);

ALTER TABLE ONLY "events"."event_posts" REPLICA IDENTITY FULL;


ALTER TABLE "events"."event_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "users"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "phone" "text",
    "photo_url" "text",
    "role" "text" DEFAULT 'attendee'::"text",
    "verification_status" "public"."verification_status" DEFAULT 'none'::"public"."verification_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "social_links" "jsonb" DEFAULT '[]'::"jsonb",
    "sponsor_mode_enabled" boolean DEFAULT false NOT NULL,
    "bio" "text",
    "location" "text",
    CONSTRAINT "check_social_links_limit" CHECK (("jsonb_array_length"("social_links") <= 3)),
    CONSTRAINT "check_social_links_structure" CHECK ("public"."validate_social_links"("social_links")),
    CONSTRAINT "check_user_role" CHECK (("role" = ANY (ARRAY['attendee'::"text", 'organizer'::"text"])))
);


ALTER TABLE "users"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_posts_with_meta_v2" AS
 SELECT "p"."id",
    "p"."event_id",
    "p"."author_user_id",
    "p"."ticket_tier_id",
    "p"."text",
    "p"."media_urls",
    "p"."created_at",
    "p"."updated_at",
    "p"."like_count",
    "p"."comment_count",
    "p"."deleted_at",
    "up"."display_name" AS "author_display_name",
    "up"."photo_url" AS "author_photo_url"
   FROM ("events"."event_posts" "p"
     JOIN "users"."user_profiles" "up" ON (("up"."user_id" = "p"."author_user_id")))
  WHERE ("p"."deleted_at" IS NULL);


ALTER VIEW "public"."event_posts_with_meta_v2" OWNER TO "postgres";


COMMENT ON VIEW "public"."event_posts_with_meta_v2" IS 'SECURITY DEFINER: Optimized post feed with metadata. Respects event visibility and ticket ownership.';



CREATE OR REPLACE FUNCTION "public"."get_event_posts_cursor_v2"("in_event_id" "uuid", "in_limit" integer DEFAULT 30, "in_cursor_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "in_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS SETOF "public"."event_posts_with_meta_v2"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.event_posts_with_meta_v2
  WHERE event_id = in_event_id
    AND (
      in_cursor_ts IS NULL
      OR (created_at, id) < (in_cursor_ts, in_cursor_id)
    )
  ORDER BY created_at DESC, id DESC
  LIMIT LEAST(in_limit, 100);
END$$;


ALTER FUNCTION "public"."get_event_posts_cursor_v2"("in_event_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_recommendations"("p_sponsor_id" "uuid", "p_limit" integer DEFAULT 10) RETURNS TABLE("event_id" "uuid", "event_title" "text", "category" "text", "start_at" timestamp with time zone, "match_score" numeric, "quality_score" numeric, "engagement_metrics" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    e.id AS event_id,
    e.title AS event_title,
    e.category,
    e.start_at,
    sm.score AS match_score,
    eqs.final_quality_score AS quality_score,
    jsonb_build_object(
      'total_views', eqs.total_views,
      'tickets_sold', eqs.tickets_sold,
      'conversion_rate', eqs.conversion_rate,
      'engagement_rate', eqs.engagement_rate,
      'social_mentions', eqs.social_mentions,
      'quality_tier', eqs.quality_tier
    ) AS engagement_metrics
  FROM public.sponsorship_matches sm
  JOIN public.events e ON e.id = sm.event_id
  LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
  WHERE sm.sponsor_id = p_sponsor_id
  AND sm.score > 0.5
  ORDER BY sm.score DESC, eqs.final_quality_score DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_event_recommendations"("p_sponsor_id" "uuid", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_event_recommendations"("p_sponsor_id" "uuid", "p_limit" integer) IS 'Get personalized event recommendations for a sponsor';



CREATE OR REPLACE FUNCTION "public"."get_event_scans_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") RETURNS TABLE("event_id" "uuid", "d" "date", "scans" bigint, "dupes" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    sl.event_id,
    DATE_TRUNC('day', sl.created_at)::date AS d,
    COUNT(*) AS scans,
    SUM(CASE WHEN sl.result = 'duplicate' THEN 1 ELSE 0 END) AS dupes
  FROM scan_logs sl
  WHERE sl.event_id = ANY(p_event_ids)
    AND DATE_TRUNC('day', sl.created_at)::date >= p_from_date
    AND DATE_TRUNC('day', sl.created_at)::date <= p_to_date
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;


ALTER FUNCTION "public"."get_event_scans_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_feed_item_for_post"("p_user" "uuid", "p_post_id" "uuid") RETURNS TABLE("item_type" "text", "sort_ts" timestamp with time zone, "item_id" "uuid", "event_id" "uuid", "event_title" "text", "event_description" "text", "event_starts_at" timestamp with time zone, "event_cover_image" "text", "event_organizer" "text", "event_organizer_id" "uuid", "event_location" "text", "author_id" "uuid", "author_name" "text", "author_badge" "text", "media_urls" "text"[], "content" "text", "metrics" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    'post'::text,
    p.created_at,
    p.id,
    p.event_id,
    e.title,
    e.description,
    e.start_at,
    e.cover_image_url,
    eup.display_name,
    e.created_by,
    COALESCE(e.city, e.venue, 'TBA'),
    p.author_user_id,
    p.author_name,
    p.author_badge_label,
    p.media_urls,
    p.text,
    jsonb_build_object(
      'likes', COALESCE(p.like_count, 0),
      'comments', COALESCE(p.comment_count, 0)
    )
  FROM event_posts_with_meta p
  JOIN events e ON e.id = p.event_id
  JOIN user_profiles eup ON eup.user_id = e.created_by
  WHERE p.id = p_post_id
    AND p.deleted_at IS NULL
    AND can_view_event(p_user, p.event_id);
$$;


ALTER FUNCTION "public"."get_feed_item_for_post"("p_user" "uuid", "p_post_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_hero_feed"("p_limit" integer DEFAULT 5) RETURNS TABLE("id" "uuid", "title" "text", "start_at" timestamp with time zone, "city" "text", "venue" "text", "cover_image_url" "text", "organizer_display_name" "text", "created_by" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.id,
    e.title,
    e.start_at,
    e.city,
    e.venue,
    e.cover_image_url,
    up.display_name as organizer_display_name,
    e.created_by
  FROM events e
  JOIN user_profiles up ON up.user_id = e.created_by
  WHERE e.visibility = 'public'
    AND e.start_at > now()
  ORDER BY e.start_at ASC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_hero_feed"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 5) RETURNS TABLE("event_id" "uuid", "title" "text", "description" "text", "start_at" timestamp with time zone, "cover_image_url" "text", "city" "text", "venue" "text", "created_by" "uuid", "owner_context_type" "public"."owner_context", "owner_context_id" "uuid", "organizer_display_name" "text", "organization_name" "text", "organizer_name" "text", "organization_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.id                              AS event_id,
    e.title,
    e.description,
    e.start_at,
    e.cover_image_url,
    e.city,
    e.venue,
    e.created_by,
    e.owner_context_type,
    e.owner_context_id,
    up.display_name                   AS organizer_display_name,
    o.name                            AS organization_name,
    COALESCE(o.name, up.display_name) AS organizer_name,
    CASE WHEN e.owner_context_type = 'organization'::owner_context
         THEN e.owner_context_id
         ELSE NULL
    END                               AS organization_id
  FROM public.events e
  JOIN public.user_profiles up
    ON up.user_id = e.created_by
  LEFT JOIN public.organizations o
    ON o.id = e.owner_context_id
   AND e.owner_context_type = 'organization'::owner_context
  WHERE e.visibility = 'public'
    AND e.start_at > now()
  ORDER BY e.start_at ASC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 40, "p_offset" integer DEFAULT 0) RETURNS TABLE("event_id" "uuid", "title" "text", "description" "text", "start_at" timestamp with time zone, "cover_image_url" "text", "city" "text", "venue" "text", "created_by" "uuid", "owner_context_type" "public"."owner_context", "owner_context_id" "uuid", "organizer_display_name" "text", "organization_name" "text", "organizer_name" "text", "organizer_id" "uuid", "recent_posts" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    e.id                               AS event_id,
    e.title,
    e.description,
    e.start_at,
    e.cover_image_url,
    e.city,
    e.venue,
    e.created_by,
    e.owner_context_type,
    e.owner_context_id,
    up.display_name                    AS organizer_display_name,
    o.name                             AS organization_name,
    /* ✅ resolved organizer fields */
    CASE
      WHEN e.owner_context_type = 'organization' AND o.name IS NOT NULL
        THEN o.name
      ELSE up.display_name
    END                                AS organizer_name,
    CASE
      WHEN e.owner_context_type = 'organization'
        THEN e.owner_context_id
      ELSE e.created_by
    END                                AS organizer_id,
    /* recent_posts for compatibility */
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'text', p.text,
          'created_at', p.created_at,
          'media_urls', p.media_urls,
          'like_count', p.like_count,
          'comment_count', p.comment_count,
          'author', jsonb_build_object(
            'id', p.author_user_id,
            'display_name', pup.display_name,
            'badge_label', CASE 
              WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
              ELSE 'ATTENDEE'
            END
          )
        )
      )
      FROM (
        SELECT p.*, ROW_NUMBER() OVER (ORDER BY p.created_at DESC) as rn
        FROM event_posts p
        LEFT JOIN user_profiles pup ON pup.user_id = p.author_user_id
        WHERE p.event_id = e.id AND p.deleted_at IS NULL
      ) p
      LEFT JOIN user_profiles pup ON pup.user_id = p.author_user_id
      WHERE p.rn <= 3
    ), '[]'::jsonb)                    AS recent_posts
  FROM events e
  JOIN user_profiles up ON up.user_id = e.created_by
  LEFT JOIN organizations o ON o.id = e.owner_context_id
  WHERE e.visibility = 'public'
    AND e.start_at > now()
  ORDER BY e.start_at ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_ids"("p_user_id" "uuid", "p_limit" integer DEFAULT 12) RETURNS TABLE("event_id" "uuid", "score" numeric)
    LANGUAGE "sql" STABLE
    AS $$
  WITH base AS (
    -- recent events and/or those with recent posts
    SELECT
      e.id AS event_id,
      -- Freshness: future events score higher, with a decay for very distant events
      CASE 
        WHEN e.start_at > now() THEN 
          -- Future events: score higher for events closer to now
          -- Avoid division by zero by adding 1 day minimum
          GREATEST(0.1, 1.0 / (1 + EXTRACT(EPOCH FROM (e.start_at - now())) / 86400.0 + 1))
        ELSE 
          -- Past events: very low score but not zero
          0.05
      END AS freshness,
      -- Engagement: likes + comments from posts in last 7 days
      COALESCE((
        SELECT SUM(COALESCE(p.like_count,0) + COALESCE(p.comment_count,0))
        FROM event_posts p
        WHERE p.event_id = e.id
          AND p.created_at >= now() - INTERVAL '7 days'
          AND p.deleted_at IS NULL
      ), 0) AS engagement,
      -- Affinity: follows on organizer or event by this user
      CASE
        WHEN p_user_id IS NULL THEN 0
        ELSE (
          SELECT COUNT(1)::NUMERIC
          FROM follows f
          WHERE f.follower_user_id = p_user_id
            AND (
              (f.target_type = 'event' AND f.target_id = e.id)
              OR (f.target_type = 'organizer' AND f.target_id = e.owner_context_id)
            )
        )
      END AS affinity
    FROM events e
    WHERE e.visibility IN ('public', 'unlisted')
  )
  SELECT
    event_id,
    -- Tune weights: freshness 0.6, engagement 0.3, affinity 0.1
    (freshness * 0.6) + (LEAST(1, engagement / NULLIF(10.0, 0)) * 0.3) + (LEAST(1, affinity) * 0.1) AS score
  FROM base
  ORDER BY score DESC
  LIMIT p_limit
$$;


ALTER FUNCTION "public"."get_home_feed_ids"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer DEFAULT 80, "p_offset" integer DEFAULT 0) RETURNS TABLE("item_type" "text", "item_id" "uuid", "event_id" "uuid", "score" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
WITH
candidate_events AS (
  SELECT
    e.id AS event_id,
    /* symmetric linear decay over 180 days around NOW */
    GREATEST(
      0,
      1.0 - ABS(EXTRACT(EPOCH FROM (now() - e.start_at)) / 86400.0) / 180.0
    ) AS freshness
  FROM events e
  WHERE e.visibility = 'public'
    AND e.start_at > now() - INTERVAL '180 days'
),
engagement AS (
  SELECT
    p.event_id,
    COALESCE(SUM(p.like_count),0) * 1.0
    + COALESCE(SUM(p.comment_count),0) * 1.5 AS engagement
  FROM event_posts p
  WHERE p.deleted_at IS NULL
  GROUP BY 1
),
affinity AS (
  SELECT e.id AS event_id,
         COALESCE(follow_evt.weight,0)
       + COALESCE(follow_org.weight,0)
       + COALESCE(ticket_affinity.weight,0) AS affinity
  FROM events e
  LEFT JOIN LATERAL (
    SELECT 1.0 AS weight
    FROM follows ef
    WHERE ef.follower_user_id = p_user
      AND ef.target_type = 'event'
      AND ef.target_id = e.id
    LIMIT 1
  ) follow_evt ON TRUE
  LEFT JOIN LATERAL (
    SELECT 0.8 AS weight
    FROM follows ofo
    WHERE ofo.follower_user_id = p_user
      AND ofo.target_type = 'organizer'
      AND ofo.target_id = e.created_by
    LIMIT 1
  ) follow_org ON TRUE
  LEFT JOIN LATERAL (
    SELECT 1.2 AS weight
    FROM tickets t
    WHERE t.owner_user_id = p_user
      AND t.event_id = e.id
      AND t.status IN ('issued', 'transferred', 'redeemed')
    LIMIT 1
  ) ticket_affinity ON TRUE
),
z AS (
  SELECT
    ce.event_id,
    ce.freshness,
    COALESCE(e.engagement, 0) AS engagement,
    COALESCE(a.affinity,   0) AS affinity
  FROM candidate_events ce
  LEFT JOIN engagement e ON e.event_id = ce.event_id
  LEFT JOIN affinity   a ON a.event_id = ce.event_id
),
stats AS (
  SELECT
    COALESCE(MAX(freshness),  0.001) AS max_fresh,
    COALESCE(MAX(engagement), 0.001) AS max_eng,
    COALESCE(MAX(affinity),   0.001) AS max_aff
  FROM z
),
scored_events AS (
  SELECT
    z.event_id,
    (0.60 * (z.freshness  / s.max_fresh)) +
    (0.25 * (z.engagement / s.max_eng)) +
    (0.15 * (z.affinity   / s.max_aff)) AS base_score
  FROM z, stats s
),
all_posts AS (
  SELECT
    p.event_id,
    p.id AS post_id,
    p.created_at,
    (COALESCE(p.like_count,0) + 1.2 * COALESCE(p.comment_count,0)) AS engagement_score
  FROM event_posts p
  WHERE p.deleted_at IS NULL
    AND p.created_at > now() - INTERVAL '180 days'  -- keep in-window
),
ranked_posts AS (
  SELECT
    ap.*,
    ROW_NUMBER() OVER (
      PARTITION BY ap.event_id
      ORDER BY ap.created_at DESC, ap.engagement_score DESC, ap.post_id DESC
    ) AS rn
  FROM all_posts ap
),
items AS (
  SELECT
    'event'::text AS item_type,
    e.event_id::uuid AS item_id,
    e.event_id,
    e.base_score AS score,
    NULL::timestamptz AS created_at,
    0::numeric AS engagement_score
  FROM scored_events e

  UNION ALL

  SELECT
    'post'::text AS item_type,
    rp.post_id AS item_id,
    rp.event_id,
    e.base_score * 0.98 AS score,
    rp.created_at,
    rp.engagement_score
  FROM ranked_posts rp
  JOIN scored_events e ON e.event_id = rp.event_id
  WHERE rp.rn <= 3  -- cap posts per event
)
SELECT item_type, item_id, event_id, score
FROM items
ORDER BY
  score DESC,
  engagement_score DESC NULLS LAST,
  created_at DESC NULLS LAST,
  event_id DESC,
  item_id DESC
LIMIT p_limit OFFSET p_offset;
$$;


ALTER FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer DEFAULT 80, "p_cursor_item_id" "uuid" DEFAULT NULL::"uuid", "p_categories" "text"[] DEFAULT NULL::"text"[], "p_user_lat" double precision DEFAULT NULL::double precision, "p_user_lng" double precision DEFAULT NULL::double precision, "p_max_distance_miles" double precision DEFAULT NULL::double precision, "p_date_filters" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("item_type" "text", "item_id" "uuid", "event_id" "uuid", "score" numeric, "sort_ts" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
WITH
-- Calculate distance for all events if user location provided
distance_calc AS (
  SELECT
    e.id AS event_id,
    CASE 
      WHEN e.lat IS NULL OR e.lng IS NULL OR p_user_lat IS NULL OR p_user_lng IS NULL THEN NULL
      ELSE (
        3959 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_user_lat)) 
            * cos(radians(e.lat)) 
            * cos(radians(e.lng) - radians(p_user_lng)) 
            + sin(radians(p_user_lat)) 
            * sin(radians(e.lat))
          ))
        )
      )
    END AS distance_miles
  FROM events e
  WHERE p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
),
-- Check date filters
date_filter_check AS (
  SELECT 
    e.id AS event_id,
    e.start_at,
    CASE
      WHEN p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL THEN true
      WHEN 'Tonight' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('day', now()) 
        AND e.start_at < date_trunc('day', now() + interval '1 day')
      ) THEN true
      WHEN 'This Weekend' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now()) + interval '4 days' + interval '18 hours'
        AND e.start_at < date_trunc('week', now()) + interval '7 days'
      ) THEN true
      WHEN 'This Week' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now())
        AND e.start_at < date_trunc('week', now()) + interval '7 days'
      ) THEN true
      WHEN 'Next Week' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now()) + interval '7 days'
        AND e.start_at < date_trunc('week', now()) + interval '14 days'
      ) THEN true
      WHEN 'This Month' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('month', now())
        AND e.start_at < date_trunc('month', now()) + interval '1 month'
      ) THEN true
      WHEN 'Next Month' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('month', now()) + interval '1 month'
        AND e.start_at < date_trunc('month', now()) + interval '2 months'
      ) THEN true
      ELSE false
    END AS passes_date_filter
  FROM events e
),
candidate_events AS (
  SELECT
    e.id AS event_id,
    COALESCE(e.start_at, e.created_at, now()) AS anchor_ts,
    GREATEST(
      0,
      1.0 - ABS(EXTRACT(EPOCH FROM (now() - COALESCE(e.start_at, e.created_at, now()))) / 86400.0) / 180.0
    ) AS freshness,
    dc.distance_miles
  FROM events e
  LEFT JOIN distance_calc dc ON dc.event_id = e.id
  LEFT JOIN date_filter_check dfc ON dfc.event_id = e.id
  WHERE e.visibility = 'public'
    AND (
      COALESCE(e.start_at, e.created_at, now()) > now() - INTERVAL '365 days'
      OR EXISTS (
        SELECT 1
        FROM event_posts ep
        WHERE ep.event_id = e.id
          AND ep.deleted_at IS NULL
      )
    )
    -- Apply category filter
    AND (
      p_categories IS NULL 
      OR array_length(p_categories, 1) IS NULL 
      OR e.category = ANY(p_categories)
    )
    -- Apply distance filter
    AND (
      p_max_distance_miles IS NULL
      OR dc.distance_miles IS NULL
      OR dc.distance_miles <= p_max_distance_miles
    )
    -- Apply date filter
    AND (
      p_date_filters IS NULL
      OR array_length(p_date_filters, 1) IS NULL
      OR dfc.passes_date_filter = true
    )
),
engagement AS (
  SELECT
    p.event_id,
    COALESCE(SUM(p.like_count), 0) * 1.0
      + COALESCE(SUM(p.comment_count), 0) * 1.5 AS engagement
  FROM event_posts p
  WHERE p.deleted_at IS NULL
  GROUP BY 1
),
affinity AS (
  SELECT e.id AS event_id,
         COALESCE(follow_evt.weight, 0)
       + COALESCE(follow_org.weight, 0)
       + COALESCE(ticket_affinity.weight, 0)
       + COALESCE(location_boost.weight, 0) AS affinity
  FROM events e
  LEFT JOIN LATERAL (
    SELECT 1.0 AS weight
    FROM follows ef
    WHERE ef.follower_user_id = p_user
      AND ef.target_type = 'event'
      AND ef.target_id = e.id
    LIMIT 1
  ) follow_evt ON TRUE
  LEFT JOIN LATERAL (
    SELECT 0.8 AS weight
    FROM follows ofo
    WHERE ofo.follower_user_id = p_user
      AND ofo.target_type = 'organizer'
      AND ofo.target_id = e.created_by
    LIMIT 1
  ) follow_org ON TRUE
  LEFT JOIN LATERAL (
    SELECT 1.2 AS weight
    FROM tickets t
    WHERE t.owner_user_id = p_user
      AND t.event_id = e.id
      AND t.status IN ('issued', 'transferred', 'redeemed')
    LIMIT 1
  ) ticket_affinity ON TRUE
  LEFT JOIN LATERAL (
    SELECT 
      CASE 
        WHEN dc.distance_miles IS NOT NULL AND dc.distance_miles <= 10 THEN 0.5
        WHEN dc.distance_miles IS NOT NULL AND dc.distance_miles <= 25 THEN 0.3
        ELSE 0
      END AS weight
    FROM distance_calc dc
    WHERE dc.event_id = e.id
    LIMIT 1
  ) location_boost ON TRUE
),
z AS (
  SELECT
    ce.event_id,
    ce.freshness,
    COALESCE(e.engagement, 0) AS engagement,
    COALESCE(a.affinity,   0) AS affinity
  FROM candidate_events ce
  LEFT JOIN engagement e ON e.event_id = ce.event_id
  LEFT JOIN affinity   a ON a.event_id = ce.event_id
),
stats AS (
  SELECT
    GREATEST(COALESCE(MAX(freshness),  0.001), 0.001) AS max_fresh,
    GREATEST(COALESCE(MAX(engagement), 0.001), 0.001) AS max_eng,
    GREATEST(COALESCE(MAX(affinity),   0.001), 0.001) AS max_aff
  FROM z
),
scored_events AS (
  SELECT
    z.event_id,
    (0.60 * (COALESCE(z.freshness, 0)  / GREATEST(s.max_fresh, 0.001))) +
    (0.25 * (COALESCE(z.engagement, 0) / GREATEST(s.max_eng, 0.001))) +
    (0.15 * (COALESCE(z.affinity, 0)   / GREATEST(s.max_aff, 0.001))) AS base_score
  FROM z, stats s
),
all_posts AS (
  SELECT
    p.event_id,
    p.id AS post_id,
    p.created_at,
    (COALESCE(p.like_count,0) + 1.2 * COALESCE(p.comment_count,0)) AS engagement_score
  FROM event_posts p
  JOIN candidate_events ce ON ce.event_id = p.event_id
  WHERE p.deleted_at IS NULL
    AND p.created_at > now() - INTERVAL '365 days'
),
ranked_posts AS (
  SELECT
    ap.*,
    ROW_NUMBER() OVER (
      PARTITION BY ap.event_id
      ORDER BY ap.created_at DESC, ap.engagement_score DESC, ap.post_id DESC
    ) AS rn
  FROM all_posts ap
),
event_order AS (
  SELECT
    e.event_id,
    e.base_score,
    ce.anchor_ts,
    ev.start_at,
    ROW_NUMBER() OVER (
      ORDER BY e.base_score DESC, ce.anchor_ts DESC NULLS LAST, e.event_id DESC
    ) AS event_rank
  FROM scored_events e
  JOIN candidate_events ce ON ce.event_id = e.event_id
  JOIN events ev ON ev.id = e.event_id
),
items AS (
  SELECT
    'event'::text AS item_type,
    eo.event_id::uuid AS item_id,
    eo.event_id,
    eo.base_score AS score,
    COALESCE(eo.anchor_ts, eo.start_at) AS sort_ts,
    eo.event_rank,
    0 AS within_event_rank
  FROM event_order eo

  UNION ALL

  SELECT
    'post'::text AS item_type,
    rp.post_id AS item_id,
    rp.event_id,
    eo.base_score * 0.98 AS score,
    rp.created_at AS sort_ts,
    eo.event_rank,
    rp.rn AS within_event_rank
  FROM ranked_posts rp
  JOIN event_order eo ON eo.event_id = rp.event_id
  WHERE rp.rn <= 3
),
ordered AS (
  SELECT
    i.item_type,
    i.item_id,
    i.event_id,
    i.score,
    COALESCE(i.sort_ts, now()) AS sort_ts,
    i.event_rank,
    i.within_event_rank,
    ROW_NUMBER() OVER (
      ORDER BY i.event_rank, i.within_event_rank, COALESCE(i.sort_ts, now()) DESC, i.item_id DESC
    ) AS rn
  FROM items i
),
cursor_position AS (
  SELECT rn
  FROM ordered
  WHERE p_cursor_item_id IS NOT NULL
    AND item_id = p_cursor_item_id
)
SELECT
  item_type,
  item_id,
  event_id,
  score,
  sort_ts
FROM ordered
WHERE (SELECT rn FROM cursor_position) IS NULL
   OR ordered.rn > (SELECT rn FROM cursor_position)
ORDER BY rn
LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_ids_v2"("in_user_id" "uuid", "in_limit" integer DEFAULT 30, "in_cursor_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "in_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("kind" "text", "id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH posts(kind, id, created_at) AS (
    SELECT 'post'::text, p.id::uuid, p.created_at
    FROM public.event_posts p
    WHERE p.deleted_at IS NULL
  ),
  events(kind, id, created_at) AS (
    SELECT 'event'::text, e.id::uuid, e.created_at
    FROM public.events e
    WHERE e.completed_at IS NULL
  ),
  items AS (
    SELECT * FROM posts
    UNION ALL
    SELECT * FROM events
  )
  SELECT items.kind, items.id, items.created_at
  FROM items
  WHERE (
    in_cursor_ts IS NULL
    OR (items.created_at, items.id) < (in_cursor_ts, in_cursor_id)
  )
  ORDER BY items.created_at DESC, items.id DESC
  LIMIT LEAST(in_limit, 100);
END$$;


ALTER FUNCTION "public"."get_home_feed_ids_v2"("in_user_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_ranked"("p_user_id" "uuid", "p_limit" integer DEFAULT 80, "p_cursor_item_id" "uuid" DEFAULT NULL::"uuid", "p_categories" "text"[] DEFAULT NULL::"text"[], "p_user_lat" double precision DEFAULT NULL::double precision, "p_user_lng" double precision DEFAULT NULL::double precision, "p_max_distance_miles" double precision DEFAULT NULL::double precision, "p_date_filters" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("item_type" "text", "item_id" "uuid", "event_id" "uuid", "score" numeric, "sort_ts" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  SELECT *
  FROM public.get_home_feed_ids(p_user_id, p_limit, p_cursor_item_id, p_categories, p_user_lat, p_user_lng, p_max_distance_miles, p_date_filters);
$$;


ALTER FUNCTION "public"."get_home_feed_ranked"("p_user_id" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_v2"("p_user" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 20, "p_cursor_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "text" DEFAULT NULL::"text") RETURNS TABLE("item_type" "text", "sort_ts" timestamp with time zone, "item_id" "text", "event_id" "uuid", "event_title" "text", "event_description" "text", "event_starts_at" timestamp with time zone, "event_cover_image" "text", "event_organizer" "text", "event_organizer_id" "uuid", "event_owner_context_type" "text", "event_location" "text", "author_id" "uuid", "author_name" "text", "author_badge" "text", "author_social_links" "jsonb", "media_urls" "text"[], "content" "text", "metrics" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH events_stream AS (
    SELECT
      'event'::text AS item_type,
      e.created_at AS sort_ts,
      e.id::text AS item_id,
      e.id AS event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.start_at AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      CASE 
        WHEN e.owner_context_type = 'organization' THEN org.name
        ELSE up.display_name
      END AS event_organizer,
      e.owner_context_id AS event_organizer_id,
      e.owner_context_type::text AS event_owner_context_type,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      NULL::uuid AS author_id,
      NULL::text AS author_name,
      NULL::text AS author_badge,
      NULL::jsonb AS author_social_links,
      NULL::text[] AS media_urls,
      NULL::text AS content,
      jsonb_build_object(
        'visibility', e.visibility,
        'attendee_count', 0
      ) AS metrics
    FROM events e
    LEFT JOIN user_profiles up ON up.user_id = e.owner_context_id AND e.owner_context_type = 'individual'
    LEFT JOIN organizations org ON org.id = e.owner_context_id AND e.owner_context_type = 'organization'
    WHERE (p_user IS NULL AND e.visibility = 'public') 
       OR (p_user IS NOT NULL AND can_view_event(p_user, e.id))
  ),
  posts_stream AS (
    SELECT
      'post'::text AS item_type,
      p.created_at AS sort_ts,
      p.id::text AS item_id,
      p.event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.start_at AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      CASE 
        WHEN e.owner_context_type = 'organization' THEN org.name
        ELSE eup.display_name
      END AS event_organizer,
      e.owner_context_id AS event_organizer_id,
      e.owner_context_type::text AS event_owner_context_type,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      p.author_user_id AS author_id,
      ap.display_name AS author_name,
      CASE 
        WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
        ELSE COALESCE(get_user_highest_tier_badge(p.author_user_id, e.id), 'ATTENDEE')
      END AS author_badge,
      COALESCE(ap.social_links, '[]'::jsonb) AS author_social_links,
      p.media_urls,
      p.text AS content,
      jsonb_build_object(
        'likes', COALESCE(p.like_count, 0),
        'comments', COALESCE(p.comment_count, 0),
        'viewer_has_liked', CASE 
          WHEN p_user IS NULL THEN false
          ELSE EXISTS (
            SELECT 1 FROM event_reactions r 
            WHERE r.post_id = p.id 
              AND r.user_id = p_user 
              AND r.kind = 'like'
          )
        END
      ) AS metrics
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    LEFT JOIN user_profiles eup ON eup.user_id = e.owner_context_id AND e.owner_context_type = 'individual'
    LEFT JOIN organizations org ON org.id = e.owner_context_id AND e.owner_context_type = 'organization'
    LEFT JOIN user_profiles ap ON ap.user_id = p.author_user_id
    WHERE p.deleted_at IS NULL
      AND ((p_user IS NULL AND e.visibility = 'public') 
           OR (p_user IS NOT NULL AND can_view_event(p_user, p.event_id)))
  ),
  unioned AS (
    SELECT * FROM events_stream
    UNION ALL
    SELECT * FROM posts_stream
  ),
  filtered AS (
    SELECT *
    FROM unioned u
    WHERE
      CASE
        WHEN p_cursor_ts IS NULL THEN TRUE
        WHEN p_cursor_id IS NULL THEN u.sort_ts < p_cursor_ts
        ELSE (u.sort_ts, u.item_id) < (p_cursor_ts, p_cursor_id)
      END
  )
  SELECT *
  FROM filtered
  ORDER BY sort_ts DESC, item_id DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_home_feed_v2"("p_user" "uuid" DEFAULT NULL::"uuid", "p_limit" integer DEFAULT 20, "p_cursor_ts" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_cursor_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("item_type" "text", "sort_ts" timestamp with time zone, "item_id" "uuid", "event_id" "uuid", "event_title" "text", "event_description" "text", "event_starts_at" timestamp with time zone, "event_cover_image" "text", "event_organizer" "text", "event_organizer_id" "uuid", "event_owner_context_type" "text", "event_location" "text", "author_id" "uuid", "author_name" "text", "author_badge" "text", "author_social_links" "jsonb", "media_urls" "text"[], "content" "text", "metrics" "jsonb", "sponsor" "jsonb", "sponsors" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  _cursor_ts timestamptz := p_cursor_ts;
  _cursor_id uuid := p_cursor_id;
BEGIN
  RETURN QUERY
  WITH feed_items AS (
    -- Events
    SELECT
      'event'::text AS item_type,
      e.start_at     AS sort_ts,
      e.id           AS item_id,
      e.id           AS event_id,
      e.title        AS event_title,
      e.description  AS event_description,
      e.start_at     AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      COALESCE(up.display_name, 'Organizer') AS event_organizer,
      e.created_by   AS event_organizer_id,
      e.owner_context_type::text AS event_owner_context_type,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      NULL::uuid     AS author_id,
      NULL::text     AS author_name,
      NULL::text     AS author_badge,
      NULL::jsonb    AS author_social_links,
      NULL::text[]   AS media_urls,
      NULL::text     AS content,
      jsonb_build_object() AS metrics
    FROM public.events e
    LEFT JOIN public.user_profiles up ON up.user_id = e.created_by
    WHERE e.visibility = 'public'
      AND e.start_at > now() - interval '1 day'
      AND (_cursor_ts IS NULL OR e.start_at < _cursor_ts OR (e.start_at = _cursor_ts AND e.id < _cursor_id))

    UNION ALL

    -- Posts
    SELECT
      'post'::text AS item_type,
      p.created_at AS sort_ts,
      p.id         AS item_id,
      p.event_id,
      e.title      AS event_title,
      e.description AS event_description,
      e.start_at    AS event_starts_at,
      e.cover_image_url AS event_cover_image,
      COALESCE(oup.display_name, 'Organizer') AS event_organizer,
      e.created_by  AS event_organizer_id,
      e.owner_context_type::text AS event_owner_context_type,
      COALESCE(e.city, e.venue, 'TBA') AS event_location,
      p.author_user_id AS author_id,
      p.author_name,
      p.author_badge_label AS author_badge,
      COALESCE(aup.social_links, '[]'::jsonb) AS author_social_links,
      p.media_urls,
      p.text AS content,
      jsonb_build_object(
        'likes', COALESCE(p.like_count, 0),
        'comments', COALESCE(p.comment_count, 0)
      ) AS metrics
    FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    LEFT JOIN public.user_profiles oup ON oup.user_id = e.created_by
    LEFT JOIN public.user_profiles aup ON aup.user_id = p.author_user_id
    WHERE p.deleted_at IS NULL
      AND e.visibility = 'public'
      AND (_cursor_ts IS NULL OR p.created_at < _cursor_ts OR (p.created_at = _cursor_ts AND p.id < _cursor_id))
  ),
  limited AS (
    SELECT *
    FROM feed_items
    ORDER BY sort_ts DESC, item_id DESC
    LIMIT p_limit
  ),
  ev_ids AS (
    SELECT DISTINCT event_id FROM limited
  ),
  sponsors AS (
    SELECT * FROM public.get_active_event_sponsors(ARRAY(SELECT event_id FROM ev_ids))
  )
  SELECT
    lf.item_type,
    lf.sort_ts,
    lf.item_id,
    lf.event_id,
    lf.event_title,
    lf.event_description,
    lf.event_starts_at,
    lf.event_cover_image,
    lf.event_organizer,
    lf.event_organizer_id,
    lf.event_owner_context_type,
    lf.event_location,
    lf.author_id,
    lf.author_name,
    lf.author_badge,
    lf.author_social_links,
    lf.media_urls,
    lf.content,
    lf.metrics,
    CASE WHEN lf.item_type = 'event' THEN sp.primary_sponsor ELSE NULL END AS sponsor,
    CASE WHEN lf.item_type = 'event' THEN sp.sponsors        ELSE NULL END AS sponsors
  FROM limited lf
  LEFT JOIN sponsors sp ON sp.event_id = lf.event_id
  ORDER BY lf.sort_ts DESC, lf.item_id DESC;
END;
$$;


ALTER FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_inventory_health"() RETURNS TABLE("tier_id" "uuid", "tier_name" "text", "event_id" "uuid", "total_quantity" integer, "reserved_quantity" integer, "issued_quantity" integer, "available" integer, "health_status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT 
    tt.id as tier_id,
    tt.name as tier_name,
    tt.event_id,
    tt.total_quantity,
    tt.reserved_quantity,
    tt.issued_quantity,
    (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) as available,
    CASE 
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN 'OVERSOLD'
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 'SOLD_OUT'
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) <= 5 THEN 'LOW_INVENTORY'
      ELSE 'HEALTHY'
    END as health_status
  FROM ticket_tiers tt
  WHERE tt.status = 'active'
  ORDER BY 
    CASE 
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN 1
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 2
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) <= 5 THEN 3
      ELSE 4
    END,
    tt.event_id, tt.name;
$$;


ALTER FUNCTION "public"."get_inventory_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mutual_connections"("user1_id" "uuid", "user2_id" "uuid") RETURNS TABLE("mutual_user_id" "uuid", "mutual_user_name" "text", "mutual_user_photo" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  SELECT 
    f1.target_id,
    up.display_name,
    up.photo_url
  FROM public.follows f1
  JOIN public.follows f2 ON f1.target_id = f2.target_id
  JOIN public.user_profiles up ON up.user_id = f1.target_id
  WHERE f1.follower_user_id = $1
    AND f2.follower_user_id = $2
    AND f1.target_type = 'user'
    AND f2.target_type = 'user'
    AND f1.status = 'accepted'
    AND f2.status = 'accepted';
END;
$_$;


ALTER FUNCTION "public"."get_mutual_connections"("user1_id" "uuid", "user2_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_org_analytics"("p_org_id" "uuid") RETURNS TABLE("total_events" integer, "total_revenue" numeric, "total_attendees" integer, "completed_events" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id)::INTEGER as total_events,
    COALESCE(SUM(o.total_cents), 0)::NUMERIC / 100 as total_revenue,
    COUNT(DISTINCT t.owner_user_id)::INTEGER as total_attendees,
    COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::INTEGER as completed_events
  FROM events e
  LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'paid'
  LEFT JOIN tickets t ON t.event_id = e.id
  WHERE e.owner_context_type = 'organization' 
    AND e.owner_context_id = p_org_id;
END;
$$;


ALTER FUNCTION "public"."get_org_analytics"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_audio_tasks"() RETURNS TABLE("talk_id" "uuid", "talk_topic" "text", "talk_script" "text", "talk_voice_id" "text", "talk_language" "text", "asset_id" "uuid")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    st.id,
    st.topic,
    st.script,
    st.voice_id,
    st.language,
    sta.id as asset_id
  FROM safety_talks st
  INNER JOIN safety_talk_assets sta ON st.id = sta.talk_id
  WHERE sta.type = 'pending_audio'
    AND sta.status = 'pending'
    AND sta.created_at > NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."get_pending_audio_tasks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_post_engagement_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") RETURNS TABLE("event_id" "uuid", "post_id" "uuid", "d" "date", "likes" bigint, "comments" bigint, "shares" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    p.event_id,
    p.id AS post_id,
    DATE_TRUNC('day', r.created_at)::date AS d,
    COUNT(*) FILTER (WHERE r.kind = 'like') AS likes,
    COUNT(*) FILTER (WHERE r.kind = 'comment') AS comments,
    COUNT(*) FILTER (WHERE r.kind = 'share') AS shares
  FROM event_posts p
  LEFT JOIN event_reactions r ON r.post_id = p.id
  WHERE p.event_id = ANY(p_event_ids)
    AND (r.created_at IS NULL OR DATE_TRUNC('day', r.created_at)::date >= p_from_date)
    AND (r.created_at IS NULL OR DATE_TRUNC('day', r.created_at)::date <= p_to_date)
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;


ALTER FUNCTION "public"."get_post_engagement_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_recommendations"("p_user_id" "uuid", "p_limit" integer DEFAULT 10) RETURNS TABLE("event_id" "uuid", "score" numeric, "reason" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH user_interactions AS (
        SELECT DISTINCT ui.event_id
        FROM public.user_event_interactions ui
        WHERE ui.user_id = p_user_id
    ),
    popular_events AS (
        SELECT 
            e.id as event_id,
            COUNT(ui.user_id) * 0.1 as popularity_score,
            'popular' as reason
        FROM public.events e
        LEFT JOIN public.user_event_interactions ui ON e.id = ui.event_id
        WHERE e.start_at > now()
            AND e.visibility = 'public'
            AND ((SELECT COUNT(*) FROM user_interactions) = 0 OR e.id NOT IN (SELECT ui_inner.event_id FROM user_interactions ui_inner))
        GROUP BY e.id
        ORDER BY COUNT(ui.user_id) DESC
        LIMIT p_limit
    )
    SELECT pe.event_id, pe.popularity_score, pe.reason
    FROM popular_events pe;
END;
$$;


ALTER FUNCTION "public"."get_recommendations"("p_user_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sponsor_recommendations"("p_event_id" "uuid", "p_limit" integer DEFAULT 10) RETURNS TABLE("sponsor_id" "uuid", "sponsor_name" "text", "industry" "text", "match_score" numeric, "budget_fit" numeric, "audience_alignment" numeric, "quality_indicators" "jsonb")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT
    s.id AS sponsor_id,
    s.name AS sponsor_name,
    sp.industry,
    sm.score AS match_score,
    (sm.overlap_metrics->>'budget_fit')::numeric AS budget_fit,
    (sm.overlap_metrics->>'audience_overlap')::numeric AS audience_alignment,
    jsonb_build_object(
      'annual_budget_cents', sp.annual_budget_cents,
      'preferred_categories', sp.preferred_categories,
      'regions', sp.regions,
      'engagement_quality', (sm.overlap_metrics->>'engagement_quality')::numeric,
      'temporal_fit', (sm.overlap_metrics->>'temporal_fit')::numeric
    ) AS quality_indicators
  FROM public.sponsorship_matches sm
  JOIN public.sponsors s ON s.id = sm.sponsor_id
  JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE sm.event_id = p_event_id
  AND sm.score > 0.5
  ORDER BY sm.score DESC
  LIMIT p_limit;
$$;


ALTER FUNCTION "public"."get_sponsor_recommendations"("p_event_id" "uuid", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_sponsor_recommendations"("p_event_id" "uuid", "p_limit" integer) IS 'Get personalized sponsor recommendations for an event';



CREATE OR REPLACE FUNCTION "public"."get_tier_inventory_status"("p_tier_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'tier_id', id,
    'tier_name', name,
    'total_quantity', COALESCE(total_quantity, quantity),
    'reserved_quantity', reserved_quantity,
    'issued_quantity', issued_quantity,
    'available_quantity', COALESCE(total_quantity, quantity) - reserved_quantity - issued_quantity,
    'status', status,
    'price_cents', price_cents,
    'max_per_order', max_per_order
  )
  FROM public.ticket_tiers
  WHERE id = p_tier_id;
$$;


ALTER FUNCTION "public"."get_tier_inventory_status"("p_tier_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_top_posts_analytics"("p_event_id" "uuid", "p_metric" "text" DEFAULT 'views'::"text", "p_limit" integer DEFAULT 10) RETURNS TABLE("post_id" "uuid", "title" "text", "media_urls" "text"[], "views_total" bigint, "views_unique" bigint, "completions" bigint, "clicks_tickets" bigint, "clicks_total" bigint, "engagement_total" bigint, "ctr_tickets" numeric, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH post_metrics AS (
    SELECT 
      p.id as post_id,
      p.text as title,
      p.media_urls,
      p.created_at,
      COALESCE(SUM(CASE WHEN pv.qualified THEN 1 ELSE 0 END), 0) as views_total,
      COALESCE(COUNT(DISTINCT CASE WHEN pv.qualified THEN COALESCE(pv.user_id::text, pv.session_id) END), 0) as views_unique,
      COALESCE(SUM(CASE WHEN pv.completed THEN 1 ELSE 0 END), 0) as completions,
      COALESCE(SUM(CASE WHEN pc.target = 'tickets' THEN 1 ELSE 0 END), 0) as clicks_tickets,
      COALESCE(COUNT(pc.id), 0) as clicks_total,
      COALESCE(COUNT(r.id), 0) + COALESCE(COUNT(c.id), 0) as engagement_total
    FROM event_posts p
    LEFT JOIN post_views pv ON pv.post_id = p.id
    LEFT JOIN post_clicks pc ON pc.post_id = p.id
    LEFT JOIN event_reactions r ON r.post_id = p.id
    LEFT JOIN event_comments c ON c.post_id = p.id
    WHERE p.event_id = p_event_id
    GROUP BY p.id, p.text, p.media_urls, p.created_at
  )
  SELECT 
    pm.post_id,
    pm.title,
    pm.media_urls,
    pm.views_total,
    pm.views_unique,
    pm.completions,
    pm.clicks_tickets,
    pm.clicks_total,
    pm.engagement_total,
    CASE 
      WHEN pm.views_unique > 0 THEN (pm.clicks_tickets::numeric / pm.views_unique::numeric * 100)
      ELSE 0
    END as ctr_tickets,
    pm.created_at
  FROM post_metrics pm
  ORDER BY 
    CASE 
      WHEN p_metric = 'views' THEN pm.views_unique
      WHEN p_metric = 'ctr' THEN (CASE WHEN pm.views_unique > 0 THEN pm.clicks_tickets::numeric / pm.views_unique::numeric ELSE 0 END)
      WHEN p_metric = 'engagement' THEN pm.engagement_total
      ELSE pm.views_unique
    END DESC
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."get_top_posts_analytics"("p_event_id" "uuid", "p_metric" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_analytics"("p_user_id" "uuid") RETURNS TABLE("total_events" integer, "total_revenue" numeric, "total_attendees" integer, "completed_events" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id)::INTEGER as total_events,
    COALESCE(SUM(o.total_cents), 0)::NUMERIC / 100 as total_revenue,
    COUNT(DISTINCT t.owner_user_id)::INTEGER as total_attendees,
    COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::INTEGER as completed_events
  FROM events e
  LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'paid'
  LEFT JOIN tickets t ON t.event_id = e.id
  WHERE e.owner_context_type = 'individual' 
    AND e.owner_context_id = p_user_id;
END;
$$;


ALTER FUNCTION "public"."get_user_analytics"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_connections"("user_id" "uuid") RETURNS TABLE("connection_type" "text", "connection_id" "uuid", "connection_name" "text", "connection_photo" "text", "connection_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $_$
BEGIN
  RETURN QUERY
  -- People this user follows
  SELECT 
    'following'::TEXT,
    fp.target_id::UUID,
    fp.target_name::TEXT,
    fp.target_photo::TEXT,
    1::INTEGER
  FROM public.follow_profiles fp
  WHERE fp.follower_user_id = $1 
    AND fp.target_type = 'user'
    AND fp.status = 'accepted'
  
  UNION ALL
  
  -- People who follow this user
  SELECT 
    'followers'::TEXT,
    fp.follower_user_id::UUID,
    fp.follower_name::TEXT,
    fp.follower_photo::TEXT,
    1::INTEGER
  FROM public.follow_profiles fp
  WHERE fp.target_id = $1 
    AND fp.target_type = 'user'
    AND fp.status = 'accepted';
END;
$_$;


ALTER FUNCTION "public"."get_user_connections"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_earned_badges"("p_user_id" "uuid") RETURNS TABLE("badge_name" "text", "event_count" integer, "description" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.badge_label as badge_name,
    COUNT(*)::INTEGER as event_count,
    CASE 
      WHEN tt.badge_label = 'VIP' THEN 'VIP tier attendee'
      WHEN tt.badge_label = 'EARLY' THEN 'Early bird ticket holder'
      ELSE 'Event enthusiast'
    END as description
  FROM tickets t
  JOIN ticket_tiers tt ON tt.id = t.tier_id
  WHERE t.owner_user_id = p_user_id
    AND t.status IN ('issued', 'transferred', 'redeemed')
  GROUP BY tt.badge_label;
END;
$$;


ALTER FUNCTION "public"."get_user_earned_badges"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_event_badge"("p_user_id" "uuid", "p_event_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select tt.badge_label
  from public.tickets t
  join public.ticket_tiers tt on tt.id = t.tier_id
  where t.owner_user_id = p_user_id 
    and t.event_id = p_event_id
    and t.status in ('issued','transferred','redeemed')
  order by tt.price_cents desc nulls last, tt.sort_index asc
  limit 1;
$$;


ALTER FUNCTION "public"."get_user_event_badge"("p_user_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_highest_tier_badge"("user_id_param" "uuid", "event_id_param" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT tt.badge_label
  FROM tickets t
  JOIN ticket_tiers tt ON t.tier_id = tt.id
  WHERE t.owner_user_id = user_id_param 
    AND t.event_id = event_id_param
    AND t.status IN ('issued', 'transferred', 'redeemed')
    AND tt.badge_label IS NOT NULL
  ORDER BY tt.price_cents DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."get_user_highest_tier_badge"("user_id_param" "uuid", "event_id_param" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organizations"("user_uuid" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "verification_status" "public"."verification_status", "is_verified" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT o.id, o.name, o.verification_status, o.is_verified
  FROM public.organizations o
  INNER JOIN public.org_memberships om ON o.id = om.org_id
  WHERE om.user_id = user_uuid;
$$;


ALTER FUNCTION "public"."get_user_organizations"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_comment_count_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_posts
      SET comment_count = COALESCE(comment_count,0) + 1
      WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_posts
      SET comment_count = GREATEST(COALESCE(comment_count,0) - 1, 0)
      WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."handle_comment_count_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_like_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  PERFORM public.sync_post_like_count(COALESCE(NEW.post_id, OLD.post_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."handle_like_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, display_name, phone, role)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.raw_user_meta_data->>'phone',
    'attendee'
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_safety_talk_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO safety_talk_assets (
    talk_id,
    type,
    status,
    etag,
    created_at
  ) VALUES (
    NEW.id,
    'pending_audio',
    'pending',
    'trigger-' || NEW.id || '-' || EXTRACT(EPOCH FROM NOW()),
    NOW()
  ) ON CONFLICT (talk_id, type) DO UPDATE SET
    status = 'pending',
    updated_at = NOW();
    
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_safety_talk_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_ip"("ip_address" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Simple hash for IP privacy (you can enhance this with a salt)
  RETURN encode(digest(ip_address || 'rate_limit_salt', 'sha256'), 'hex');
END;
$$;


ALTER FUNCTION "public"."hash_ip"("ip_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."inc_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.event_posts
  SET like_count = like_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN NULL;
END; $$;


ALTER FUNCTION "public"."inc_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_sponsorship_order_version"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.version_number := OLD.version_number + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_sponsorship_order_version"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_org_admin"("p_org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin'::text, 'owner'::text])
  );
$$;


ALTER FUNCTION "public"."is_current_user_org_admin"("p_org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_individual_owner"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_context_type = 'individual'
      and e.owner_context_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_event_individual_owner"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_manager"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select public.is_event_individual_owner(p_event_id) or public.is_event_org_editor(p_event_id);
$$;


ALTER FUNCTION "public"."is_event_manager"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_event_org_editor"("p_event_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and e.owner_context_type = 'organization'
      and public.is_org_role(e.owner_context_id, array['editor','admin','owner'])
  );
$$;


ALTER FUNCTION "public"."is_event_org_editor"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_org_role"("p_org_id" "uuid", "p_roles" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT public.get_current_user_org_role(p_org_id) = ANY(p_roles);
$$;


ALTER FUNCTION "public"."is_org_role"("p_org_id" "uuid", "p_roles" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_service_role"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'service'
$$;


ALTER FUNCTION "public"."is_service_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_request"("p_correlation_id" "uuid", "p_source_type" "text", "p_function_name" "text", "p_http_method" "text", "p_url" "text", "p_headers" "jsonb", "p_body" "jsonb", "p_response_status" integer, "p_response_body" "jsonb", "p_execution_time_ms" integer, "p_error_message" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.request_logs(
    correlation_id, source_type, function_name, http_method, url,
    headers, body, response_status, response_body, execution_time_ms, error_message
  ) VALUES (
    p_correlation_id, p_source_type, p_function_name, p_http_method, p_url,
    p_headers, p_body, p_response_status, p_response_body, p_execution_time_ms, p_error_message
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;


ALTER FUNCTION "public"."log_request"("p_correlation_id" "uuid", "p_source_type" "text", "p_function_name" "text", "p_http_method" "text", "p_url" "text", "p_headers" "jsonb", "p_body" "jsonb", "p_response_status" integer, "p_response_body" "jsonb", "p_execution_time_ms" integer, "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_audio_complete"("p_talk_id" "uuid", "p_asset_id" "uuid", "p_url" "text", "p_file_size" bigint, "p_etag" "text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE safety_talk_assets 
  SET 
    type = 'audio',
    status = 'completed',
    url = p_url,
    file_size = p_file_size,
    etag = p_etag,
    updated_at = NOW()
  WHERE id = p_asset_id AND talk_id = p_talk_id;
  
  DELETE FROM safety_talk_assets 
  WHERE talk_id = p_talk_id 
    AND type = 'pending_audio' 
    AND id != p_asset_id;
END;
$$;


ALTER FUNCTION "public"."mark_audio_complete"("p_talk_id" "uuid", "p_asset_id" "uuid", "p_url" "text", "p_file_size" bigint, "p_etag" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_event_completed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Mark event as completed when end_at is in the past
  IF NEW.end_at < NOW() AND OLD.completed_at IS NULL THEN
    NEW.completed_at = NOW();
    
    -- Check if organizer should get pro upgrade (25+ completed events)
    IF (SELECT COUNT(*) FROM events 
        WHERE created_by = NEW.created_by 
        AND completed_at IS NOT NULL) >= 25 THEN
      
      -- Update user profile to pro status
      UPDATE user_profiles 
      SET verification_status = 'pro'
      WHERE user_id = NEW.created_by 
      AND verification_status != 'pro';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_event_completed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text"("txt" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  SELECT lower(COALESCE(txt,''));
$$;


ALTER FUNCTION "public"."normalize_text"("txt" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_user_follow"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  follower_name TEXT;
BEGIN
  -- Only notify for user-to-user follows
  IF NEW.target_type = 'user' AND NEW.target_id != NEW.follower_user_id THEN
    -- Get the follower's display name
    SELECT display_name INTO follower_name
    FROM public.user_profiles
    WHERE user_id = NEW.follower_user_id;
    
    -- Use the helper function to create the notification
    PERFORM public.create_follow_notification(
      NEW.target_id,
      NEW.follower_user_id,
      COALESCE(follower_name, 'Someone')
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_user_follow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_wallet_apply_purchase"("p_wallet_id" "uuid", "p_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text" DEFAULT 'Credit purchase'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tx_id UUID;
BEGIN
  IF p_credits <= 0 THEN RAISE EXCEPTION 'credits must be positive'; END IF;

  -- Idempotency
  IF p_stripe_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT id INTO v_tx_id FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id;
    RETURN v_tx_id;
  END IF;

  -- Lock wallet row
  PERFORM 1 FROM public.org_wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Ledger
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, invoice_id, stripe_event_id
  ) VALUES (
    p_wallet_id, p_credits, 'purchase', p_description, p_invoice_id, p_stripe_event_id
  ) RETURNING id INTO v_tx_id;

  -- Balance
  UPDATE public.org_wallets
     SET balance_credits = balance_credits + p_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;


ALTER FUNCTION "public"."org_wallet_apply_purchase"("p_wallet_id" "uuid", "p_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_wallet_apply_refund"("p_wallet_id" "uuid", "p_refund_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text" DEFAULT 'Refund'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tx_id UUID;
BEGIN
  IF p_refund_credits <= 0 THEN RAISE EXCEPTION 'refund credits must be positive'; END IF;

  -- Idempotency
  IF p_stripe_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT id INTO v_tx_id FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id;
    RETURN v_tx_id;
  END IF;

  -- Lock wallet row
  PERFORM 1 FROM public.org_wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Create negative transaction
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, invoice_id, stripe_event_id
  ) VALUES (
    p_wallet_id, -p_refund_credits, 'refund', p_description, p_invoice_id, p_stripe_event_id
  ) RETURNING id INTO v_tx_id;

  -- Update balance
  UPDATE public.org_wallets
     SET balance_credits = balance_credits - p_refund_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;


ALTER FUNCTION "public"."org_wallet_apply_refund"("p_wallet_id" "uuid", "p_refund_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_wallet_apply_spend"("p_wallet_id" "uuid", "p_credits" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_description" "text" DEFAULT 'Campaign spend'::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tx_id UUID;
  v_balance INT;
BEGIN
  IF p_credits <= 0 THEN RAISE EXCEPTION 'spend credits must be positive'; END IF;

  -- Lock wallet row and check balance
  SELECT balance_credits INTO v_balance 
  FROM public.org_wallets 
  WHERE id = p_wallet_id 
  FOR UPDATE;

  IF v_balance < p_credits THEN
    RAISE EXCEPTION 'insufficient funds';
  END IF;

  -- Create negative transaction
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, reference_type, reference_id
  ) VALUES (
    p_wallet_id, -p_credits, 'spend', p_description, p_reference_type, p_reference_id
  ) RETURNING id INTO v_tx_id;

  -- Update balance
  UPDATE public.org_wallets
     SET balance_credits = balance_credits - p_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;


ALTER FUNCTION "public"."org_wallet_apply_spend"("p_wallet_id" "uuid", "p_credits" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_description" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."org_wallet_freeze_if_negative"("p_wallet_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_bal INT;
BEGIN
  SELECT balance_credits INTO v_bal FROM public.org_wallets WHERE id = p_wallet_id;
  IF v_bal < 0 THEN
    UPDATE public.org_wallets SET status = 'frozen', updated_at = now() WHERE id = p_wallet_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."org_wallet_freeze_if_negative"("p_wallet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."process_match_queue"("p_batch_size" integer DEFAULT 100) RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  processed_count integer := 0;
  queue_item record;
BEGIN
  FOR queue_item IN 
    SELECT * 
    FROM public.fit_recalc_queue 
    WHERE processed_at IS NULL
    ORDER BY queued_at
    LIMIT p_batch_size
  LOOP
    BEGIN
      -- Compute and upsert match
      PERFORM public.fn_upsert_match(queue_item.event_id, queue_item.sponsor_id);
      
      -- Mark as processed
      UPDATE public.fit_recalc_queue
      SET processed_at = now()
      WHERE id = queue_item.id;
      
      processed_count := processed_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but continue processing
        RAISE WARNING 'Failed to process queue item %: %', queue_item.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN processed_count;
END $$;


ALTER FUNCTION "public"."process_match_queue"("p_batch_size" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_match_queue"("p_batch_size" integer) IS 'Process pending match score calculations from the queue';



CREATE OR REPLACE FUNCTION "public"."process_payout_queue"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  queue_item record;
  processed_count integer := 0;
  fee_cents integer;
  organizer_amount integer;
BEGIN
  -- Process pending payouts in priority order
  FOR queue_item IN 
    SELECT pq.*, so.*, e.owner_context_id as organizer_id
    FROM public.payout_queue pq
    JOIN public.sponsorship_orders so ON so.id = pq.order_id
    JOIN public.events e ON e.id = so.event_id
    WHERE pq.status = 'pending' 
    AND pq.scheduled_for <= now()
    AND pq.attempts < pq.max_attempts
    ORDER BY pq.priority DESC, pq.created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Calculate platform fee
      fee_cents := public.calculate_platform_fee(queue_item.amount_cents, queue_item.organizer_id);
      organizer_amount := queue_item.amount_cents - fee_cents;
      
      -- Update queue item status
      UPDATE public.payout_queue
      SET status = 'processing', attempts = attempts + 1
      WHERE id = queue_item.id;
      
      -- Create payout record
      INSERT INTO public.sponsorship_payouts (
        order_id,
        organizer_id,
        amount_cents,
        application_fee_cents,
        status
      ) VALUES (
        queue_item.order_id,
        queue_item.organizer_id,
        organizer_amount,
        fee_cents,
        'processing'
      );
      
      -- Update queue status
      UPDATE public.payout_queue
      SET status = 'completed', processed_at = now()
      WHERE id = queue_item.id;
      
      -- Update order status
      UPDATE public.sponsorship_orders
      SET payout_status = 'completed'
      WHERE id = queue_item.order_id;
      
      processed_count := processed_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Mark as failed
        UPDATE public.payout_queue
        SET status = 'failed', 
            error_message = SQLERRM,
            processed_at = now()
        WHERE id = queue_item.id;
        
        -- Update order status
        UPDATE public.sponsorship_orders
        SET payout_status = 'failed',
            payout_failure_reason = SQLERRM
        WHERE id = queue_item.order_id;
    END;
  END LOOP;
  
  RETURN processed_count;
END $$;


ALTER FUNCTION "public"."process_payout_queue"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."process_payout_queue"() IS 'Processes pending payouts from the queue';



CREATE OR REPLACE FUNCTION "public"."prune_dead_letters"("p_keep_days" integer DEFAULT 30) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.dead_letter_webhooks
  WHERE status IN ('succeeded')
    AND updated_at < now() - make_interval(days => p_keep_days);
END; $$;


ALTER FUNCTION "public"."prune_dead_letters"("p_keep_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_request_logs"("p_keep_days" integer DEFAULT 14) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  DELETE FROM public.request_logs
  WHERE created_at < now() - make_interval(days => p_keep_days);
END; $$;


ALTER FUNCTION "public"."prune_request_logs"("p_keep_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_sponsorship_payout"("p_order_id" "uuid", "p_priority" integer DEFAULT 0) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  queue_id uuid;
  order_record record;
BEGIN
  -- Get order details
  SELECT so.*, e.owner_context_id as organizer_id
  INTO order_record
  FROM public.sponsorship_orders so
  JOIN public.events e ON e.id = so.event_id
  WHERE so.id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Check if already queued
  IF EXISTS (SELECT 1 FROM public.payout_queue WHERE order_id = p_order_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Payout already queued for order: %', p_order_id;
  END IF;
  
  -- Insert into queue
  INSERT INTO public.payout_queue (order_id, priority, scheduled_for)
  VALUES (p_order_id, p_priority, now())
  RETURNING id INTO queue_id;
  
  -- Update order status
  UPDATE public.sponsorship_orders
  SET payout_status = 'processing'
  WHERE id = p_order_id;
  
  RETURN queue_id;
END $$;


ALTER FUNCTION "public"."queue_sponsorship_payout"("p_order_id" "uuid", "p_priority" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."queue_sponsorship_payout"("p_order_id" "uuid", "p_priority" integer) IS 'Queues a sponsorship payout for processing';



CREATE OR REPLACE FUNCTION "public"."recompute_org_wallet_balance"("p_wallet_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE new_balance INT;
BEGIN
  SELECT COALESCE(SUM(credits_delta), 0) INTO new_balance
  FROM public.org_wallet_transactions WHERE wallet_id = p_wallet_id;
  
  UPDATE public.org_wallets
  SET balance_credits = new_balance, updated_at = now()
  WHERE id = p_wallet_id;
  
  RETURN new_balance;
END;
$$;


ALTER FUNCTION "public"."recompute_org_wallet_balance"("p_wallet_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_wallet_balance"("p_wallet" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  new_balance INT;
BEGIN
  SELECT COALESCE(SUM(credits_delta),0) INTO new_balance
  FROM wallet_transactions WHERE wallet_id = p_wallet;
  UPDATE wallets SET balance_credits = new_balance, updated_at = NOW()
  WHERE id = p_wallet;
  RETURN new_balance;
END;
$$;


ALTER FUNCTION "public"."recompute_wallet_balance"("p_wallet" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_ads_analytics"("p_concurrently" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  t1 TIMESTAMPTZ := clock_timestamp();
  t2 TIMESTAMPTZ;
BEGIN
  IF p_concurrently THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_daily';
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY creative_analytics_daily';
  ELSE
    EXECUTE 'REFRESH MATERIALIZED VIEW campaign_analytics_daily';
    EXECUTE 'REFRESH MATERIALIZED VIEW creative_analytics_daily';
  END IF;
  
  t2 := clock_timestamp();
  INSERT INTO mv_refresh_log(concurrent, duration_ms, note)
  VALUES (p_concurrently, EXTRACT(MILLISECONDS FROM t2 - t1), 'ads_analytics (campaign + creative)');
END;
$$;


ALTER FUNCTION "public"."refresh_ads_analytics"("p_concurrently" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_analytics_views"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.event_kpis_daily;
  REFRESH MATERIALIZED VIEW public.event_scans_daily;
  REFRESH MATERIALIZED VIEW public.post_engagement_daily;
END;
$$;


ALTER FUNCTION "public"."refresh_analytics_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_campaign_analytics"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW campaign_analytics_daily;
END;
$$;


ALTER FUNCTION "public"."refresh_campaign_analytics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_campaign_analytics"("p_concurrently" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  t1 TIMESTAMPTZ := clock_timestamp();
  t2 TIMESTAMPTZ;
BEGIN
  IF p_concurrently THEN
    EXECUTE 'REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_daily';
  ELSE
    EXECUTE 'REFRESH MATERIALIZED VIEW campaign_analytics_daily';
  END IF;
  
  t2 := clock_timestamp();
  INSERT INTO mv_refresh_log(concurrent, duration_ms)
  VALUES (p_concurrently, EXTRACT(MILLISECONDS FROM t2 - t1));
END;
$$;


ALTER FUNCTION "public"."refresh_campaign_analytics"("p_concurrently" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_conversation_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE public.direct_conversations
    SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."refresh_conversation_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_covis"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.event_covis;
EXCEPTION WHEN feature_not_supported THEN
    REFRESH MATERIALIZED VIEW public.event_covis;
END;
$$;


ALTER FUNCTION "public"."refresh_covis"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_event_quality_scores"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
  
  -- Log the refresh
  INSERT INTO public.mv_refresh_log (ran_at, concurrent, note)
  VALUES (now(), true, 'Refreshed event quality scores');
  
  RAISE NOTICE 'Event quality scores refreshed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error refreshing event quality scores: %', SQLERRM;
END $$;


ALTER FUNCTION "public"."refresh_event_quality_scores"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_event_quality_scores"() IS 'Refreshes the materialized view of event quality scores';



CREATE OR REPLACE FUNCTION "public"."refresh_search_docs"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- This function does nothing - search_docs_mv no longer exists
  -- Created as placeholder to prevent "function does not exist" errors
  RETURN;
END;
$$;


ALTER FUNCTION "public"."refresh_search_docs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_semantic_marketplace"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Refresh materialized views
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
  
  -- Log the refresh
  INSERT INTO public.mv_refresh_log (ran_at, concurrent, note)
  VALUES (now(), true, 'Refreshed semantic marketplace');
  
  RAISE NOTICE 'Semantic marketplace refreshed successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error refreshing semantic marketplace: %', SQLERRM;
END $$;


ALTER FUNCTION "public"."refresh_semantic_marketplace"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_semantic_marketplace"() IS 'Refreshes all semantic marketplace components';



CREATE OR REPLACE FUNCTION "public"."refresh_sponsorship_mvs"("concurrent" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  t_start timestamptz := now();
  dur_ms int;
BEGIN
  IF concurrent THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_quality_scores;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_event_reach_snapshot;
  ELSE
    REFRESH MATERIALIZED VIEW public.mv_event_quality_scores;
    REFRESH MATERIALIZED VIEW public.mv_event_reach_snapshot;
  END IF;

  dur_ms := EXTRACT(EPOCH FROM (now() - t_start))::int * 1000;

  INSERT INTO public.mv_refresh_log (concurrent, duration_ms, note)
  VALUES (concurrent, dur_ms, 'sponsorship_mvs');
END;
$$;


ALTER FUNCTION "public"."refresh_sponsorship_mvs"("concurrent" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."refresh_sponsorship_mvs"("concurrent" boolean) IS 'Refreshes sponsorship materialized views and logs duration';



CREATE OR REPLACE FUNCTION "public"."refresh_trending_posts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.trending_posts;
END;
$$;


ALTER FUNCTION "public"."refresh_trending_posts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_user_affinity"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_event_affinity;
EXCEPTION WHEN feature_not_supported THEN
    REFRESH MATERIALIZED VIEW public.user_event_affinity;
END;
$$;


ALTER FUNCTION "public"."refresh_user_affinity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_user_embedding"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    INSERT INTO public.user_embeddings (user_id, updated_at)
    VALUES (p_user_id, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET updated_at = now();
END;
$$;


ALTER FUNCTION "public"."refresh_user_embedding"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_video_analytics"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY event_video_kpis_daily;
  
  -- Update counters from the last 60 days of data
  INSERT INTO event_video_counters (
    event_id, views_total, views_unique, completions, avg_dwell_ms,
    clicks_tickets, clicks_details, clicks_organizer, clicks_share, clicks_comment,
    likes, comments, shares, updated_at
  )
  SELECT 
    event_id,
    sum(views_total) AS views_total,
    sum(views_unique) AS views_unique, -- Note: this is approximate for unique counts
    sum(completions) AS completions,
    avg(avg_dwell_ms) AS avg_dwell_ms,
    sum(clicks_tickets) AS clicks_tickets,
    sum(clicks_details) AS clicks_details,
    sum(clicks_organizer) AS clicks_organizer,
    sum(clicks_share) AS clicks_share,
    sum(clicks_comment) AS clicks_comment,
    sum(likes) AS likes,
    sum(comments) AS comments,
    sum(shares) AS shares,
    now() AS updated_at
  FROM event_video_kpis_daily 
  WHERE d >= current_date - interval '60 days'
  GROUP BY event_id
  ON CONFLICT (event_id) DO UPDATE SET
    views_total = EXCLUDED.views_total,
    views_unique = EXCLUDED.views_unique,
    completions = EXCLUDED.completions,
    avg_dwell_ms = EXCLUDED.avg_dwell_ms,
    clicks_tickets = EXCLUDED.clicks_tickets,
    clicks_details = EXCLUDED.clicks_details,
    clicks_organizer = EXCLUDED.clicks_organizer,
    clicks_share = EXCLUDED.clicks_share,
    clicks_comment = EXCLUDED.clicks_comment,
    likes = EXCLUDED.likes,
    comments = EXCLUDED.comments,
    shares = EXCLUDED.shares,
    updated_at = EXCLUDED.updated_at;
END;
$$;


ALTER FUNCTION "public"."refresh_video_analytics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_ticket_holds"("p_hold_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_session_id" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT 'expired'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_hold_record RECORD;
  v_released_count integer := 0;
  v_total_quantity integer := 0;
BEGIN
  -- Build based on parameters
  IF p_hold_ids IS NOT NULL THEN
    -- Release specific holds
    FOR v_hold_record IN 
      SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
      FROM ticket_holds h
      WHERE h.id = ANY(p_hold_ids)
        AND h.status = 'active'
      FOR UPDATE
    LOOP
      -- Use advisory lock for the tier
      PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
      
      -- Release reserved quantity
      UPDATE ticket_tiers
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_hold_record.quantity)
      WHERE id = v_hold_record.tier_id;
      
      -- Mark hold as released
      UPDATE ticket_holds
      SET status = 'released'
      WHERE id = v_hold_record.id;
      
      -- Log the operation
      INSERT INTO inventory_operations (
        tier_id, operation_type, quantity, session_id, user_id, metadata
      ) VALUES (
        v_hold_record.tier_id, 'release', v_hold_record.quantity,
        v_hold_record.session_id, v_hold_record.user_id,
        jsonb_build_object('hold_id', v_hold_record.id, 'reason', p_reason)
      );
      
      v_released_count := v_released_count + 1;
      v_total_quantity := v_total_quantity + v_hold_record.quantity;
    END LOOP;
  ELSIF p_session_id IS NOT NULL THEN
    -- Release all active holds for a session
    FOR v_hold_record IN 
      SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
      FROM ticket_holds h
      WHERE h.session_id = p_session_id
        AND h.status = 'active'
      FOR UPDATE
    LOOP
      -- Use advisory lock for the tier
      PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
      
      -- Release reserved quantity
      UPDATE ticket_tiers
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_hold_record.quantity)
      WHERE id = v_hold_record.tier_id;
      
      -- Mark hold as released
      UPDATE ticket_holds
      SET status = 'released'
      WHERE id = v_hold_record.id;
      
      -- Log the operation
      INSERT INTO inventory_operations (
        tier_id, operation_type, quantity, session_id, user_id, metadata
      ) VALUES (
        v_hold_record.tier_id, 'release', v_hold_record.quantity,
        v_hold_record.session_id, v_hold_record.user_id,
        jsonb_build_object('hold_id', v_hold_record.id, 'reason', p_reason)
      );
      
      v_released_count := v_released_count + 1;
      v_total_quantity := v_total_quantity + v_hold_record.quantity;
    END LOOP;
  ELSE
    -- Release all expired holds
    FOR v_hold_record IN 
      SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
      FROM ticket_holds h
      WHERE h.status = 'active'
        AND h.expires_at < now()
      FOR UPDATE
    LOOP
      -- Use advisory lock for the tier
      PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
      
      -- Release reserved quantity
      UPDATE ticket_tiers
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_hold_record.quantity)
      WHERE id = v_hold_record.tier_id;
      
      -- Mark hold as expired
      UPDATE ticket_holds
      SET status = 'expired'
      WHERE id = v_hold_record.id;
      
      -- Log the operation
      INSERT INTO inventory_operations (
        tier_id, operation_type, quantity, session_id, user_id, metadata
      ) VALUES (
        v_hold_record.tier_id, 'release', v_hold_record.quantity,
        v_hold_record.session_id, v_hold_record.user_id,
        jsonb_build_object('hold_id', v_hold_record.id, 'reason', 'expired')
      );
      
      v_released_count := v_released_count + 1;
      v_total_quantity := v_total_quantity + v_hold_record.quantity;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'released_holds', v_released_count,
    'total_quantity', v_total_quantity,
    'reason', p_reason
  );
END;
$$;


ALTER FUNCTION "public"."release_ticket_holds"("p_hold_ids" "uuid"[], "p_session_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_tickets_atomic"("p_tier_id" "uuid", "p_quantity" integer, "p_session_id" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_expires_minutes" integer DEFAULT 15) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_tier_record RECORD;
  v_hold_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Input validation
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_QUANTITY',
      'error', 'Quantity must be greater than 0'
    );
  END IF;
  
  -- Use advisory lock for strict serialization per tier
  PERFORM pg_advisory_xact_lock(hashtext(p_tier_id::text));
  
  -- Calculate expiration time
  v_expires_at := now() + interval '1 minute' * p_expires_minutes;
  
  -- Guarded increment: only succeeds if enough inventory remains
  -- This checks and increments in one atomic operation
  UPDATE ticket_tiers
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = p_tier_id
    AND status = 'active'
    AND (reserved_quantity + issued_quantity + p_quantity) <= COALESCE(total_quantity, quantity)
    AND (max_per_order IS NULL OR p_quantity <= max_per_order)
  RETURNING 
    id, name, price_cents, reserved_quantity, issued_quantity, 
    COALESCE(total_quantity, quantity) AS total_qty,
    max_per_order
  INTO v_tier_record;
  
  -- Check if update succeeded
  IF NOT FOUND THEN
    -- Get current state for better error message
    SELECT 
      name, 
      reserved_quantity + issued_quantity AS current_sold,
      COALESCE(total_quantity, quantity) AS total_qty,
      max_per_order,
      status
    INTO v_tier_record
    FROM ticket_tiers 
    WHERE id = p_tier_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TIER_NOT_FOUND',
        'error', 'Ticket tier not found'
      );
    END IF;
    
    IF v_tier_record.status != 'active' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TIER_INACTIVE',
        'error', format('Ticket tier %s is not available for purchase', v_tier_record.name)
      );
    END IF;
    
    IF v_tier_record.max_per_order IS NOT NULL AND p_quantity > v_tier_record.max_per_order THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'EXCEEDS_MAX_PER_ORDER',
        'error', format('Cannot purchase more than %s tickets per order for %s', v_tier_record.max_per_order, v_tier_record.name),
        'max_per_order', v_tier_record.max_per_order,
        'requested_quantity', p_quantity
      );
    END IF;
    
    -- Must be insufficient inventory
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INSUFFICIENT_INVENTORY',
      'error', format('Only %s tickets available for %s', 
        v_tier_record.total_qty - v_tier_record.current_sold, 
        v_tier_record.name),
      'available_quantity', v_tier_record.total_qty - v_tier_record.current_sold,
      'requested_quantity', p_quantity
    );
  END IF;
  
  -- Create hold record
  INSERT INTO ticket_holds (
    tier_id, quantity, session_id, user_id, expires_at, status
  ) VALUES (
    p_tier_id, p_quantity, p_session_id, p_user_id, v_expires_at, 'active'
  ) RETURNING id INTO v_hold_id;
  
  -- Log the operation
  INSERT INTO inventory_operations (
    tier_id, operation_type, quantity, session_id, user_id, metadata
  ) VALUES (
    p_tier_id, 'reserve', p_quantity, p_session_id, p_user_id,
    jsonb_build_object(
      'hold_id', v_hold_id,
      'expires_at', v_expires_at
    )
  );
  
  -- Return success with reservation details
  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'tier_id', v_tier_record.id,
    'reserved_quantity', p_quantity,
    'session_id', p_session_id,
    'user_id', p_user_id,
    'expires_at', v_expires_at,
    'tier_name', v_tier_record.name,
    'price_cents', v_tier_record.price_cents,
    'new_reserved_quantity', v_tier_record.reserved_quantity,
    'remaining_quantity', v_tier_record.total_qty - v_tier_record.reserved_quantity - v_tier_record.issued_quantity
  );
END;
$$;


ALTER FUNCTION "public"."reserve_tickets_atomic"("p_tier_id" "uuid", "p_quantity" integer, "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_tickets_batch"("p_reservations" "jsonb", "p_session_id" "text" DEFAULT NULL::"text", "p_user_id" "uuid" DEFAULT NULL::"uuid", "p_expires_minutes" integer DEFAULT 15) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reservation jsonb;
  v_result jsonb;
  v_results jsonb[] := '{}';
  v_all_success boolean := true;
  v_error_results jsonb[] := '{}';
  v_hold_ids uuid[] := '{}';
BEGIN
  -- Process each reservation in sequence
  FOR v_reservation IN SELECT jsonb_array_elements(p_reservations)
  LOOP
    SELECT reserve_tickets_atomic(
      (v_reservation->>'tier_id')::uuid,
      (v_reservation->>'quantity')::integer,
      p_session_id,
      p_user_id,
      p_expires_minutes
    ) INTO v_result;
    
    v_results := v_results || v_result;
    
    -- Collect hold IDs for successful reservations
    IF (v_result->>'success')::boolean THEN
      v_hold_ids := v_hold_ids || (v_result->>'hold_id')::uuid;
    ELSE
      v_all_success := false;
      v_error_results := v_error_results || v_result;
    END IF;
  END LOOP;
  
  -- If any reservation failed, rollback by raising exception
  -- This will automatically rollback all the reservation updates and hold insertions
  IF NOT v_all_success THEN
    RAISE EXCEPTION 'Batch reservation failed: %', 
      (SELECT string_agg(r->>'error', '; ') 
       FROM unnest(v_error_results) AS r);
  END IF;
  
  -- Return all successful reservations
  RETURN jsonb_build_object(
    'success', true,
    'reservations', array_to_json(v_results)::jsonb,
    'hold_ids', v_hold_ids,
    'session_id', p_session_id,
    'user_id', p_user_id,
    'total_items', array_length(v_results, 1),
    'expires_at', (v_results[1]->>'expires_at')::timestamptz
  );
END;
$$;


ALTER FUNCTION "public"."reserve_tickets_batch"("p_reservations" "jsonb", "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_campaign_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("campaign_id" "uuid", "date" "date", "impressions" bigint, "clicks" bigint, "conversions" bigint, "revenue_cents" bigint, "credits_spent" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    campaign_id,
    date,
    impressions,
    clicks,
    conversions,
    revenue_cents,
    credits_spent
  FROM campaign_analytics_daily_secured
  WHERE org_id = p_org_id
    AND date >= p_from
    AND date <= p_to
    AND (p_campaign_ids IS NULL OR campaign_id = ANY(p_campaign_ids))
  ORDER BY date, campaign_id;
$$;


ALTER FUNCTION "public"."rpc_campaign_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_creative_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_creative_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("creative_id" "uuid", "campaign_id" "uuid", "org_id" "uuid", "date" "date", "impressions" integer, "clicks" integer, "conversions" integer, "revenue_cents" integer, "credits_spent" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT cad.creative_id,
         cad.campaign_id,
         cad.org_id,
         cad.date,
         cad.impressions,
         cad.clicks,
         cad.conversions,
         cad.revenue_cents,
         cad.credits_spent
  FROM creative_analytics_daily cad
  WHERE cad.org_id = p_org_id
    AND cad.date BETWEEN p_from AND p_to
    AND (p_campaign_ids IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
    AND (p_creative_ids IS NULL OR cad.creative_id  = ANY(p_creative_ids))
    AND EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
    )
  ORDER BY cad.date ASC, cad.campaign_id ASC, cad.creative_id ASC;
$$;


ALTER FUNCTION "public"."rpc_creative_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_creative_analytics_rollup"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_creative_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_include_series" boolean DEFAULT false, "p_sort" "text" DEFAULT 'impressions'::"text", "p_dir" "text" DEFAULT 'desc'::"text", "p_limit" integer DEFAULT 100, "p_offset" integer DEFAULT 0) RETURNS TABLE("org_id" "uuid", "campaign_id" "uuid", "campaign_name" "text", "creative_id" "uuid", "headline" "text", "media_type" "text", "active" boolean, "poster_url" "text", "media_url" "text", "impressions" bigint, "clicks" bigint, "conversions" bigint, "revenue_cents" bigint, "credits_spent" bigint, "ctr" numeric, "daily_series" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sort   text := lower(coalesce(p_sort,'impressions'));
  v_dir    text := CASE WHEN lower(p_dir)='asc' THEN 'asc' ELSE 'desc' END;
  v_limit  int  := greatest(1, least(coalesce(p_limit,100), 1000));
  v_offset int  := greatest(0, coalesce(p_offset,0));
BEGIN
  -- Membership check
  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to organization %', p_org_id USING ERRCODE = '42501';
  END IF;

  -- Whitelist sort
  IF v_sort NOT IN ('impressions','clicks','ctr','credits_spent','revenue_cents') THEN
    v_sort := 'impressions';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      cad.org_id,
      cad.campaign_id,
      cad.creative_id,
      SUM(cad.impressions)::bigint    AS impressions,
      SUM(cad.clicks)::bigint         AS clicks,
      SUM(cad.conversions)::bigint    AS conversions,
      COALESCE(SUM(cad.revenue_cents),0)::bigint   AS revenue_cents,
      COALESCE(SUM(cad.credits_spent),0)::bigint   AS credits_spent
    FROM creative_analytics_daily cad
    WHERE cad.org_id = p_org_id
      AND cad.date BETWEEN p_from AND p_to
      AND (p_campaign_ids IS NULL OR array_length(p_campaign_ids,1) IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
      AND (p_creative_ids IS NULL  OR array_length(p_creative_ids,1)  IS NULL OR cad.creative_id  = ANY(p_creative_ids))
    GROUP BY cad.org_id, cad.campaign_id, cad.creative_id
  ),
  meta AS (
    SELECT
      ac.id AS creative_id,
      ac.campaign_id,
      ac.headline,
      ac.media_type::text AS media_type,
      ac.active,
      ac.poster_url,
      ac.media_url,
      c.org_id,
      c.name AS campaign_name
    FROM ad_creatives ac
    JOIN campaigns c ON c.id = ac.campaign_id
    WHERE c.org_id = p_org_id
  ),
  joined AS (
    SELECT
      m.org_id,
      m.campaign_id,
      m.campaign_name,
      m.creative_id,
      m.headline,
      m.media_type,
      m.active,
      m.poster_url,
      m.media_url,
      b.impressions,
      b.clicks,
      b.conversions,
      b.revenue_cents,
      b.credits_spent,
      CASE WHEN b.impressions > 0 THEN (b.clicks::numeric / b.impressions::numeric) ELSE 0 END AS ctr
    FROM base b
    JOIN meta m
      ON m.creative_id = b.creative_id
     AND m.campaign_id = b.campaign_id
     AND m.org_id      = b.org_id
  ),
  ranked AS (
    SELECT j.*,
      CASE v_sort
        WHEN 'clicks'        THEN j.clicks::numeric
        WHEN 'ctr'           THEN j.ctr
        WHEN 'credits_spent' THEN j.credits_spent::numeric
        WHEN 'revenue_cents' THEN j.revenue_cents::numeric
        ELSE j.impressions::numeric
      END AS sort_key
    FROM joined j
  ),
  limited AS (
    SELECT * FROM ranked
    ORDER BY
      CASE WHEN v_dir='asc' THEN NULL ELSE sort_key END DESC,
      CASE WHEN v_dir='asc' THEN sort_key END ASC,
      campaign_id, creative_id
    LIMIT v_limit OFFSET v_offset
  ),
  series_data AS (
    SELECT
      l.creative_id,
      jsonb_agg(
        jsonb_build_object(
          'date', cad.date,
          'impressions', cad.impressions,
          'clicks', cad.clicks,
          'conversions', cad.conversions,
          'revenue_cents', cad.revenue_cents,
          'credits_spent', cad.credits_spent
        ) ORDER BY cad.date ASC
      ) AS series
    FROM limited l
    JOIN creative_analytics_daily cad
      ON cad.creative_id = l.creative_id
     AND cad.org_id      = p_org_id
     AND cad.date BETWEEN p_from AND p_to
     AND (p_campaign_ids IS NULL OR array_length(p_campaign_ids,1) IS NULL OR cad.campaign_id = ANY(p_campaign_ids))
    GROUP BY l.creative_id
  )
  SELECT
    l.org_id,
    l.campaign_id,
    l.campaign_name,
    l.creative_id,
    l.headline,
    l.media_type,
    l.active,
    l.poster_url,
    l.media_url,
    l.impressions,
    l.clicks,
    l.conversions,
    l.revenue_cents,
    l.credits_spent,
    l.ctr,
    CASE WHEN p_include_series THEN sd.series ELSE NULL END AS daily_series
  FROM limited l
  LEFT JOIN series_data sd USING (creative_id)
  ORDER BY
    CASE WHEN v_dir='asc' THEN NULL ELSE l.sort_key END DESC,
    CASE WHEN v_dir='asc' THEN l.sort_key END ASC,
    l.campaign_id, l.creative_id;
END;
$$;


ALTER FUNCTION "public"."rpc_creative_analytics_rollup"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[], "p_include_series" boolean, "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_all"("p_user" "uuid" DEFAULT NULL::"uuid", "p_q" "text" DEFAULT NULL::"text", "p_category" "text" DEFAULT NULL::"text", "p_date_from" "date" DEFAULT NULL::"date", "p_date_to" "date" DEFAULT NULL::"date", "p_only_events" boolean DEFAULT false, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_location" "text" DEFAULT NULL::"text") RETURNS TABLE("item_type" "text", "item_id" "uuid", "parent_event_id" "uuid", "title" "text", "description" "text", "content" "text", "category" "text", "created_at" timestamp with time zone, "cover_image_url" "text", "organizer_name" "text", "location" "text", "start_at" timestamp with time zone, "visibility" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
WITH
q AS (
  SELECT NULLIF(TRIM(p_q), '') AS qtext
),

events_base AS (
  SELECT
    'event'::text AS item_type,
    e.id AS item_id,
    NULL::uuid AS parent_event_id,
    e.title,
    e.description,
    e.description AS content,
    e.category,
    e.created_at,
    e.cover_image_url,
    COALESCE(org.name, up.display_name) AS organizer_name,
    NULLIF(TRIM(CONCAT_WS(', ', e.venue, e.city, e.country)), '') AS location,
    e.start_at,
    e.visibility::text AS visibility,
    -- Full-text vector for ranking
    to_tsvector('simple',
      COALESCE(e.title,'') || ' ' ||
      COALESCE(e.description,'') || ' ' ||
      COALESCE(e.category,'') || ' ' ||
      COALESCE(org.name,'') || ' ' ||
      COALESCE(up.display_name,'') || ' ' ||
      COALESCE(e.venue,'') || ' ' ||
      COALESCE(e.city,'') || ' ' ||
      COALESCE(e.country,'')
    ) AS tsv
  FROM events e
  LEFT JOIN organizations org
    ON e.owner_context_type = 'organization'
   AND e.owner_context_id = org.id
  LEFT JOIN user_profiles up
    ON up.user_id = e.created_by
  WHERE
    -- Only include future events (exclude past events)
    e.start_at >= now()
    AND (
      -- Visibility: discover public; include private if user can view; exclude unlisted from search
      e.visibility = 'public'
      OR (
        p_user IS NOT NULL
        AND e.visibility = 'private'
        AND can_view_event(p_user, e.id)
      )
    )
    -- Filters
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_date_from IS NULL OR e.start_at >= (p_date_from::date)::timestamptz)
    AND (p_date_to   IS NULL OR e.start_at <  ((p_date_to::date + 1))::timestamptz)  -- inclusive date_to
    -- Location filter: match against venue, city, or country
    AND (
      p_location IS NULL 
      OR p_location = ''
      OR (
        COALESCE(e.venue, '') ILIKE '%' || p_location || '%'
        OR COALESCE(e.city, '') ILIKE '%' || p_location || '%'
        OR COALESCE(e.country, '') ILIKE '%' || p_location || '%'
        OR COALESCE(CONCAT_WS(', ', e.venue, e.city, e.country), '') ILIKE '%' || p_location || '%'
      )
    )
),

posts_base AS (
  SELECT
    'post'::text AS item_type,
    p.id AS item_id,
    p.event_id AS parent_event_id,
    -- Title is synthesized from post and event
    COALESCE(NULLIF(TRIM(SUBSTRING(p.text FROM 1 FOR 80)), ''), e.title, 'Post') AS title,
    -- Short description from post text
    SUBSTRING(p.text FROM 1 FOR 280) AS description,
    p.text AS content,
    e.category,
    p.created_at,
    e.cover_image_url,
    COALESCE(pa.display_name, org.name, eu.display_name) AS organizer_name,
    NULLIF(TRIM(CONCAT_WS(', ', e.venue, e.city, e.country)), '') AS location,
    e.start_at,
    e.visibility::text AS visibility,
    to_tsvector('simple',
      COALESCE(p.text,'') || ' ' ||
      COALESCE(e.title,'') || ' ' ||
      COALESCE(e.category,'') || ' ' ||
      COALESCE(org.name,'') || ' ' ||
      COALESCE(eu.display_name,'') || ' ' ||
      COALESCE(pa.display_name,'') || ' ' ||
      COALESCE(e.venue,'') || ' ' ||
      COALESCE(e.city,'') || ' ' ||
      COALESCE(e.country,'')
    ) AS tsv
  FROM event_posts p
  JOIN events e
    ON e.id = p.event_id
  LEFT JOIN organizations org
    ON e.owner_context_type = 'organization'
   AND e.owner_context_id = org.id
  LEFT JOIN user_profiles eu                -- event creator profile
    ON eu.user_id = e.created_by
  LEFT JOIN user_profiles pa                -- post author profile
    ON pa.user_id = p.author_user_id
  WHERE
    -- Respect event visibility rules for discovery
    (
      e.visibility = 'public'
      OR (
        p_user IS NOT NULL
        AND e.visibility = 'private'
        AND can_view_event(p_user, e.id)
      )
    )
    -- Same filters as events (category/date are taken from the event)
    AND (p_category IS NULL OR e.category = p_category)
    AND (p_date_from IS NULL OR e.start_at >= (p_date_from::date)::timestamptz)
    AND (p_date_to   IS NULL OR e.start_at <  ((p_date_to::date + 1))::timestamptz)
    AND p.deleted_at IS NULL  -- Exclude deleted posts
    -- Location filter for posts (inherited from event)
    AND (
      p_location IS NULL 
      OR p_location = ''
      OR (
        COALESCE(e.venue, '') ILIKE '%' || p_location || '%'
        OR COALESCE(e.city, '') ILIKE '%' || p_location || '%'
        OR COALESCE(e.country, '') ILIKE '%' || p_location || '%'
        OR COALESCE(CONCAT_WS(', ', e.venue, e.city, e.country), '') ILIKE '%' || p_location || '%'
      )
    )
),

unioned AS (
  SELECT * FROM events_base
  UNION ALL
  SELECT * FROM posts_base
  WHERE NOT p_only_events
),

ranked AS (
  SELECT
    u.*,
    CASE
      WHEN (SELECT qtext FROM q) IS NULL OR (SELECT qtext FROM q) = '' THEN NULL::float
      ELSE ts_rank(u.tsv, plainto_tsquery('simple', (SELECT qtext FROM q)))
    END AS rank
  FROM unioned u
  WHERE
    -- Text filter: if query is provided, match via full-text OR ILIKE fallback
    (
      (SELECT qtext FROM q) IS NULL OR (SELECT qtext FROM q) = ''
    )
    OR (
      u.tsv @@ plainto_tsquery('simple', (SELECT qtext FROM q))
      OR u.title ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR u.description ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR u.content ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR COALESCE(u.organizer_name,'') ILIKE '%' || (SELECT qtext FROM q) || '%'
      OR COALESCE(u.location,'') ILIKE '%' || (SELECT qtext FROM q) || '%'
    )
)

SELECT
  item_type,
  item_id,
  parent_event_id,
  title,
  description,
  content,
  category,
  created_at,
  cover_image_url,
  organizer_name,
  location,
  start_at,
  visibility
FROM ranked
ORDER BY
  -- If a query was provided, sort by rank first (desc), then recency
  CASE WHEN (SELECT qtext FROM q) IS NULL OR (SELECT qtext FROM q) = '' THEN 1 ELSE 0 END,
  rank DESC NULLS LAST,
  created_at DESC
LIMIT p_limit
OFFSET p_offset;
$$;


ALTER FUNCTION "public"."search_all"("p_user" "uuid", "p_q" "text", "p_category" "text", "p_date_from" "date", "p_date_to" "date", "p_only_events" boolean, "p_limit" integer, "p_offset" integer, "p_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."semantic_event_search"("p_query_text" "text", "p_category" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date", "p_quality_tier" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 20) RETURNS TABLE("event_id" "uuid", "event_title" "text", "category" "text", "start_at" timestamp with time zone, "city" "text", "quality_score" numeric, "match_score" numeric, "relevance_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- In a real implementation, you would generate embeddings from p_query_text
  -- For now, we'll use a placeholder
  query_embedding := NULL;
  
  RETURN QUERY
  SELECT
    e.id AS event_id,
    e.title AS event_title,
    e.category,
    e.start_at,
    e.city,
    COALESCE(eqs.final_quality_score, 0.5) AS quality_score,
    -- Placeholder for semantic similarity
    CASE 
      WHEN p_query_text ILIKE '%' || e.category || '%' THEN 0.8
      WHEN p_query_text ILIKE '%' || e.title || '%' THEN 0.9
      WHEN p_query_text ILIKE '%' || e.description || '%' THEN 0.7
      ELSE 0.5
    END AS match_score,
    -- Relevance score combining multiple factors
    (
      CASE 
        WHEN p_query_text ILIKE '%' || e.category || '%' THEN 0.8
        WHEN p_query_text ILIKE '%' || e.title || '%' THEN 0.9
        WHEN p_query_text ILIKE '%' || e.description || '%' THEN 0.7
        ELSE 0.5
      END * 0.4 +
      COALESCE(eqs.final_quality_score, 0.5) * 0.3 +
      CASE 
        WHEN p_city IS NULL OR e.city ILIKE '%' || p_city || '%' THEN 1.0
        ELSE 0.5
      END * 0.3
    ) AS relevance_score
  FROM public.events e
  LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
  WHERE (p_category IS NULL OR e.category = p_category)
  AND (p_city IS NULL OR e.city ILIKE '%' || p_city || '%')
  AND (p_start_date IS NULL OR e.start_at::date >= p_start_date)
  AND (p_end_date IS NULL OR e.start_at::date <= p_end_date)
  AND (p_quality_tier IS NULL OR eqs.quality_tier = p_quality_tier)
  ORDER BY relevance_score DESC, match_score DESC, eqs.final_quality_score DESC
  LIMIT p_limit;
END $$;


ALTER FUNCTION "public"."semantic_event_search"("p_query_text" "text", "p_category" "text", "p_city" "text", "p_start_date" "date", "p_end_date" "date", "p_quality_tier" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."semantic_event_search"("p_query_text" "text", "p_category" "text", "p_city" "text", "p_start_date" "date", "p_end_date" "date", "p_quality_tier" "text", "p_limit" integer) IS 'Semantic search for events with filtering capabilities';



CREATE OR REPLACE FUNCTION "public"."semantic_sponsor_event_match"("p_sponsor_id" "uuid", "p_event_id" "uuid") RETURNS TABLE("match_score" numeric, "semantic_similarity" numeric, "objectives_alignment" numeric, "description_alignment" numeric)
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
  sponsor_embedding vector(1536);
  event_embedding vector(1536);
  semantic_sim numeric;
  objectives_sim numeric;
  description_sim numeric;
  final_score numeric;
BEGIN
  -- Get sponsor objectives embedding
  SELECT objectives_embedding INTO sponsor_embedding
  FROM public.sponsor_profiles
  WHERE sponsor_id = p_sponsor_id;
  
  -- Get event description embedding
  SELECT description_embedding INTO event_embedding
  FROM public.events
  WHERE id = p_event_id;
  
  -- Return early if embeddings don't exist
  IF sponsor_embedding IS NULL OR event_embedding IS NULL THEN
    RETURN QUERY SELECT 0.0, 0.0, 0.0, 0.0;
    RETURN;
  END IF;
  
  -- Calculate semantic similarity
  semantic_sim := 1 - (sponsor_embedding <=> event_embedding);
  
  -- Calculate objectives alignment (sponsor objectives vs event description)
  objectives_sim := semantic_sim;
  
  -- Calculate description alignment (event description vs sponsor objectives)
  description_sim := semantic_sim;
  
  -- Calculate final weighted score
  final_score := (
    semantic_sim * 0.4 +
    objectives_sim * 0.3 +
    description_sim * 0.3
  );
  
  RETURN QUERY SELECT 
    final_score,
    semantic_sim,
    objectives_sim,
    description_sim;
END $$;


ALTER FUNCTION "public"."semantic_sponsor_event_match"("p_sponsor_id" "uuid", "p_event_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."semantic_sponsor_event_match"("p_sponsor_id" "uuid", "p_event_id" "uuid") IS 'Calculates semantic similarity between sponsor and event';



CREATE OR REPLACE FUNCTION "public"."semantic_sponsor_search"("p_query_text" "text", "p_industry" "text" DEFAULT NULL::"text", "p_budget_min" integer DEFAULT NULL::integer, "p_budget_max" integer DEFAULT NULL::integer, "p_regions" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 20) RETURNS TABLE("sponsor_id" "uuid", "sponsor_name" "text", "industry" "text", "annual_budget_cents" integer, "match_score" numeric, "relevance_score" numeric)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  query_embedding vector(1536);
BEGIN
  -- In a real implementation, you would generate embeddings from p_query_text
  -- For now, we'll use a placeholder
  query_embedding := NULL;
  
  RETURN QUERY
  SELECT
    s.id AS sponsor_id,
    s.name AS sponsor_name,
    sp.industry,
    sp.annual_budget_cents,
    -- Placeholder for semantic similarity
    CASE 
      WHEN p_query_text ILIKE '%' || sp.industry || '%' THEN 0.8
      WHEN p_query_text ILIKE '%' || s.name || '%' THEN 0.9
      ELSE 0.5
    END AS match_score,
    -- Relevance score combining multiple factors
    (
      CASE 
        WHEN p_query_text ILIKE '%' || sp.industry || '%' THEN 0.8
        WHEN p_query_text ILIKE '%' || s.name || '%' THEN 0.9
        ELSE 0.5
      END * 0.4 +
      CASE 
        WHEN sp.annual_budget_cents >= COALESCE(p_budget_min, 0) 
         AND sp.annual_budget_cents <= COALESCE(p_budget_max, 999999999) THEN 1.0
        ELSE 0.3
      END * 0.3 +
      CASE 
        WHEN p_regions IS NULL OR sp.regions && p_regions THEN 1.0
        ELSE 0.5
      END * 0.3
    ) AS relevance_score
  FROM public.sponsors s
  JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
  WHERE (p_industry IS NULL OR sp.industry = p_industry)
  AND (p_budget_min IS NULL OR sp.annual_budget_cents >= p_budget_min)
  AND (p_budget_max IS NULL OR sp.annual_budget_cents <= p_budget_max)
  AND (p_regions IS NULL OR sp.regions && p_regions)
  ORDER BY relevance_score DESC, match_score DESC
  LIMIT p_limit;
END $$;


ALTER FUNCTION "public"."semantic_sponsor_search"("p_query_text" "text", "p_industry" "text", "p_budget_min" integer, "p_budget_max" integer, "p_regions" "text"[], "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."semantic_sponsor_search"("p_query_text" "text", "p_industry" "text", "p_budget_min" integer, "p_budget_max" integer, "p_regions" "text"[], "p_limit" integer) IS 'Semantic search for sponsors with filtering capabilities';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."similar_events"("p_event_id" "uuid", "p_limit" integer DEFAULT 5) RETURNS TABLE("event_id" "uuid", "similarity_score" numeric)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id as event_id,
        1.0 as similarity_score
    FROM public.events e
    JOIN public.events base_event ON base_event.id = p_event_id
    WHERE e.id != p_event_id
        AND e.start_at > now()
        AND e.visibility = 'public'
        AND (e.category = base_event.category OR e.city = base_event.city)
    ORDER BY 
        CASE WHEN e.category = base_event.category THEN 2 ELSE 0 END +
        CASE WHEN e.city = base_event.city THEN 1 ELSE 0 END DESC
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "public"."similar_events"("p_event_id" "uuid", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_post_like_count"("p_post" "uuid") RETURNS "void"
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  UPDATE public.event_posts
  SET like_count = (
    SELECT COUNT(*)
    FROM public.event_reactions
    WHERE post_id = p_post AND kind = 'like'
  )
  WHERE id = p_post;
$$;


ALTER FUNCTION "public"."sync_post_like_count"("p_post" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."test_like_trigger"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- This is just a test function to ensure triggers work
  RAISE NOTICE 'Like trigger test function created';
END;
$$;


ALTER FUNCTION "public"."test_like_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_assign_serial_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.serial_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.order_id::text || ':' || NEW.tier_id::text));
    SELECT COALESCE(MAX(serial_no), 0) + 1 INTO NEW.serial_no
    FROM public.tickets
    WHERE order_id = NEW.order_id AND tier_id = NEW.tier_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."tg_assign_serial_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_ticket_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.orders
       SET tickets_issued_count = tickets_issued_count + 1
     WHERE id = NEW.order_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.orders
       SET tickets_issued_count = GREATEST(tickets_issued_count - 1, 0)
     WHERE id = OLD.order_id;
    RETURN OLD;
  END IF;
END;
$$;


ALTER FUNCTION "public"."tg_ticket_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."tg_touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_search_docs_mv"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM public.refresh_search_docs();
  RETURN null;
END;
$$;


ALTER FUNCTION "public"."touch_search_docs_mv"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_assign_serial_no"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_last int;
BEGIN
  IF NEW.serial_no IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Per (order_id,tier_id) advisory lock to serialize numbering
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(replace(NEW.order_id::text,'-',''),1,8))::bit(32)::int,
    ('x' || substr(replace(NEW.tier_id::text,'-',''),1,8))::bit(32)::int
  );

  SELECT serial_no
    INTO v_last
    FROM public.tickets
   WHERE order_id = NEW.order_id
     AND tier_id  = NEW.tier_id
   ORDER BY serial_no DESC
   LIMIT 1
   FOR UPDATE;

  NEW.serial_no := COALESCE(v_last, 0) + 1;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_assign_serial_no"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_block_tier_delete_if_tickets"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if exists (select 1 from public.tickets t where t.tier_id = old.id) then
    raise exception 'Cannot delete tier with existing tickets';
  end if;
  return old;
end; $$;


ALTER FUNCTION "public"."trg_block_tier_delete_if_tickets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_block_tier_price_change_after_sale"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.price_cents <> old.price_cents then
    if exists (select 1 from public.tickets t where t.tier_id = old.id) then
      raise exception 'Price cannot change after sales; create a new tier';
    end if;
  end if;
  return new;
end; $$;


ALTER FUNCTION "public"."trg_block_tier_price_change_after_sale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_event_comments_bump_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END$$;


ALTER FUNCTION "public"."trg_event_comments_bump_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_event_reactions_bump_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.kind = 'like' THEN
    UPDATE public.event_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.kind = 'like' THEN
    UPDATE public.event_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END$$;


ALTER FUNCTION "public"."trg_event_reactions_bump_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_release_tier_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.ticket_tiers
     SET sold_quantity = GREATEST(sold_quantity - 1, 0)
   WHERE id = OLD.tier_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_release_tier_capacity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_reserve_tier_capacity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If no cap, skip
  IF (SELECT total_quantity IS NULL FROM public.ticket_tiers WHERE id = NEW.tier_id) THEN
    RETURN NEW;
  END IF;

  -- Reserve 1 atomically; fails if at capacity
  UPDATE public.ticket_tiers
     SET sold_quantity = sold_quantity + 1
   WHERE id = NEW.tier_id
     AND (total_quantity IS NULL OR sold_quantity + 1 <= total_quantity)
  RETURNING id
  INTO NEW.tier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tier % at capacity', NEW.tier_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_reserve_tier_capacity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."trigger_set_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_set_updated_at"() IS 'Automatically updates updated_at timestamp on row modification';



CREATE OR REPLACE FUNCTION "public"."update_circuit_breaker_state"("p_service_id" "text", "p_success" boolean, "p_error_message" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_state circuit_breaker_state%ROWTYPE;
  v_now   timestamptz := now();
  v_jitter int := (random()*5)::int; -- small jitter
BEGIN
  SELECT * INTO v_state
  FROM public.circuit_breaker_state
  WHERE id = p_service_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Circuit breaker not found: %', p_service_id;
  END IF;

  IF p_success THEN
    UPDATE public.circuit_breaker_state
    SET state = 'closed',
        failure_count = 0,
        last_failure_at = NULL,
        next_attempt_at = NULL,
        updated_at = v_now
    WHERE id = p_service_id;

    RETURN jsonb_build_object('state','closed','can_proceed',true);
  END IF;

  -- failure path
  v_state.failure_count := v_state.failure_count + 1;

  IF v_state.failure_count >= v_state.failure_threshold THEN
    UPDATE public.circuit_breaker_state
    SET state = 'open',
        failure_count = v_state.failure_count,
        last_failure_at = v_now,
        next_attempt_at = v_now + make_interval(secs => v_state.timeout_seconds + v_jitter),
        updated_at = v_now
    WHERE id = p_service_id;

    RETURN jsonb_build_object(
      'state','open','can_proceed',false,'next_attempt_at', (v_now + make_interval(secs => v_state.timeout_seconds + v_jitter))
    );
  ELSE
    UPDATE public.circuit_breaker_state
    SET failure_count = v_state.failure_count,
        last_failure_at = v_now,
        updated_at = v_now
    WHERE id = p_service_id;

    RETURN jsonb_build_object('state',v_state.state,'can_proceed', v_state.state <> 'open');
  END IF;
END; $$;


ALTER FUNCTION "public"."update_circuit_breaker_state"("p_service_id" "text", "p_success" boolean, "p_error_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_description_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only update if we have a meaningful description
  IF LENGTH(TRIM(COALESCE(NEW.description, ''))) > 10 THEN
    -- In a real implementation, you would call an embedding service here
    -- For now, we'll use a placeholder
    NEW.description_embedding := NULL; -- Placeholder for actual embedding
  END IF;
  
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."update_event_description_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_comment_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts 
    SET comment_count = (
      SELECT COUNT(*) 
      FROM event_comments 
      WHERE post_id = NEW.post_id
    )
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE event_posts 
    SET comment_count = (
      SELECT COUNT(*) 
      FROM event_comments 
      WHERE post_id = OLD.post_id
    )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_post_comment_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.kind = 'like' THEN
    UPDATE public.event_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.kind = 'like' THEN
    UPDATE public.event_posts 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_post_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sponsor_objectives_embedding"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  objectives_text text;
BEGIN
  -- Combine brand objectives and target audience into text
  objectives_text := COALESCE(
    (NEW.brand_objectives->>'description')::text, ''
  ) || ' ' || COALESCE(
    (NEW.target_audience->>'description')::text, ''
  );
  
  -- Only update if we have meaningful text
  IF LENGTH(TRIM(objectives_text)) > 10 THEN
    -- In a real implementation, you would call an embedding service here
    -- For now, we'll use a placeholder
    NEW.objectives_embedding := NULL; -- Placeholder for actual embedding
  END IF;
  
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."update_sponsor_objectives_embedding"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_sponsorship_matches"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  queue_item record;
  updated_count integer := 0;
  score_result record;
BEGIN
  -- Process pending queue items
  FOR queue_item IN 
    SELECT * FROM public.fit_recalc_queue
    WHERE processed_at IS NULL
    ORDER BY priority DESC, created_at ASC
    LIMIT 100
  LOOP
    BEGIN
      -- Update queue item status
      UPDATE public.fit_recalc_queue
      SET processed_at = now()
      WHERE id = queue_item.id;
      
      -- Calculate new scores
      IF queue_item.event_id IS NOT NULL AND queue_item.sponsor_id IS NOT NULL THEN
        -- Specific event-sponsor pair
        SELECT * INTO score_result
        FROM public.fn_compute_match_score(queue_item.event_id, queue_item.sponsor_id);
        
        -- Update or insert match
        INSERT INTO public.sponsorship_matches (
          event_id, sponsor_id, score, overlap_metrics, updated_at
        ) VALUES (
          queue_item.event_id, 
          queue_item.sponsor_id, 
          score_result.score, 
          score_result.breakdown, 
          now()
        )
        ON CONFLICT (event_id, sponsor_id)
        DO UPDATE SET
          score = EXCLUDED.score,
          overlap_metrics = EXCLUDED.breakdown,
          updated_at = EXCLUDED.updated_at;
          
      ELSIF queue_item.event_id IS NOT NULL THEN
        -- All sponsors for specific event
        FOR score_result IN
          SELECT s.id as sponsor_id, fn.*
          FROM public.sponsors s
          JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
          CROSS JOIN LATERAL public.fn_compute_match_score(queue_item.event_id, s.id) fn
        LOOP
          INSERT INTO public.sponsorship_matches (
            event_id, sponsor_id, score, overlap_metrics, updated_at
          ) VALUES (
            queue_item.event_id, 
            score_result.sponsor_id, 
            score_result.score, 
            score_result.breakdown, 
            now()
          )
          ON CONFLICT (event_id, sponsor_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            overlap_metrics = EXCLUDED.breakdown,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
        
      ELSIF queue_item.sponsor_id IS NOT NULL THEN
        -- All events for specific sponsor
        FOR score_result IN
          SELECT e.id as event_id, fn.*
          FROM public.events e
          CROSS JOIN LATERAL public.fn_compute_match_score(e.id, queue_item.sponsor_id) fn
        LOOP
          INSERT INTO public.sponsorship_matches (
            event_id, sponsor_id, score, overlap_metrics, updated_at
          ) VALUES (
            score_result.event_id, 
            queue_item.sponsor_id, 
            score_result.score, 
            score_result.breakdown, 
            now()
          )
          ON CONFLICT (event_id, sponsor_id)
          DO UPDATE SET
            score = EXCLUDED.score,
            overlap_metrics = EXCLUDED.breakdown,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      updated_count := updated_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Mark as failed
        UPDATE public.fit_recalc_queue
        SET status = 'failed'
        WHERE id = queue_item.id;
    END;
  END LOOP;
  
  RETURN updated_count;
END $$;


ALTER FUNCTION "public"."update_sponsorship_matches"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_sponsorship_matches"() IS 'Processes the recalculation queue and updates match scores';



CREATE OR REPLACE FUNCTION "public"."update_sponsorship_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_sponsorship_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_orgs"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT org_id 
  FROM public.org_memberships 
  WHERE user_id = auth.uid()
$$;


ALTER FUNCTION "public"."user_orgs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_related_event_ids"("p_user_id" "uuid") RETURNS TABLE("event_id" "uuid")
    LANGUAGE "sql" STABLE
    AS $$
  SELECT e.id
  FROM public.events e
  WHERE e.created_by = p_user_id
  UNION
  SELECT t.event_id
  FROM public.tickets t
  WHERE t.owner_user_id = p_user_id
    AND t.status = 'issued';
$$;


ALTER FUNCTION "public"."user_related_event_ids"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_sponsorship_data"() RETURNS TABLE("check_name" "text", "status" "text", "details" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Check for duplicate matches
  RETURN QUERY
  SELECT 
    'duplicate_matches'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' duplicate event-sponsor pairs'
  FROM (
    SELECT event_id, sponsor_id, COUNT(*) as cnt
    FROM public.sponsorship_matches
    GROUP BY event_id, sponsor_id
    HAVING COUNT(*) > 1
  ) dups;

  -- Check for invalid currencies
  RETURN QUERY
  SELECT 
    'invalid_currencies'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' packages with invalid currency'
  FROM public.sponsorship_packages
  WHERE currency NOT IN ('USD', 'EUR', 'GBP', 'CAD');

  -- Check for oversold packages
  RETURN QUERY
  SELECT 
    'oversold_packages'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' packages with sold > inventory'
  FROM public.sponsorship_packages
  WHERE sold > inventory;

  -- Check for invalid scores
  RETURN QUERY
  SELECT 
    'invalid_scores'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' matches with scores outside 0-1 range'
  FROM public.sponsorship_matches
  WHERE score < 0 OR score > 1;

  -- Check for orphaned matches (no event)
  RETURN QUERY
  SELECT 
    'orphaned_matches'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' matches with missing events'
  FROM public.sponsorship_matches m
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = m.event_id);

  -- Check for orphaned packages (no event)
  RETURN QUERY
  SELECT 
    'orphaned_packages'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    'Found ' || COUNT(*)::text || ' packages with missing events'
  FROM public.sponsorship_packages p
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = p.event_id);
END $$;


ALTER FUNCTION "public"."validate_sponsorship_data"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_sponsorship_data"() IS 'Validates data integrity across sponsorship system';



CREATE OR REPLACE FUNCTION "public"."wallet_apply_purchase"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_credits" integer, "p_usd_cents" integer, "p_receipt_url" "text", "p_idempotency_key" "text") RETURNS TABLE("new_balance" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_exists int;
BEGIN
  -- De-dupe on idempotency key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT 1 INTO v_exists FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT (SELECT balance_credits FROM wallets WHERE id = p_wallet_id);
      RETURN;
    END IF;
  END IF;

  -- Lock wallet row
  PERFORM 1 FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Mark invoice paid if not already
  UPDATE invoices
    SET status = 'paid', receipt_url = COALESCE(p_receipt_url, receipt_url), updated_at = now()
  WHERE id = p_invoice_id AND status <> 'paid';

  -- Ledger entry
  INSERT INTO wallet_transactions (
    wallet_id, type, credits_delta, usd_cents, reference_type, reference_id, memo, idempotency_key
  ) VALUES (
    p_wallet_id, 'purchase', p_credits, p_usd_cents, 'invoice', p_invoice_id, 'Credit purchase via Stripe', p_idempotency_key
  );

  -- Update balance
  UPDATE wallets
     SET balance_credits = balance_credits + p_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN QUERY SELECT balance_credits FROM wallets WHERE id = p_wallet_id;
END;
$$;


ALTER FUNCTION "public"."wallet_apply_purchase"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_credits" integer, "p_usd_cents" integer, "p_receipt_url" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_apply_refund"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_refund_usd_cents" integer, "p_idempotency_key" "text") RETURNS TABLE("new_balance" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_exists int;
  v_credits int;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT 1 INTO v_exists FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT (SELECT balance_credits FROM wallets WHERE id = p_wallet_id);
      RETURN;
    END IF;
  END IF;

  -- Convert refunded USD cents to credits (1 credit = $0.01)
  v_credits = p_refund_usd_cents;

  -- Lock wallet, write refund txn, update balance
  PERFORM 1 FROM wallets WHERE id = p_wallet_id FOR UPDATE;

  INSERT INTO wallet_transactions (
    wallet_id, type, credits_delta, usd_cents, reference_type, reference_id, memo, idempotency_key
  ) VALUES (
    p_wallet_id, 'refund', -v_credits, -p_refund_usd_cents, 'invoice', p_invoice_id, 'Stripe refund', p_idempotency_key
  );

  UPDATE wallets
     SET balance_credits = balance_credits - v_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN QUERY SELECT balance_credits FROM wallets WHERE id = p_wallet_id;
END;
$_$;


ALTER FUNCTION "public"."wallet_apply_refund"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_refund_usd_cents" integer, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wallet_freeze_if_negative"("p_wallet_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_bal int;
BEGIN
  SELECT balance_credits INTO v_bal FROM wallets WHERE id = p_wallet_id;
  IF v_bal < 0 THEN
    UPDATE wallets SET status = 'frozen', updated_at = now() WHERE id = p_wallet_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."wallet_freeze_if_negative"("p_wallet_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "event_id" "uuid",
    "ticket_id" "uuid",
    "source" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "path" "text",
    "url" "text",
    "referrer" "text",
    "utm_source" "text",
    "utm_medium" "text",
    "utm_campaign" "text",
    "utm_term" "text",
    "utm_content" "text",
    "session_id" "text"
);


ALTER TABLE "analytics"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."audience_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "segment_key" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "consent_basis" "text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "audience_consents_scope_check" CHECK (("scope" = ANY (ARRAY['aggregated'::"text", 'cohort'::"text", 'pseudonymous'::"text"])))
);


ALTER TABLE "analytics"."audience_consents" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."audience_consents" IS 'GDPR/privacy-compliant audience data sharing consent tracking';



CREATE TABLE IF NOT EXISTS "analytics"."event_audience_insights" (
    "event_id" "uuid" NOT NULL,
    "attendee_count" integer,
    "avg_dwell_time_ms" integer,
    "geo_distribution" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "age_segments" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "engagement_score" numeric,
    "ticket_conversion_rate" numeric,
    "social_mentions" integer,
    "sentiment_score" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "household_income_segments" "jsonb",
    "interests_top" "text"[],
    "brand_affinities" "jsonb",
    "source" "text",
    "as_of" timestamp with time zone,
    "confidence" numeric,
    CONSTRAINT "event_audience_insights_avg_dwell_time_ms_check" CHECK ((("avg_dwell_time_ms" IS NULL) OR ("avg_dwell_time_ms" >= 0))),
    CONSTRAINT "event_audience_insights_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric)))
);


ALTER TABLE "analytics"."event_audience_insights" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."event_audience_insights" IS 'Aggregated event performance and audience metrics';



COMMENT ON COLUMN "analytics"."event_audience_insights"."source" IS 'Source of the insight data (e.g., "analytics", "survey", "ml_model")';



COMMENT ON COLUMN "analytics"."event_audience_insights"."as_of" IS 'Timestamp when these insights were valid/captured';



COMMENT ON COLUMN "analytics"."event_audience_insights"."confidence" IS 'Confidence score for these insights (0-1)';



CREATE TABLE IF NOT EXISTS "analytics"."event_impressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_dwell_valid" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_session_len" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "analytics"."event_impressions_daily" AS
 SELECT "event_id",
    "date_trunc"('day'::"text", "created_at") AS "day",
    "count"(*) AS "impressions",
    "sum"("dwell_ms") AS "dwell_ms_sum",
    ("avg"("dwell_ms"))::numeric(10,2) AS "dwell_ms_avg"
   FROM "analytics"."event_impressions"
  GROUP BY "event_id", ("date_trunc"('day'::"text", "created_at"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "analytics"."event_impressions_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "analytics"."event_impressions_p" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."event_impressions_p" IS 'Partitioned event_impressions by month for improved query performance';



CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_default" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."event_impressions_default" IS 'Default partition for event_impressions outside defined monthly ranges';



CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202404" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202404" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202405" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202405" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202406" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202406" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202407" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202407" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202408" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202408" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202409" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202409" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202410" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202410" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202411" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202411" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202412" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202412" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202501" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202501" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202502" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202502" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202503" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202503" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202504" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202504" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202505" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202505" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202506" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202506" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202507" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202507" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202508" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202508" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202509" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202509" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202510" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202510" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_impressions_p_202511" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_impressions_p_dwell_ms_check" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "event_impressions_p_session_id_check" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."event_impressions_p_202511" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."event_stat_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "metric_key" "text" NOT NULL,
    "metric_value" numeric,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "analytics"."event_stat_snapshots" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."event_stat_snapshots" IS 'Cached event statistics for quick access';



CREATE TABLE IF NOT EXISTS "analytics"."event_video_counters" (
    "event_id" "uuid" NOT NULL,
    "views_total" bigint DEFAULT 0,
    "views_unique" bigint DEFAULT 0,
    "completions" bigint DEFAULT 0,
    "avg_dwell_ms" bigint DEFAULT 0,
    "clicks_tickets" bigint DEFAULT 0,
    "clicks_details" bigint DEFAULT 0,
    "clicks_organizer" bigint DEFAULT 0,
    "clicks_share" bigint DEFAULT 0,
    "clicks_comment" bigint DEFAULT 0,
    "likes" bigint DEFAULT 0,
    "comments" bigint DEFAULT 0,
    "shares" bigint DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."event_video_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."negative_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "negative_feedback_target_type_check" CHECK (("target_type" = ANY (ARRAY['event'::"text", 'post'::"text"])))
);


ALTER TABLE "analytics"."negative_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."post_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "target" "text" NOT NULL,
    "source" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_agent" "text",
    "ip_address" "inet"
);


ALTER TABLE "analytics"."post_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."post_impressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "dwell_ms" integer DEFAULT 0,
    "completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "post_impressions_dwell_valid" CHECK ((("dwell_ms" >= 0) AND ("dwell_ms" <= ((60 * 60) * 1000)))),
    CONSTRAINT "post_impressions_session_len" CHECK ((("session_id" IS NULL) OR (("length"("session_id") >= 16) AND ("length"("session_id") <= 64))))
);


ALTER TABLE "analytics"."post_impressions" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "analytics"."post_impressions_daily" AS
 SELECT "post_id",
    "date_trunc"('day'::"text", "created_at") AS "day",
    "count"(*) AS "impressions",
    "sum"(
        CASE
            WHEN "completed" THEN 1
            ELSE 0
        END) AS "completions",
    ("avg"("dwell_ms"))::numeric(10,2) AS "dwell_ms_avg"
   FROM "analytics"."post_impressions"
  GROUP BY "post_id", ("date_trunc"('day'::"text", "created_at"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "analytics"."post_impressions_daily" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."post_video_counters" (
    "post_id" "uuid" NOT NULL,
    "views_total" bigint DEFAULT 0,
    "views_unique" bigint DEFAULT 0,
    "completions" bigint DEFAULT 0,
    "avg_dwell_ms" bigint DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."post_video_counters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."post_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "source" "text",
    "qualified" boolean DEFAULT false,
    "completed" boolean DEFAULT false,
    "dwell_ms" integer DEFAULT 0,
    "watch_percentage" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_agent" "text",
    "ip_address" "inet"
);


ALTER TABLE "analytics"."post_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reported_by" "uuid",
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reports_target_type_check" CHECK (("target_type" = ANY (ARRAY['post'::"text", 'event'::"text", 'user'::"text"])))
);


ALTER TABLE "analytics"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."share_links" (
    "code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "content_type" "text" NOT NULL,
    "content_id" "uuid" NOT NULL,
    "channel" "text",
    "params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "clicks" integer DEFAULT 0 NOT NULL,
    "last_clicked_at" timestamp with time zone,
    CONSTRAINT "share_links_content_type_check" CHECK (("content_type" = ANY (ARRAY['event'::"text", 'post'::"text", 'org'::"text", 'user'::"text"])))
);


ALTER TABLE "analytics"."share_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ticket_analytics_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
)
PARTITION BY RANGE ("created_at");


ALTER TABLE "analytics"."ticket_analytics_p" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."ticket_analytics_p" IS 'Partitioned ticket_analytics by month for improved query performance';



CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_default" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_default" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."ticket_analytics_default" IS 'Default partition for ticket_analytics outside defined monthly ranges';



CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202404" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202404" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202405" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202405" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202406" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202406" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202407" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202407" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202408" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202408" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202409" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202409" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202410" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202410" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202411" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202411" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202412" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202412" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202501" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202501" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202502" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202502" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202503" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202503" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202504" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202504" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202505" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202505" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202506" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202506" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202507" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202507" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202508" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202508" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202509" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202509" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202510" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202510" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."ticket_analytics_p_202511" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ticket_analytics_p_event_type_check" CHECK (("event_type" = ANY (ARRAY['ticket_view'::"text", 'qr_code_view'::"text", 'ticket_share'::"text", 'ticket_copy'::"text", 'wallet_download'::"text"])))
);


ALTER TABLE "analytics"."ticket_analytics_p_202511" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "analytics"."user_event_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "interaction_type" "text" NOT NULL,
    "weight" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_event_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['event_view'::"text", 'video_watch'::"text", 'like'::"text", 'comment'::"text", 'share'::"text", 'ticket_open'::"text", 'ticket_purchase'::"text"])))
);


ALTER TABLE "analytics"."user_event_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."ad_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "impression_id" "uuid",
    "user_id" "uuid",
    "session_id" "text",
    "converted" boolean DEFAULT false,
    "conversion_value_cents" integer,
    "ticket_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creative_id" "uuid",
    CONSTRAINT "ad_clicks_impression_or_session_chk" CHECK ((("impression_id" IS NOT NULL) OR ("session_id" IS NOT NULL)))
);


ALTER TABLE "campaigns"."ad_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."ad_creatives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "headline" "text" NOT NULL,
    "body_text" "text",
    "cta_label" "text" DEFAULT 'Learn More'::"text" NOT NULL,
    "cta_url" "text",
    "media_type" "public"."creative_media_type" NOT NULL,
    "media_url" "text",
    "post_id" "uuid",
    "poster_url" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ad_creatives_cta_len_chk" CHECK ((("cta_label" IS NULL) OR (("length"("cta_label") >= 1) AND ("length"("cta_label") <= 24))))
);


ALTER TABLE "campaigns"."ad_creatives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."ad_impressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "session_id" "text",
    "placement" "public"."ad_placement" NOT NULL,
    "event_id" "uuid",
    "post_id" "uuid",
    "user_agent" "text",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "creative_id" "uuid",
    CONSTRAINT "ad_impressions_session_or_user_chk" CHECK ((("user_id" IS NOT NULL) OR ("session_id" IS NOT NULL)))
);


ALTER TABLE "campaigns"."ad_impressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."ad_spend_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "metric_type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "rate_model" "text" NOT NULL,
    "rate_usd_cents" integer NOT NULL,
    "credits_charged" integer NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "wallet_transaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_wallet_id" "uuid",
    "creative_id" "uuid",
    CONSTRAINT "ad_spend_ledger_credits_charged_check" CHECK (("credits_charged" >= 0)),
    CONSTRAINT "ad_spend_ledger_quantity_check" CHECK (("quantity" >= 0)),
    CONSTRAINT "ad_spend_ledger_rate_usd_cents_check" CHECK (("rate_usd_cents" >= 0)),
    CONSTRAINT "ad_spend_metric_chk" CHECK (("metric_type" = ANY (ARRAY['impression'::"text", 'click'::"text", 'other'::"text"]))),
    CONSTRAINT "ad_spend_one_wallet_chk" CHECK (((("wallet_id" IS NOT NULL) AND ("org_wallet_id" IS NULL)) OR (("wallet_id" IS NULL) AND ("org_wallet_id" IS NOT NULL)))),
    CONSTRAINT "ad_spend_rate_model_chk" CHECK (("rate_model" = ANY (ARRAY['cpm'::"text", 'cpc'::"text"])))
);


ALTER TABLE "campaigns"."ad_spend_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."campaign_placements" (
    "campaign_id" "uuid" NOT NULL,
    "placement" "public"."ad_placement" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL
);


ALTER TABLE "campaigns"."campaign_placements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."campaign_targeting" (
    "campaign_id" "uuid" NOT NULL,
    "locations" "jsonb" DEFAULT '[]'::"jsonb",
    "categories" "text"[] DEFAULT '{}'::"text"[],
    "keywords" "text"[] DEFAULT '{}'::"text"[],
    "exclude_ticket_holders" boolean DEFAULT false,
    "exclude_past_attendees" boolean DEFAULT false,
    "estimated_reach" integer,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "campaigns"."campaign_targeting" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "objective" "public"."campaign_objective" DEFAULT 'ticket_sales'::"public"."campaign_objective" NOT NULL,
    "status" "public"."campaign_status" DEFAULT 'draft'::"public"."campaign_status" NOT NULL,
    "total_budget_credits" integer NOT NULL,
    "daily_budget_credits" integer,
    "spent_credits" integer DEFAULT 0 NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "pacing_strategy" "public"."pacing_strategy" DEFAULT 'even'::"public"."pacing_strategy" NOT NULL,
    "frequency_cap_per_user" integer DEFAULT 3,
    "frequency_cap_period" "public"."frequency_period" DEFAULT 'day'::"public"."frequency_period",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "campaigns_budget_nonneg_chk" CHECK ((("total_budget_credits" >= 0) AND (("daily_budget_credits" IS NULL) OR ("daily_budget_credits" >= 0)))),
    CONSTRAINT "campaigns_daily_le_total_chk" CHECK ((("daily_budget_credits" IS NULL) OR ("daily_budget_credits" <= "total_budget_credits"))),
    CONSTRAINT "campaigns_freq_cap_chk" CHECK ((("frequency_cap_per_user" IS NULL) OR ("frequency_cap_per_user" > 0))),
    CONSTRAINT "campaigns_spent_le_total_chk" CHECK ((("spent_credits" >= 0) AND ("spent_credits" <= "total_budget_credits"))),
    CONSTRAINT "campaigns_valid_dates_chk" CHECK ((("end_date" IS NULL) OR ("end_date" > "start_date")))
);


ALTER TABLE "campaigns"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."credit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "credits" integer NOT NULL,
    "price_usd_cents" integer NOT NULL,
    "is_default" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "credit_packages_credits_check" CHECK (("credits" > 0)),
    CONSTRAINT "credit_packages_price_usd_cents_check" CHECK (("price_usd_cents" >= 0))
);


ALTER TABLE "campaigns"."credit_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "campaigns"."promos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "value" integer NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "max_uses" integer,
    "per_user_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "promos_discount_type_chk" CHECK (("discount_type" = ANY (ARRAY['percent'::"text", 'amount'::"text", 'extra_credits'::"text"])))
);


ALTER TABLE "campaigns"."promos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."cultural_guides" (
    "event_id" "uuid" NOT NULL,
    "roots_summary" "text",
    "themes" "text"[] DEFAULT '{}'::"text"[],
    "community" "text"[] DEFAULT '{}'::"text"[],
    "history_long" "text",
    "etiquette_tips" "text"[]
);


ALTER TABLE "events"."cultural_guides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_comment_reactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "event_comment_reactions_kind_check" CHECK (("kind" = 'like'::"text"))
);


ALTER TABLE "events"."event_comment_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "author_user_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "text"
);

ALTER TABLE ONLY "events"."event_comments" REPLICA IDENTITY FULL;


ALTER TABLE "events"."event_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_invites" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "events"."event_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_reactions" (
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "kind" "text" DEFAULT 'like'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "events"."event_reactions" REPLICA IDENTITY FULL;


ALTER TABLE "events"."event_reactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."role_type" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "events"."event_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_scanners" (
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'enabled'::"text" NOT NULL,
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "events"."event_scanners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_series" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "recurrence" "public"."recurrence_pattern" NOT NULL,
    "recurrence_interval" integer DEFAULT 1 NOT NULL,
    "series_start" timestamp with time zone NOT NULL,
    "series_end" "date" NOT NULL,
    "max_events" integer,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "template" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "events"."event_series" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."event_share_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "storage_path" "text",
    "mux_upload_id" "text",
    "mux_asset_id" "text",
    "mux_playback_id" "text",
    "poster_url" "text",
    "duration_seconds" integer,
    "width" integer,
    "height" integer,
    "active" boolean DEFAULT true NOT NULL,
    "title" "text",
    "caption" "text",
    CONSTRAINT "event_share_assets_kind_check" CHECK (("kind" = ANY (ARRAY['story_video'::"text", 'story_image'::"text", 'link_video'::"text", 'link_image'::"text"])))
);


ALTER TABLE "events"."event_share_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_context_type" "public"."owner_context" NOT NULL,
    "owner_context_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "cover_image_url" "text",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "timezone" "text",
    "venue" "text",
    "address" "text",
    "city" "text",
    "country" "text",
    "lat" double precision,
    "lng" double precision,
    "visibility" "public"."event_visibility" DEFAULT 'public'::"public"."event_visibility",
    "refund_cutoff_days" integer DEFAULT 7,
    "hold_payout_until_end" boolean DEFAULT true,
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "link_token" "text",
    "series_id" "uuid",
    "description_embedding" "public"."vector"(1536),
    "brand_safety_tags" "text"[],
    "target_audience" "jsonb",
    "sponsorable" boolean DEFAULT true NOT NULL
);


ALTER TABLE "events"."events" OWNER TO "postgres";


COMMENT ON COLUMN "events"."events"."description_embedding" IS 'Vector embedding of event description for semantic matching';



CREATE TABLE IF NOT EXISTS "events"."hashtags" (
    "tag" "text" NOT NULL
);


ALTER TABLE "events"."hashtags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid",
    "storage_path" "text",
    "mux_upload_id" "text",
    "mux_asset_id" "text",
    "mux_playback_id" "text",
    "poster_url" "text",
    "width" integer,
    "height" integer,
    "duration_seconds" integer,
    "media_type" "text" NOT NULL,
    "status" "text" DEFAULT 'processing'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "media_assets_media_type_check" CHECK (("media_type" = ANY (ARRAY['image'::"text", 'video'::"text", 'gif'::"text"]))),
    CONSTRAINT "media_assets_status_check" CHECK (("status" = ANY (ARRAY['processing'::"text", 'ready'::"text", 'failed'::"text"])))
);


ALTER TABLE "events"."media_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."post_hashtags" (
    "post_id" "uuid" NOT NULL,
    "tag" "text" NOT NULL
);


ALTER TABLE "events"."post_hashtags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."post_media" (
    "post_id" "uuid" NOT NULL,
    "media_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "events"."post_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."post_mentions" (
    "post_id" "uuid" NOT NULL,
    "mentioned_user_id" "uuid" NOT NULL
);


ALTER TABLE "events"."post_mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "events"."role_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "role" "public"."role_type" NOT NULL,
    "email" "text",
    "phone" "text",
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "accepted_user_id" "uuid",
    "status" "public"."invite_status" DEFAULT 'pending'::"public"."invite_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "role_invites_check" CHECK ((("email" IS NOT NULL) OR ("phone" IS NOT NULL)))
);


ALTER TABLE "events"."role_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "messaging"."conversation_participants" (
    "conversation_id" "uuid" NOT NULL,
    "participant_type" "public"."conversation_participant_type" NOT NULL,
    "participant_user_id" "uuid" NOT NULL,
    "participant_org_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_read_at" timestamp with time zone
);


ALTER TABLE "messaging"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "messaging"."direct_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "subject" "text",
    "request_status" "public"."conversation_request_status" DEFAULT 'open'::"public"."conversation_request_status" NOT NULL,
    "last_message_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "messaging"."direct_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "messaging"."direct_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_type" "public"."conversation_participant_type" NOT NULL,
    "sender_user_id" "uuid",
    "sender_org_id" "uuid",
    "body" "text" NOT NULL,
    "attachments" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'sent'::"text" NOT NULL
);


ALTER TABLE "messaging"."direct_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "messaging"."message_job_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "phone" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error" "text",
    "sent_at" timestamp with time zone
);


ALTER TABLE "messaging"."message_job_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "messaging"."message_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "channel" "public"."message_channel" NOT NULL,
    "template_id" "uuid",
    "subject" "text",
    "body" "text",
    "sms_body" "text",
    "from_name" "text",
    "from_email" "text",
    "status" "public"."job_status" DEFAULT 'draft'::"public"."job_status" NOT NULL,
    "batch_size" integer DEFAULT 200 NOT NULL,
    "scheduled_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reply_to" "text"
);


ALTER TABLE "messaging"."message_jobs" OWNER TO "postgres";


COMMENT ON COLUMN "messaging"."message_jobs"."reply_to" IS 'Optional Reply-To address used when sending emails for this job.';



CREATE TABLE IF NOT EXISTS "messaging"."message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "channel" "public"."message_channel" NOT NULL,
    "subject" "text",
    "body" "text",
    "sms_body" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "messaging"."message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "messaging"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "type" "text" NOT NULL,
    "action_url" "text",
    "event_type" "text",
    "data" "jsonb",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['success'::"text", 'error'::"text", 'warning'::"text", 'info'::"text"])))
);


ALTER TABLE "messaging"."notifications" OWNER TO "postgres";


COMMENT ON TABLE "messaging"."notifications" IS 'Stores in-app notification history and delivery metadata for each user.';



CREATE TABLE IF NOT EXISTS "ml"."user_embeddings" (
    "user_id" "uuid" NOT NULL,
    "embedding" "public"."vector"(384),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "ml"."user_embeddings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."org_contact_import_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "import_id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "tags" "text"[] DEFAULT ARRAY[]::"text"[],
    "consent" "text" DEFAULT 'unknown'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "organizations"."org_contact_import_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."org_contact_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "source" "text",
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"(),
    "original_row_count" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "organizations"."org_contact_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."org_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "token" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "accepted_user_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    CONSTRAINT "org_invitations_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'editor'::"text", 'viewer'::"text"]))),
    CONSTRAINT "org_invitations_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'expired'::"text", 'revoked'::"text"])))
);


ALTER TABLE "organizations"."org_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."org_memberships" (
    "org_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."org_role" DEFAULT 'viewer'::"public"."org_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "organizations"."org_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."org_wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "credits_delta" integer NOT NULL,
    "transaction_type" "text" NOT NULL,
    "description" "text",
    "reference_type" "text",
    "reference_id" "uuid",
    "invoice_id" "uuid",
    "stripe_event_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "org_wallet_transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['purchase'::"text", 'spend'::"text", 'refund'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "org_wallet_txn_nonzero_chk" CHECK (("credits_delta" <> 0)),
    CONSTRAINT "org_wallet_txn_sign_by_type_chk" CHECK (((("transaction_type" = 'purchase'::"text") AND ("credits_delta" > 0)) OR (("transaction_type" = 'spend'::"text") AND ("credits_delta" < 0)) OR (("transaction_type" = 'refund'::"text") AND ("credits_delta" < 0)) OR ("transaction_type" = 'adjustment'::"text")))
);


ALTER TABLE "organizations"."org_wallet_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."org_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "balance_credits" integer DEFAULT 0 NOT NULL,
    "low_balance_threshold" integer DEFAULT 1000 NOT NULL,
    "auto_reload_enabled" boolean DEFAULT false NOT NULL,
    "auto_reload_topup_credits" integer DEFAULT 5000,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "org_wallets_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'frozen'::"text"])))
);


ALTER TABLE "organizations"."org_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "handle" "text",
    "logo_url" "text",
    "verification_status" "public"."verification_status" DEFAULT 'none'::"public"."verification_status",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_verified" boolean DEFAULT false,
    "description" "text",
    "social_links" "jsonb" DEFAULT '[]'::"jsonb",
    "banner_url" "text",
    "website_url" "text",
    "twitter_url" "text",
    "instagram_url" "text",
    "tiktok_url" "text",
    "location" "text",
    "support_email" "text"
);


ALTER TABLE "organizations"."organizations" OWNER TO "postgres";


COMMENT ON COLUMN "organizations"."organizations"."description" IS 'Organization description/bio';



COMMENT ON COLUMN "organizations"."organizations"."social_links" IS 'Array of social media links with platform, url, and is_primary fields';



CREATE TABLE IF NOT EXISTS "organizations"."payout_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "context_type" "public"."owner_context" NOT NULL,
    "context_id" "uuid" NOT NULL,
    "stripe_connect_id" "text",
    "charges_enabled" boolean DEFAULT false,
    "payouts_enabled" boolean DEFAULT false,
    "details_submitted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "organizations"."payout_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "organizations"."payout_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "stripe_connect_account_id" "text" NOT NULL,
    "platform_fee_percentage" numeric(5,4) DEFAULT 0.05 NOT NULL,
    "minimum_payout_amount_cents" integer DEFAULT 1000 NOT NULL,
    "payout_schedule" "text" DEFAULT 'manual'::"text" NOT NULL,
    "auto_payout_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payout_configurations_fee_valid" CHECK ((("platform_fee_percentage" >= (0)::numeric) AND ("platform_fee_percentage" <= (1)::numeric))),
    CONSTRAINT "payout_configurations_min_payout_positive" CHECK (("minimum_payout_amount_cents" > 0)),
    CONSTRAINT "payout_configurations_minimum_payout_amount_cents_check" CHECK (("minimum_payout_amount_cents" > 0)),
    CONSTRAINT "payout_configurations_payout_schedule_check" CHECK (("payout_schedule" = ANY (ARRAY['manual'::"text", 'daily'::"text", 'weekly'::"text", 'monthly'::"text"]))),
    CONSTRAINT "payout_configurations_platform_fee_percentage_check" CHECK ((("platform_fee_percentage" >= (0)::numeric) AND ("platform_fee_percentage" <= (1)::numeric)))
);


ALTER TABLE "organizations"."payout_configurations" OWNER TO "postgres";


COMMENT ON TABLE "organizations"."payout_configurations" IS 'Stores payout configuration for each organization';



CREATE TABLE IF NOT EXISTS "payments"."credit_lots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid",
    "org_wallet_id" "uuid",
    "quantity_purchased" integer NOT NULL,
    "quantity_remaining" integer NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "source" "text" NOT NULL,
    "stripe_checkout_session_id" "text",
    "invoice_id" "uuid",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "depleted_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "credit_lot_wallet_xor" CHECK ((((("wallet_id" IS NOT NULL))::integer + (("org_wallet_id" IS NOT NULL))::integer) = 1)),
    CONSTRAINT "credit_lots_check" CHECK ((("quantity_remaining" >= 0) AND ("quantity_remaining" <= "quantity_purchased"))),
    CONSTRAINT "credit_lots_quantity_purchased_check" CHECK (("quantity_purchased" > 0)),
    CONSTRAINT "credit_lots_source_check" CHECK (("source" = ANY (ARRAY['purchase'::"text", 'grant'::"text", 'refund'::"text", 'promo'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "credit_lots_unit_price_cents_check" CHECK (("unit_price_cents" >= 0))
);


ALTER TABLE "payments"."credit_lots" OWNER TO "postgres";


COMMENT ON TABLE "payments"."credit_lots" IS 'Tracks individual credit purchase lots for FIFO deduction and refund granularity';



COMMENT ON COLUMN "payments"."credit_lots"."expires_at" IS 'NULL = never expires (standard for org credits)';



CREATE TABLE IF NOT EXISTS "payments"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid",
    "stripe_invoice_id" "text",
    "stripe_payment_intent_id" "text",
    "amount_usd_cents" integer NOT NULL,
    "credits_purchased" integer NOT NULL,
    "promo_code" "text",
    "tax_usd_cents" integer DEFAULT 0 NOT NULL,
    "status" "text" NOT NULL,
    "receipt_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "org_wallet_id" "uuid",
    "purchased_by_user_id" "uuid",
    CONSTRAINT "invoices_amount_usd_cents_check" CHECK (("amount_usd_cents" >= 0)),
    CONSTRAINT "invoices_credits_purchased_check" CHECK (("credits_purchased" >= 0)),
    CONSTRAINT "invoices_status_chk" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"]))),
    CONSTRAINT "invoices_tax_usd_cents_check" CHECK (("tax_usd_cents" >= 0)),
    CONSTRAINT "invoices_wallet_check" CHECK ((("wallet_id" IS NOT NULL) OR ("org_wallet_id" IS NOT NULL))),
    CONSTRAINT "invoices_wallet_xor" CHECK ((((("wallet_id" IS NOT NULL))::integer + (("org_wallet_id" IS NOT NULL))::integer) = 1))
);


ALTER TABLE "payments"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "payments"."invoices"."purchased_by_user_id" IS 'User who initiated the purchase (important for org credit purchases to track who paid)';



CREATE TABLE IF NOT EXISTS "payments"."payout_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "priority" integer DEFAULT 0,
    "scheduled_for" timestamp with time zone DEFAULT "now"() NOT NULL,
    "attempts" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 3,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "payout_queue_priority_check" CHECK (("priority" >= 0)),
    CONSTRAINT "payout_queue_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "payments"."payout_queue" OWNER TO "postgres";


COMMENT ON TABLE "payments"."payout_queue" IS 'Queue for processing payouts to organizers';



CREATE TABLE IF NOT EXISTS "payments"."wallet_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "credits_delta" integer NOT NULL,
    "usd_cents" integer,
    "reference_type" "text",
    "reference_id" "text",
    "memo" "text",
    "idempotency_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallet_txn_type_chk" CHECK (("type" = ANY (ARRAY['purchase'::"text", 'spend'::"text", 'refund'::"text", 'adjustment'::"text", 'promo'::"text"])))
);


ALTER TABLE "payments"."wallet_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "payments"."wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance_credits" integer DEFAULT 0 NOT NULL,
    "low_balance_threshold" integer DEFAULT 0 NOT NULL,
    "auto_reload_enabled" boolean DEFAULT false NOT NULL,
    "auto_reload_topup_credits" integer,
    "default_payment_method_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "wallets_status_chk" CHECK (("status" = ANY (ARRAY['active'::"text", 'frozen'::"text"])))
);


ALTER TABLE "payments"."wallets" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."campaign_analytics_daily" AS
 WITH "imp" AS (
         SELECT "ad_impressions"."campaign_id",
            ("date_trunc"('day'::"text", ("ad_impressions"."created_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "date_utc",
            "count"(*) AS "impressions"
           FROM "campaigns"."ad_impressions"
          GROUP BY "ad_impressions"."campaign_id", (("date_trunc"('day'::"text", ("ad_impressions"."created_at" AT TIME ZONE 'UTC'::"text")))::"date")
        ), "clk" AS (
         SELECT "ad_clicks"."campaign_id",
            ("date_trunc"('day'::"text", ("ad_clicks"."created_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "date_utc",
            "count"(*) AS "clicks",
            "count"(*) FILTER (WHERE "ad_clicks"."converted") AS "conversions",
            COALESCE("sum"("ad_clicks"."conversion_value_cents") FILTER (WHERE "ad_clicks"."converted"), (0)::bigint) AS "revenue_cents"
           FROM "campaigns"."ad_clicks"
          GROUP BY "ad_clicks"."campaign_id", (("date_trunc"('day'::"text", ("ad_clicks"."created_at" AT TIME ZONE 'UTC'::"text")))::"date")
        ), "spend" AS (
         SELECT "ad_spend_ledger"."campaign_id",
            ("date_trunc"('day'::"text", ("ad_spend_ledger"."occurred_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "date_utc",
            COALESCE("sum"("ad_spend_ledger"."credits_charged"), (0)::bigint) AS "credits_spent"
           FROM "campaigns"."ad_spend_ledger"
          GROUP BY "ad_spend_ledger"."campaign_id", (("date_trunc"('day'::"text", ("ad_spend_ledger"."occurred_at" AT TIME ZONE 'UTC'::"text")))::"date")
        ), "days" AS (
         SELECT "c"."id" AS "campaign_id",
            "c"."org_id",
            ("gs"."gs")::"date" AS "date_utc"
           FROM ("campaigns"."campaigns" "c"
             CROSS JOIN LATERAL "generate_series"((("date_trunc"('day'::"text", ("c"."start_date" AT TIME ZONE 'UTC'::"text")))::"date")::timestamp with time zone, (LEAST(("date_trunc"('day'::"text", (COALESCE("c"."end_date", "now"()) AT TIME ZONE 'UTC'::"text")))::"date", ("date_trunc"('day'::"text", ("now"() AT TIME ZONE 'UTC'::"text")))::"date"))::timestamp with time zone, '1 day'::interval) "gs"("gs"))
        )
 SELECT "d"."campaign_id",
    "d"."org_id",
    "d"."date_utc" AS "date",
    COALESCE("imp"."impressions", (0)::bigint) AS "impressions",
    COALESCE("clk"."clicks", (0)::bigint) AS "clicks",
    COALESCE("clk"."conversions", (0)::bigint) AS "conversions",
    COALESCE("clk"."revenue_cents", (0)::bigint) AS "revenue_cents",
    COALESCE("spend"."credits_spent", (0)::bigint) AS "credits_spent"
   FROM ((("days" "d"
     LEFT JOIN "imp" ON ((("imp"."campaign_id" = "d"."campaign_id") AND ("imp"."date_utc" = "d"."date_utc"))))
     LEFT JOIN "clk" ON ((("clk"."campaign_id" = "d"."campaign_id") AND ("clk"."date_utc" = "d"."date_utc"))))
     LEFT JOIN "spend" ON ((("spend"."campaign_id" = "d"."campaign_id") AND ("spend"."date_utc" = "d"."date_utc"))))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."campaign_analytics_daily" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."campaign_analytics_daily" IS 'Daily analytics per campaign (UTC): impressions/clicks/conversions/revenue/credits_spent. Facts aggregated independently and left-joined to per-campaign day series.';



CREATE OR REPLACE VIEW "public"."campaign_analytics_daily_secured" WITH ("security_barrier"='true') AS
 SELECT "campaign_id",
    "org_id",
    "date",
    "impressions",
    "clicks",
    "conversions",
    "revenue_cents",
    "credits_spent"
   FROM "public"."campaign_analytics_daily" "mv"
  WHERE (EXISTS ( SELECT 1
           FROM "organizations"."org_memberships" "om"
          WHERE (("om"."org_id" = "mv"."org_id") AND ("om"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."campaign_analytics_daily_secured" OWNER TO "postgres";


COMMENT ON VIEW "public"."campaign_analytics_daily_secured" IS 'SECURITY DEFINER: Campaign analytics with ownership verification. Only shows user''s own campaign data.';



CREATE OR REPLACE VIEW "public"."campaigns" AS
 SELECT "id",
    "org_id",
    "created_by",
    "name",
    "description",
    "objective",
    "status",
    "total_budget_credits",
    "daily_budget_credits",
    "spent_credits",
    "start_date",
    "end_date",
    "timezone",
    "pacing_strategy",
    "frequency_cap_per_user",
    "frequency_cap_period",
    "created_at",
    "updated_at",
    "archived_at"
   FROM "campaigns"."campaigns";


ALTER VIEW "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."circuit_breaker_state" (
    "id" "text" NOT NULL,
    "state" "text" DEFAULT 'closed'::"text",
    "failure_count" integer DEFAULT 0,
    "failure_threshold" integer DEFAULT 5,
    "timeout_seconds" integer DEFAULT 60,
    "last_failure_at" timestamp with time zone,
    "next_attempt_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "circuit_breaker_state_state_check" CHECK (("state" = ANY (ARRAY['closed'::"text", 'open'::"text", 'half_open'::"text"])))
);


ALTER TABLE "public"."circuit_breaker_state" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."creative_analytics_daily" AS
 WITH "imp" AS (
         SELECT "ad_impressions"."creative_id",
            ("date_trunc"('day'::"text", ("ad_impressions"."created_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "date_utc",
            "count"(*) AS "impressions"
           FROM "campaigns"."ad_impressions"
          WHERE ("ad_impressions"."creative_id" IS NOT NULL)
          GROUP BY "ad_impressions"."creative_id", (("date_trunc"('day'::"text", ("ad_impressions"."created_at" AT TIME ZONE 'UTC'::"text")))::"date")
        ), "clk" AS (
         SELECT "ad_clicks"."creative_id",
            ("date_trunc"('day'::"text", ("ad_clicks"."created_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "date_utc",
            "count"(*) AS "clicks",
            "count"(*) FILTER (WHERE "ad_clicks"."converted") AS "conversions",
            COALESCE("sum"("ad_clicks"."conversion_value_cents") FILTER (WHERE "ad_clicks"."converted"), (0)::bigint) AS "revenue_cents"
           FROM "campaigns"."ad_clicks"
          WHERE ("ad_clicks"."creative_id" IS NOT NULL)
          GROUP BY "ad_clicks"."creative_id", (("date_trunc"('day'::"text", ("ad_clicks"."created_at" AT TIME ZONE 'UTC'::"text")))::"date")
        ), "spend" AS (
         SELECT "ad_spend_ledger"."creative_id",
            ("date_trunc"('day'::"text", ("ad_spend_ledger"."occurred_at" AT TIME ZONE 'UTC'::"text")))::"date" AS "date_utc",
            COALESCE("sum"("ad_spend_ledger"."credits_charged"), (0)::bigint) AS "credits_spent"
           FROM "campaigns"."ad_spend_ledger"
          WHERE ("ad_spend_ledger"."creative_id" IS NOT NULL)
          GROUP BY "ad_spend_ledger"."creative_id", (("date_trunc"('day'::"text", ("ad_spend_ledger"."occurred_at" AT TIME ZONE 'UTC'::"text")))::"date")
        ), "days" AS (
         SELECT "ac"."id" AS "creative_id",
            "c"."id" AS "campaign_id",
            "c"."org_id",
            ("gs"."gs")::"date" AS "date_utc"
           FROM (("campaigns"."ad_creatives" "ac"
             JOIN "campaigns"."campaigns" "c" ON (("c"."id" = "ac"."campaign_id")))
             CROSS JOIN LATERAL "generate_series"((("date_trunc"('day'::"text", ("c"."start_date" AT TIME ZONE 'UTC'::"text")))::"date")::timestamp with time zone, (LEAST(("date_trunc"('day'::"text", (COALESCE("c"."end_date", "now"()) AT TIME ZONE 'UTC'::"text")))::"date", ("date_trunc"('day'::"text", ("now"() AT TIME ZONE 'UTC'::"text")))::"date"))::timestamp with time zone, '1 day'::interval) "gs"("gs"))
        )
 SELECT "d"."creative_id",
    "d"."campaign_id",
    "d"."org_id",
    "d"."date_utc" AS "date",
    COALESCE("imp"."impressions", (0)::bigint) AS "impressions",
    COALESCE("clk"."clicks", (0)::bigint) AS "clicks",
    COALESCE("clk"."conversions", (0)::bigint) AS "conversions",
    COALESCE("clk"."revenue_cents", (0)::bigint) AS "revenue_cents",
    COALESCE("spend"."credits_spent", (0)::bigint) AS "credits_spent"
   FROM ((("days" "d"
     LEFT JOIN "imp" ON ((("imp"."creative_id" = "d"."creative_id") AND ("imp"."date_utc" = "d"."date_utc"))))
     LEFT JOIN "clk" ON ((("clk"."creative_id" = "d"."creative_id") AND ("clk"."date_utc" = "d"."date_utc"))))
     LEFT JOIN "spend" ON ((("spend"."creative_id" = "d"."creative_id") AND ("spend"."date_utc" = "d"."date_utc"))))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."creative_analytics_daily" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."creative_analytics_daily" IS 'Daily analytics per creative (UTC): impressions/clicks/conversions/revenue/credits_spent.';



CREATE OR REPLACE VIEW "public"."creative_analytics_daily_secured" WITH ("security_barrier"='true') AS
 SELECT "creative_id",
    "campaign_id",
    "org_id",
    "date",
    "impressions",
    "clicks",
    "conversions",
    "revenue_cents",
    "credits_spent"
   FROM "public"."creative_analytics_daily" "cad"
  WHERE (EXISTS ( SELECT 1
           FROM "organizations"."org_memberships" "om"
          WHERE (("om"."org_id" = "cad"."org_id") AND ("om"."user_id" = "auth"."uid"()))));


ALTER VIEW "public"."creative_analytics_daily_secured" OWNER TO "postgres";


COMMENT ON VIEW "public"."creative_analytics_daily_secured" IS 'SECURITY DEFINER: Analytics view with built-in ownership checks. Only returns data for campaigns user owns.';



CREATE TABLE IF NOT EXISTS "public"."dead_letter_webhooks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "correlation_id" "uuid",
    "webhook_type" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "original_timestamp" timestamp with time zone NOT NULL,
    "failure_reason" "text",
    "retry_count" integer DEFAULT 0,
    "last_retry_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "dead_letter_webhooks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'retrying'::"text", 'failed'::"text", 'succeeded'::"text"])))
);


ALTER TABLE "public"."dead_letter_webhooks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_comments" AS
 SELECT "id",
    "post_id",
    "author_user_id",
    "text",
    "created_at",
    "client_id"
   FROM "events"."event_comments";


ALTER VIEW "public"."event_comments" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organizer_connect" AS
 SELECT ("context_type")::"text" AS "owner_context_type",
    "context_id" AS "owner_context_id",
    "stripe_connect_id" AS "stripe_connect_account_id"
   FROM "organizations"."payout_accounts";


ALTER VIEW "public"."organizer_connect" OWNER TO "postgres";


COMMENT ON VIEW "public"."organizer_connect" IS 'SECURITY DEFINER: Provides organizers with aggregated event data. Access controlled by org_memberships RLS.';



CREATE OR REPLACE VIEW "public"."event_connect" AS
 SELECT "e"."id" AS "event_id",
    "oc"."stripe_connect_account_id"
   FROM ("events"."events" "e"
     JOIN "public"."organizer_connect" "oc" ON ((("oc"."owner_context_type" = ("e"."owner_context_type")::"text") AND ("oc"."owner_context_id" = "e"."owner_context_id"))));


ALTER VIEW "public"."event_connect" OWNER TO "postgres";


COMMENT ON VIEW "public"."event_connect" IS 'SECURITY DEFINER: Provides event organizers with connection data. Access controlled by event ownership.';



CREATE MATERIALIZED VIEW "public"."event_covis" AS
 SELECT "e1"."event_id" AS "event_a",
    "e2"."event_id" AS "event_b",
    "count"(DISTINCT "e1"."user_id") AS "covisit_count",
    ((("count"(DISTINCT "e1"."user_id"))::numeric * 1.0) / (NULLIF(( SELECT "count"(DISTINCT "user_event_interactions"."user_id") AS "count"
           FROM "analytics"."user_event_interactions"
          WHERE ("user_event_interactions"."event_id" = "e1"."event_id")), 0))::numeric) AS "covisit_ratio"
   FROM ("analytics"."user_event_interactions" "e1"
     JOIN "analytics"."user_event_interactions" "e2" ON ((("e1"."user_id" = "e2"."user_id") AND ("e1"."event_id" <> "e2"."event_id"))))
  GROUP BY "e1"."event_id", "e2"."event_id"
 HAVING ("count"(DISTINCT "e1"."user_id") >= 2)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."event_covis" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_posts" AS
 SELECT "id",
    "event_id",
    "author_user_id",
    "ticket_tier_id",
    "text",
    "media_urls",
    "created_at",
    "updated_at",
    "like_count",
    "comment_count",
    "deleted_at",
    "post_type",
    "visibility",
    "reply_count",
    "share_count",
    "edited_at",
    "pinned",
    "link_url",
    "link_meta",
    "moderation_state",
    "language"
   FROM "events"."event_posts";


ALTER VIEW "public"."event_posts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_posts_with_meta" AS
 SELECT "p"."id",
    "p"."event_id",
    "p"."author_user_id",
    "p"."ticket_tier_id",
    "p"."text",
    "p"."media_urls",
    "p"."created_at",
    "p"."updated_at",
    "p"."like_count",
    "p"."comment_count",
    "p"."deleted_at",
    "up"."display_name" AS "author_name",
    "up"."photo_url" AS "author_photo_url",
    "e"."title" AS "event_title",
    ("p"."author_user_id" = "e"."created_by") AS "author_is_organizer",
        CASE
            WHEN ("p"."author_user_id" = "e"."created_by") THEN 'ORGANIZER'::"text"
            ELSE COALESCE("public"."get_user_event_badge"("p"."author_user_id", "p"."event_id"), 'ATTENDEE'::"text")
        END AS "author_badge_label",
    false AS "viewer_has_liked"
   FROM (("events"."event_posts" "p"
     LEFT JOIN "users"."user_profiles" "up" ON (("up"."user_id" = "p"."author_user_id")))
     JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")));


ALTER VIEW "public"."event_posts_with_meta" OWNER TO "postgres";


COMMENT ON VIEW "public"."event_posts_with_meta" IS 'SECURITY DEFINER: Legacy post feed view. Consider migrating to event_posts_with_meta_v2.';



CREATE OR REPLACE VIEW "public"."event_reactions" AS
 SELECT "post_id",
    "user_id",
    "kind",
    "created_at"
   FROM "events"."event_reactions";


ALTER VIEW "public"."event_reactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."event_recent_posts_top3" AS
 SELECT "id",
    "event_id",
    "author_user_id",
    "text",
    "media_urls",
    "created_at",
    "like_count",
    "comment_count",
    "author_name",
    "author_photo_url",
    "is_organizer",
    "rn"
   FROM ( SELECT "p"."id",
            "p"."event_id",
            "p"."author_user_id",
            "p"."text",
            "p"."media_urls",
            "p"."created_at",
            "p"."like_count",
            "p"."comment_count",
            "up"."display_name" AS "author_name",
            "up"."photo_url" AS "author_photo_url",
            ("p"."author_user_id" = "e"."created_by") AS "is_organizer",
            "row_number"() OVER (PARTITION BY "p"."event_id" ORDER BY "p"."created_at" DESC) AS "rn"
           FROM (("events"."event_posts" "p"
             JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
             LEFT JOIN "users"."user_profiles" "up" ON (("up"."user_id" = "p"."author_user_id")))
          WHERE ("p"."deleted_at" IS NULL)) "x"
  WHERE ("rn" <= 3);


ALTER VIEW "public"."event_recent_posts_top3" OWNER TO "postgres";


COMMENT ON VIEW "public"."event_recent_posts_top3" IS 'SECURITY DEFINER: Performance-optimized view for event cards. Returns top 3 recent posts per event.';



CREATE MATERIALIZED VIEW "public"."event_video_kpis_daily" AS
 WITH "v" AS (
         SELECT "post_views"."event_id",
            ("date_trunc"('day'::"text", "post_views"."created_at"))::"date" AS "d",
            "count"(*) FILTER (WHERE "post_views"."qualified") AS "views_total",
            "count"(DISTINCT
                CASE
                    WHEN "post_views"."qualified" THEN COALESCE(("post_views"."user_id")::"text", "post_views"."session_id")
                    ELSE NULL::"text"
                END) AS "views_unique",
            "count"(*) FILTER (WHERE "post_views"."completed") AS "completions",
            "avg"("post_views"."dwell_ms") FILTER (WHERE "post_views"."qualified") AS "avg_dwell_ms"
           FROM "analytics"."post_views"
          GROUP BY "post_views"."event_id", (("date_trunc"('day'::"text", "post_views"."created_at"))::"date")
        ), "c" AS (
         SELECT "post_clicks"."event_id",
            ("date_trunc"('day'::"text", "post_clicks"."created_at"))::"date" AS "d",
            "count"(*) FILTER (WHERE ("post_clicks"."target" = 'tickets'::"text")) AS "clicks_tickets",
            "count"(*) FILTER (WHERE ("post_clicks"."target" = 'details'::"text")) AS "clicks_details",
            "count"(*) FILTER (WHERE ("post_clicks"."target" = 'organizer'::"text")) AS "clicks_organizer",
            "count"(*) FILTER (WHERE ("post_clicks"."target" = 'share'::"text")) AS "clicks_share",
            "count"(*) FILTER (WHERE ("post_clicks"."target" = 'comment'::"text")) AS "clicks_comment"
           FROM "analytics"."post_clicks"
          GROUP BY "post_clicks"."event_id", (("date_trunc"('day'::"text", "post_clicks"."created_at"))::"date")
        ), "e" AS (
         SELECT "p"."event_id",
            ("date_trunc"('day'::"text", "r"."created_at"))::"date" AS "d",
            "count"(*) FILTER (WHERE ("r"."kind" = 'like'::"text")) AS "likes",
            "count"(*) FILTER (WHERE ("r"."kind" = 'share'::"text")) AS "shares"
           FROM ("events"."event_posts" "p"
             LEFT JOIN "events"."event_reactions" "r" ON (("r"."post_id" = "p"."id")))
          GROUP BY "p"."event_id", (("date_trunc"('day'::"text", "r"."created_at"))::"date")
        ), "m" AS (
         SELECT "p"."event_id",
            ("date_trunc"('day'::"text", "c_1"."created_at"))::"date" AS "d",
            "count"(*) AS "comments"
           FROM ("events"."event_posts" "p"
             LEFT JOIN "events"."event_comments" "c_1" ON (("c_1"."post_id" = "p"."id")))
          GROUP BY "p"."event_id", (("date_trunc"('day'::"text", "c_1"."created_at"))::"date")
        )
 SELECT COALESCE("v"."event_id", "c"."event_id", "e"."event_id", "m"."event_id") AS "event_id",
    COALESCE("v"."d", "c"."d", "e"."d", "m"."d") AS "d",
    COALESCE("v"."views_total", (0)::bigint) AS "views_total",
    COALESCE("v"."views_unique", (0)::bigint) AS "views_unique",
    COALESCE("v"."completions", (0)::bigint) AS "completions",
    COALESCE("v"."avg_dwell_ms", (0)::numeric) AS "avg_dwell_ms",
    COALESCE("c"."clicks_tickets", (0)::bigint) AS "clicks_tickets",
    COALESCE("c"."clicks_details", (0)::bigint) AS "clicks_details",
    COALESCE("c"."clicks_organizer", (0)::bigint) AS "clicks_organizer",
    COALESCE("c"."clicks_share", (0)::bigint) AS "clicks_share",
    COALESCE("c"."clicks_comment", (0)::bigint) AS "clicks_comment",
    COALESCE("e"."likes", (0)::bigint) AS "likes",
    COALESCE("m"."comments", (0)::bigint) AS "comments",
    COALESCE("e"."shares", (0)::bigint) AS "shares"
   FROM ((("v"
     FULL JOIN "c" USING ("event_id", "d"))
     FULL JOIN "e" USING ("event_id", "d"))
     FULL JOIN "m" USING ("event_id", "d"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."event_video_kpis_daily" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."events" AS
 SELECT "id",
    "owner_context_type",
    "owner_context_id",
    "created_by",
    "title",
    "description",
    "category",
    "cover_image_url",
    "start_at",
    "end_at",
    "timezone",
    "venue",
    "address",
    "city",
    "country",
    "lat",
    "lng",
    "visibility",
    "refund_cutoff_days",
    "hold_payout_until_end",
    "slug",
    "created_at",
    "completed_at",
    "link_token",
    "series_id",
    "description_embedding",
    "brand_safety_tags",
    "target_audience",
    "sponsorable"
   FROM "events"."events";


ALTER VIEW "public"."events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."events_enhanced" AS
 SELECT "e"."id",
    "e"."owner_context_type",
    "e"."owner_context_id",
    "e"."created_by",
    "e"."title",
    "e"."description",
    "e"."category",
    "e"."cover_image_url",
    "e"."start_at",
    "e"."end_at",
    "e"."timezone",
    "e"."venue",
    "e"."address",
    "e"."city",
    "e"."country",
    "e"."lat",
    "e"."lng",
    "e"."visibility",
    "e"."refund_cutoff_days",
    "e"."hold_payout_until_end",
    "e"."slug",
    "e"."created_at",
    "e"."completed_at",
    "e"."link_token",
    (COALESCE("p"."posts_total", (0)::bigint))::integer AS "total_posts",
    (COALESCE("p"."comments_total", (0)::bigint))::integer AS "total_comments",
    "p"."last_post_at"
   FROM ("events"."events" "e"
     LEFT JOIN LATERAL ( SELECT "count"(*) AS "posts_total",
            COALESCE("sum"("ep"."comment_count"), (0)::bigint) AS "comments_total",
            "max"("ep"."created_at") AS "last_post_at"
           FROM "events"."event_posts" "ep"
          WHERE (("ep"."event_id" = "e"."id") AND ("ep"."deleted_at" IS NULL))) "p" ON (true));


ALTER VIEW "public"."events_enhanced" OWNER TO "postgres";


COMMENT ON VIEW "public"."events_enhanced" IS 'SECURITY DEFINER: Enhanced event view with computed fields. Respects event visibility settings.';



CREATE TABLE IF NOT EXISTS "users"."follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "follower_user_id" "uuid" NOT NULL,
    "target_type" "public"."follow_target" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'accepted'::"text",
    "follower_type" "public"."follow_actor" DEFAULT 'user'::"public"."follow_actor" NOT NULL,
    "follower_org_id" "uuid",
    CONSTRAINT "follows_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])))
);

ALTER TABLE ONLY "users"."follows" REPLICA IDENTITY FULL;


ALTER TABLE "users"."follows" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."follow_profiles" AS
 SELECT "f"."id",
    "f"."follower_user_id",
    "f"."target_type",
    "f"."target_id",
    COALESCE("f"."status", 'accepted'::"text") AS "status",
    "f"."created_at",
        CASE
            WHEN ("f"."target_type" = 'user'::"public"."follow_target") THEN "up"."display_name"
            WHEN ("f"."target_type" = 'organizer'::"public"."follow_target") THEN "o"."name"
            WHEN ("f"."target_type" = 'event'::"public"."follow_target") THEN "e"."title"
            ELSE NULL::"text"
        END AS "target_name",
        CASE
            WHEN ("f"."target_type" = 'user'::"public"."follow_target") THEN "up"."photo_url"
            WHEN ("f"."target_type" = 'organizer'::"public"."follow_target") THEN "o"."logo_url"
            WHEN ("f"."target_type" = 'event'::"public"."follow_target") THEN "e"."cover_image_url"
            ELSE NULL::"text"
        END AS "target_photo",
    "up_follower"."display_name" AS "follower_name",
    "up_follower"."photo_url" AS "follower_photo"
   FROM (((("users"."follows" "f"
     LEFT JOIN "users"."user_profiles" "up" ON ((("f"."target_type" = 'user'::"public"."follow_target") AND ("up"."user_id" = "f"."target_id"))))
     LEFT JOIN "organizations"."organizations" "o" ON ((("f"."target_type" = 'organizer'::"public"."follow_target") AND ("o"."id" = "f"."target_id"))))
     LEFT JOIN "events"."events" "e" ON ((("f"."target_type" = 'event'::"public"."follow_target") AND ("e"."id" = "f"."target_id"))))
     LEFT JOIN "users"."user_profiles" "up_follower" ON (("up_follower"."user_id" = "f"."follower_user_id")));


ALTER VIEW "public"."follow_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."follow_stats" AS
 SELECT "target_type",
    "target_id",
    "count"(*) FILTER (WHERE ("status" = 'accepted'::"text")) AS "follower_count",
    "count"(*) FILTER (WHERE ("status" = 'pending'::"text")) AS "pending_count"
   FROM "users"."follows"
  GROUP BY "target_type", "target_id";


ALTER VIEW "public"."follow_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."following_stats" AS
 SELECT COALESCE(("follower_user_id")::"text", ("follower_org_id")::"text") AS "actor_id",
    "follower_type",
    "count"(*) FILTER (WHERE ("status" = 'accepted'::"text")) AS "following_count"
   FROM "users"."follows"
  GROUP BY COALESCE(("follower_user_id")::"text", ("follower_org_id")::"text"), "follower_type";


ALTER VIEW "public"."following_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."follows" AS
 SELECT "id",
    "follower_user_id",
    "target_type",
    "target_id",
    "created_at",
    "status",
    "follower_type",
    "follower_org_id"
   FROM "users"."follows";


ALTER VIEW "public"."follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."idempotency_keys" (
    "key" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "response" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."idempotency_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kv_store_d42c04e8" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL
);


ALTER TABLE "public"."kv_store_d42c04e8" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sponsorship"."sponsorship_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "inventory" integer DEFAULT 1 NOT NULL,
    "benefits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text",
    "description" "text",
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "sold" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "expected_reach" integer,
    "avg_engagement_score" numeric,
    "package_type" "text",
    "stat_snapshot_id" "uuid",
    "quality_score" integer,
    "quality_updated_at" timestamp with time zone,
    "template_id" "uuid",
    "version" integer DEFAULT 1 NOT NULL,
    "availability" "jsonb",
    "audience_snapshot" "jsonb",
    "constraints" "jsonb",
    CONSTRAINT "sponsorship_packages_currency_chk" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'CAD'::"text"]))),
    CONSTRAINT "sponsorship_packages_inventory_check" CHECK (("inventory" >= 0)),
    CONSTRAINT "sponsorship_packages_inventory_positive" CHECK (("inventory" >= 0)),
    CONSTRAINT "sponsorship_packages_price_cents_check" CHECK (("price_cents" >= 0)),
    CONSTRAINT "sponsorship_packages_price_positive" CHECK (("price_cents" >= 0)),
    CONSTRAINT "sponsorship_packages_quality_score_check" CHECK ((("quality_score" IS NULL) OR (("quality_score" >= 0) AND ("quality_score" <= 100)))),
    CONSTRAINT "sponsorship_packages_quality_valid" CHECK ((("quality_score" IS NULL) OR (("quality_score" >= 0) AND ("quality_score" <= 100)))),
    CONSTRAINT "sponsorship_packages_reach_positive" CHECK ((("expected_reach" IS NULL) OR ("expected_reach" >= 0))),
    CONSTRAINT "sponsorship_packages_sold_valid" CHECK ((("sold" >= 0) AND ("sold" <= "inventory"))),
    CONSTRAINT "sponsorship_packages_version_positive" CHECK (("version" > 0))
);


ALTER TABLE "sponsorship"."sponsorship_packages" OWNER TO "postgres";


COMMENT ON COLUMN "sponsorship"."sponsorship_packages"."expected_reach" IS 'Estimated audience reach for this package';



COMMENT ON COLUMN "sponsorship"."sponsorship_packages"."quality_score" IS '0-100 quality score based on engagement, conversion, and fulfillment history';



COMMENT ON CONSTRAINT "sponsorship_packages_currency_chk" ON "sponsorship"."sponsorship_packages" IS 'Enforces ISO currency codes (uppercase)';



CREATE OR REPLACE VIEW "public"."marketplace_sponsorships" AS
 SELECT "p"."id" AS "package_id",
    "e"."id" AS "event_id",
    "e"."title" AS "event_title",
    "e"."city",
    "e"."category",
    "e"."start_at",
    "p"."tier",
    "p"."price_cents",
    "p"."inventory",
    "p"."benefits"
   FROM ("sponsorship"."sponsorship_packages" "p"
     JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
  WHERE ("p"."visibility" = 'public'::"text");


ALTER VIEW "public"."marketplace_sponsorships" OWNER TO "postgres";


COMMENT ON VIEW "public"."marketplace_sponsorships" IS 'SECURITY DEFINER: Public marketplace view. Shows only publicly visible sponsorship opportunities.';



CREATE OR REPLACE VIEW "public"."messaging_inbox" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"text" AS "subject",
    NULL::"public"."conversation_request_status" AS "request_status",
    NULL::timestamp with time zone AS "last_message_at",
    NULL::timestamp with time zone AS "created_at",
    NULL::"jsonb" AS "metadata",
    NULL::"jsonb" AS "participants";


ALTER VIEW "public"."messaging_inbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "subtotal_cents" integer DEFAULT 0 NOT NULL,
    "fees_cents" integer DEFAULT 0 NOT NULL,
    "total_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "stripe_session_id" "text",
    "stripe_payment_intent_id" "text",
    "payout_destination_owner" "public"."owner_context",
    "payout_destination_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "paid_at" timestamp with time zone,
    "hold_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "tickets_issued_count" integer DEFAULT 0,
    "checkout_session_id" "text",
    "contact_email" "text",
    "contact_name" "text",
    "contact_phone" "text",
    CONSTRAINT "check_currency" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'CAD'::"text"])))
);


ALTER TABLE "ticketing"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "status" "public"."ticket_status" DEFAULT 'issued'::"public"."ticket_status" NOT NULL,
    "qr_code" "text" DEFAULT "public"."gen_qr_code"() NOT NULL,
    "wallet_pass_url" "text",
    "redeemed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "serial_no" integer NOT NULL,
    CONSTRAINT "ck_tickets_qr_format" CHECK ((("char_length"("qr_code") = 8) AND ("qr_code" ~ '^[A-HJ-NP-Z2-9]{8}$'::"text"))),
    CONSTRAINT "ck_tickets_serial_positive" CHECK (("serial_no" >= 1))
);


ALTER TABLE "ticketing"."tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_event_quality_score" AS
 WITH "event_metrics" AS (
         SELECT "e"."id" AS "event_id",
            "e"."title",
            "e"."start_at",
            "e"."category",
            COALESCE("ev"."views_total", (0)::bigint) AS "total_views",
            COALESCE("ev"."avg_dwell_ms", (0)::bigint) AS "avg_dwell_ms",
            COALESCE("ev"."completions", (0)::bigint) AS "video_completions",
            COALESCE("ev"."likes", (0)::bigint) AS "likes",
            COALESCE("ev"."comments", (0)::bigint) AS "comments",
            COALESCE("ev"."shares", (0)::bigint) AS "shares",
            (( SELECT "count"(*) AS "count"
                   FROM "ticketing"."orders" "o"
                  WHERE (("o"."event_id" = "e"."id") AND ("o"."status" = 'paid'::"public"."order_status"))))::integer AS "orders_count",
            (( SELECT "count"(*) AS "count"
                   FROM "ticketing"."tickets" "t"
                  WHERE ("t"."event_id" = "e"."id")))::integer AS "tickets_sold",
            (( SELECT "count"(DISTINCT "pi"."user_id") AS "count"
                   FROM ("analytics"."post_impressions" "pi"
                     JOIN "events"."event_posts" "ep" ON (("ep"."id" = "pi"."post_id")))
                  WHERE ("ep"."event_id" = "e"."id")))::integer AS "unique_visitors",
                CASE
                    WHEN (COALESCE("ev"."views_total", (0)::bigint) > 0) THEN ((((COALESCE("ev"."likes", (0)::bigint) + COALESCE("ev"."comments", (0)::bigint)) + COALESCE("ev"."shares", (0)::bigint)))::numeric / ("ev"."views_total")::numeric)
                    ELSE (0)::numeric
                END AS "engagement_rate",
                CASE
                    WHEN (( SELECT "count"(DISTINCT "pi"."user_id") AS "count"
                       FROM ("analytics"."post_impressions" "pi"
                         JOIN "events"."event_posts" "ep" ON (("ep"."id" = "pi"."post_id")))
                      WHERE ("ep"."event_id" = "e"."id")) > 0) THEN ((( SELECT "count"(*) AS "count"
                       FROM "ticketing"."orders" "o"
                      WHERE (("o"."event_id" = "e"."id") AND ("o"."status" = 'paid'::"public"."order_status"))))::numeric / (( SELECT "count"(DISTINCT "pi"."user_id") AS "count"
                       FROM ("analytics"."post_impressions" "pi"
                         JOIN "events"."event_posts" "ep" ON (("ep"."id" = "pi"."post_id")))
                      WHERE ("ep"."event_id" = "e"."id")))::numeric)
                    ELSE (0)::numeric
                END AS "conversion_rate",
                CASE
                    WHEN ("e"."start_at" > "now"()) THEN 1.0
                    WHEN ("e"."start_at" > ("now"() - '7 days'::interval)) THEN 0.8
                    WHEN ("e"."start_at" > ("now"() - '30 days'::interval)) THEN 0.6
                    WHEN ("e"."start_at" > ("now"() - '90 days'::interval)) THEN 0.4
                    ELSE 0.2
                END AS "recency_score",
            COALESCE("eai"."social_mentions", 0) AS "social_mentions",
            COALESCE("eai"."sentiment_score", (0)::numeric) AS "sentiment_score",
                CASE
                    WHEN ("length"("e"."description") > 200) THEN 1.0
                    WHEN ("length"("e"."description") > 100) THEN 0.7
                    WHEN ("length"("e"."description") > 50) THEN 0.4
                    ELSE 0.1
                END AS "content_quality_score",
                CASE "e"."category"
                    WHEN 'music'::"text" THEN 1.0
                    WHEN 'sports'::"text" THEN 0.9
                    WHEN 'technology'::"text" THEN 0.8
                    WHEN 'business'::"text" THEN 0.7
                    WHEN 'education'::"text" THEN 0.6
                    ELSE 0.5
                END AS "category_popularity_score"
           FROM (("events"."events" "e"
             LEFT JOIN "analytics"."event_video_counters" "ev" ON (("ev"."event_id" = "e"."id")))
             LEFT JOIN "analytics"."event_audience_insights" "eai" ON (("eai"."event_id" = "e"."id")))
        ), "quality_calculations" AS (
         SELECT "event_metrics"."event_id",
            "event_metrics"."title",
            "event_metrics"."start_at",
            "event_metrics"."category",
            "event_metrics"."total_views",
            "event_metrics"."avg_dwell_ms",
            "event_metrics"."video_completions",
            "event_metrics"."likes",
            "event_metrics"."comments",
            "event_metrics"."shares",
            "event_metrics"."orders_count",
            "event_metrics"."tickets_sold",
            "event_metrics"."unique_visitors",
            "event_metrics"."engagement_rate",
            "event_metrics"."conversion_rate",
            "event_metrics"."recency_score",
            "event_metrics"."social_mentions",
            "event_metrics"."sentiment_score",
            "event_metrics"."content_quality_score",
            "event_metrics"."category_popularity_score",
            ((((("event_metrics"."engagement_rate" * 0.3) + ("event_metrics"."conversion_rate" * 0.25)) + ("event_metrics"."recency_score" * 0.2)) + ("event_metrics"."content_quality_score" * 0.15)) + ("event_metrics"."category_popularity_score" * 0.1)) AS "calculated_quality_score",
            LEAST(1.0, (("event_metrics"."total_views")::numeric / 1000.0)) AS "volume_score",
            LEAST(1.0, (("event_metrics"."social_mentions")::numeric / 100.0)) AS "social_proof_score",
            (("event_metrics"."sentiment_score" + 1.0) / 2.0) AS "normalized_sentiment_score"
           FROM "event_metrics"
        )
 SELECT "event_id",
    "title",
    "start_at",
    "category",
    "total_views",
    "avg_dwell_ms",
    "video_completions",
    "likes",
    "comments",
    "shares",
    "orders_count",
    "tickets_sold",
    "unique_visitors",
    "engagement_rate",
    "conversion_rate",
    "recency_score",
    "social_mentions",
    "sentiment_score",
    "content_quality_score",
    "category_popularity_score",
    "calculated_quality_score",
    "volume_score",
    "social_proof_score",
    "normalized_sentiment_score",
    (((("calculated_quality_score" * 0.4) + ("volume_score" * 0.3)) + ("social_proof_score" * 0.2)) + ("normalized_sentiment_score" * 0.1)) AS "final_quality_score",
        CASE
            WHEN ((((("calculated_quality_score" * 0.4) + ("volume_score" * 0.3)) + ("social_proof_score" * 0.2)) + ("normalized_sentiment_score" * 0.1)) >= 0.8) THEN 'premium'::"text"
            WHEN ((((("calculated_quality_score" * 0.4) + ("volume_score" * 0.3)) + ("social_proof_score" * 0.2)) + ("normalized_sentiment_score" * 0.1)) >= 0.6) THEN 'high'::"text"
            WHEN ((((("calculated_quality_score" * 0.4) + ("volume_score" * 0.3)) + ("social_proof_score" * 0.2)) + ("normalized_sentiment_score" * 0.1)) >= 0.4) THEN 'medium'::"text"
            ELSE 'low'::"text"
        END AS "quality_tier",
    "now"() AS "calculated_at"
   FROM "quality_calculations";


ALTER VIEW "public"."v_event_quality_score" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_event_quality_score" IS 'Comprehensive event quality scoring with multiple metrics';



CREATE MATERIALIZED VIEW "public"."mv_event_quality_scores" AS
 SELECT "event_id",
    "title",
    "start_at",
    "category",
    "total_views",
    "avg_dwell_ms",
    "video_completions",
    "likes",
    "comments",
    "shares",
    "orders_count",
    "tickets_sold",
    "unique_visitors",
    "engagement_rate",
    "conversion_rate",
    "recency_score",
    "social_mentions",
    "sentiment_score",
    "content_quality_score",
    "category_popularity_score",
    "calculated_quality_score",
    "volume_score",
    "social_proof_score",
    "normalized_sentiment_score",
    "final_quality_score",
    "quality_tier",
    "calculated_at"
   FROM "public"."v_event_quality_score"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_event_quality_scores" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."mv_event_quality_scores" IS 'Materialized view for fast event quality score lookups';



CREATE MATERIALIZED VIEW "public"."mv_event_reach_snapshot" AS
 SELECT "e"."id" AS "event_id",
    COALESCE("a"."attendee_count", 0) AS "attendee_count",
    ("a"."geo_distribution" -> 'top3'::"text") AS "geo_top3",
    ("a"."age_segments" -> 'buckets'::"text") AS "age_buckets",
    COALESCE("a"."social_mentions", 0) AS "social_mentions",
    COALESCE("a"."sentiment_score", (0)::numeric) AS "sentiment_score",
    "now"() AS "captured_at"
   FROM ("events"."events" "e"
     LEFT JOIN "analytics"."event_audience_insights" "a" ON (("a"."event_id" = "e"."id")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_event_reach_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mv_refresh_log" (
    "id" bigint NOT NULL,
    "ran_at" timestamp with time zone DEFAULT "now"(),
    "concurrent" boolean NOT NULL,
    "duration_ms" integer,
    "note" "text"
);


ALTER TABLE "public"."mv_refresh_log" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."mv_refresh_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."mv_refresh_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."mv_refresh_log_id_seq" OWNED BY "public"."mv_refresh_log"."id";



CREATE TABLE IF NOT EXISTS "sponsorship"."sponsor_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "industry" "text",
    "company_size" "text",
    "annual_budget_cents" integer,
    "brand_objectives" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "target_audience" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "preferred_categories" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "regions" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "activation_preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "reputation_score" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "objectives_embedding" "public"."vector"(1536),
    "verification_status" "text" DEFAULT 'none'::"text",
    "public_visibility" "text" DEFAULT 'full'::"text",
    "case_studies" "jsonb",
    "preferred_formats" "text"[],
    CONSTRAINT "sponsor_profiles_annual_budget_cents_check" CHECK ((("annual_budget_cents" IS NULL) OR ("annual_budget_cents" >= 0))),
    CONSTRAINT "sponsor_profiles_budget_positive" CHECK ((("annual_budget_cents" IS NULL) OR ("annual_budget_cents" >= 0))),
    CONSTRAINT "sponsor_profiles_public_visibility_check" CHECK (("public_visibility" = ANY (ARRAY['hidden'::"text", 'limited'::"text", 'full'::"text"]))),
    CONSTRAINT "sponsor_profiles_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'revoked'::"text"])))
);


ALTER TABLE "sponsorship"."sponsor_profiles" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."sponsor_profiles" IS 'Extended sponsor profiles with targeting preferences and embeddings';



COMMENT ON COLUMN "sponsorship"."sponsor_profiles"."brand_objectives" IS 'JSONB: brand goals, keywords for similarity matching';



COMMENT ON COLUMN "sponsorship"."sponsor_profiles"."target_audience" IS 'JSONB: demographic and psychographic targeting data';



COMMENT ON COLUMN "sponsorship"."sponsor_profiles"."objectives_embedding" IS 'Vector embedding of sponsor objectives for semantic matching';



CREATE MATERIALIZED VIEW "public"."mv_sponsor_event_fit_scores" AS
 SELECT "sp"."sponsor_id",
    "e"."id" AS "event_id",
    0.0 AS "score",
    '{}'::"jsonb" AS "fit_breakdown",
    "now"() AS "computed_at"
   FROM (("events"."events" "e"
     JOIN "analytics"."event_audience_insights" "eai" ON (("eai"."event_id" = "e"."id")))
     CROSS JOIN "sponsorship"."sponsor_profiles" "sp")
  WHERE (("eai"."engagement_score" IS NOT NULL) AND ("e"."start_at" > ("now"() - '6 mons'::interval)) AND ("e"."visibility" = 'public'::"public"."event_visibility"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_sponsor_event_fit_scores" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."mv_sponsor_event_fit_scores" IS 'Precomputed sponsor-event fit scores (refresh nightly)';



CREATE TABLE IF NOT EXISTS "sponsorship"."sponsorship_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "status" "public"."sponsorship_status" DEFAULT 'pending'::"public"."sponsorship_status" NOT NULL,
    "escrow_tx_id" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "stripe_payment_intent_id" "text",
    "stripe_charge_id" "text",
    "stripe_transfer_id" "text",
    "transfer_group" "text",
    "application_fee_cents" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "milestone" "jsonb" DEFAULT '{}'::"jsonb",
    "proof_assets" "jsonb" DEFAULT '{}'::"jsonb",
    "roi_report_id" "uuid",
    "created_by_user_id" "uuid",
    "last_modified_by" "uuid",
    "version_number" integer DEFAULT 1,
    "review_score" numeric(3,2),
    "organizer_stripe_account_id" "text",
    "payout_status" "text" DEFAULT 'pending'::"text",
    "payout_attempts" integer DEFAULT 0,
    "last_payout_attempt_at" timestamp with time zone,
    "payout_failure_reason" "text",
    "contract_url" "text",
    "escrow_state" "text",
    "cancellation_policy" "jsonb",
    "invoice_id" "uuid",
    CONSTRAINT "sponsorship_orders_amount_positive" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "sponsorship_orders_currency_chk" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'CAD'::"text"]))),
    CONSTRAINT "sponsorship_orders_escrow_state_check" CHECK (("escrow_state" = ANY (ARRAY['pending'::"text", 'funded'::"text", 'locked'::"text", 'released'::"text", 'refunded'::"text"]))),
    CONSTRAINT "sponsorship_orders_payout_status_check" CHECK (("payout_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "sponsorship_orders_review_score_check" CHECK ((("review_score" >= (0)::numeric) AND ("review_score" <= (5)::numeric))),
    CONSTRAINT "sponsorship_orders_state_consistency" CHECK ((("escrow_state" IS NULL) OR (("status" = 'pending'::"public"."sponsorship_status") AND ("escrow_state" = ANY (ARRAY['pending'::"text", 'funded'::"text", 'locked'::"text"]))) OR (("status" = 'completed'::"public"."sponsorship_status") AND ("escrow_state" = ANY (ARRAY['released'::"text", 'locked'::"text"]))) OR (("status" = 'cancelled'::"public"."sponsorship_status") AND ("escrow_state" = ANY (ARRAY['refunded'::"text", 'released'::"text", 'pending'::"text"])))))
);


ALTER TABLE "sponsorship"."sponsorship_orders" OWNER TO "postgres";


COMMENT ON COLUMN "sponsorship"."sponsorship_orders"."milestone" IS 'JSONB: payment milestone definitions and status';



COMMENT ON COLUMN "sponsorship"."sponsorship_orders"."proof_assets" IS 'JSONB: URLs and metadata for deliverable proofs';



COMMENT ON CONSTRAINT "sponsorship_orders_state_consistency" ON "sponsorship"."sponsorship_orders" IS 'Enforces coherence between order status and escrow state';



CREATE MATERIALIZED VIEW "public"."mv_sponsorship_revenue" AS
 SELECT "e"."id" AS "event_id",
    "sum"(
        CASE
            WHEN ("o"."status" = ANY (ARRAY['accepted'::"public"."sponsorship_status", 'live'::"public"."sponsorship_status", 'completed'::"public"."sponsorship_status"])) THEN "o"."amount_cents"
            ELSE 0
        END) AS "booked_cents",
    "sum"(
        CASE
            WHEN ("o"."status" = 'completed'::"public"."sponsorship_status") THEN "o"."amount_cents"
            ELSE 0
        END) AS "completed_cents"
   FROM ("events"."events" "e"
     LEFT JOIN "sponsorship"."sponsorship_orders" "o" ON (("o"."event_id" = "e"."id")))
  GROUP BY "e"."id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."mv_sponsorship_revenue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "unit_price_cents" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "ticketing"."order_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."order_items" AS
 SELECT "id",
    "order_id",
    "tier_id",
    "quantity",
    "unit_price_cents",
    "created_at"
   FROM "ticketing"."order_items";


ALTER VIEW "public"."order_items" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."orders" AS
 SELECT "id",
    "user_id",
    "event_id",
    "status",
    "subtotal_cents",
    "fees_cents",
    "total_cents",
    "currency",
    "stripe_session_id",
    "stripe_payment_intent_id",
    "payout_destination_owner",
    "payout_destination_id",
    "created_at",
    "paid_at",
    "hold_ids",
    "tickets_issued_count",
    "checkout_session_id",
    "contact_email",
    "contact_name",
    "contact_phone"
   FROM "ticketing"."orders";


ALTER VIEW "public"."orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."org_memberships" AS
 SELECT "org_id",
    "user_id",
    "role",
    "created_at"
   FROM "organizations"."org_memberships";


ALTER VIEW "public"."org_memberships" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."org_wallet_transactions" AS
 SELECT "id",
    "wallet_id",
    "credits_delta",
    "transaction_type",
    "description",
    "reference_type",
    "reference_id",
    "invoice_id",
    "stripe_event_id",
    "metadata",
    "created_at"
   FROM "organizations"."org_wallet_transactions";


ALTER VIEW "public"."org_wallet_transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."org_wallets" AS
 SELECT "id",
    "org_id",
    "balance_credits",
    "low_balance_threshold",
    "auto_reload_enabled",
    "auto_reload_topup_credits",
    "status",
    "created_at",
    "updated_at"
   FROM "organizations"."org_wallets";


ALTER VIEW "public"."org_wallets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."organizations" AS
 SELECT "id",
    "name",
    "handle",
    "logo_url",
    "verification_status",
    "created_by",
    "created_at",
    "is_verified",
    "description",
    "social_links",
    "banner_url",
    "website_url",
    "twitter_url",
    "instagram_url",
    "tiktok_url",
    "location",
    "support_email"
   FROM "organizations"."organizations";


ALTER VIEW "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "topic" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    CONSTRAINT "outbox_topic_check" CHECK ((("topic" IS NOT NULL) AND ("topic" <> ''::"text")))
);


ALTER TABLE "public"."outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pgbench_tiers" (
    "pos" integer NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "public"."pgbench_tiers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_limits" (
    "user_id" "uuid" NOT NULL,
    "bucket" "text" NOT NULL,
    "minute" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 1,
    "ip_hash" "text"
);


ALTER TABLE "public"."rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."request_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "correlation_id" "uuid",
    "source_type" "text" NOT NULL,
    "function_name" "text",
    "http_method" "text",
    "url" "text",
    "headers" "jsonb",
    "body" "jsonb",
    "response_status" integer,
    "response_body" "jsonb",
    "execution_time_ms" integer,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "request_logs_status_range" CHECK ((("response_status" IS NULL) OR (("response_status" >= 100) AND ("response_status" <= 599))))
);


ALTER TABLE "public"."request_logs" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."search_docs" AS
 WITH "ev" AS (
         SELECT 'event'::"text" AS "kind",
            "e"."id" AS "item_id",
            "e"."title",
            COALESCE("e"."description", ''::"text") AS "body",
            "e"."start_at" AS "starts_at",
            "e"."category",
            COALESCE("e"."city", "e"."venue", ''::"text") AS "location",
            "e"."created_by" AS "organizer_id",
            NULL::"uuid" AS "post_id"
           FROM "events"."events" "e"
        ), "post" AS (
         SELECT 'post'::"text" AS "kind",
            "p"."event_id" AS "item_id",
            COALESCE("e"."title", 'Event'::"text") AS "title",
            COALESCE("p"."text", ''::"text") AS "body",
            "e"."start_at" AS "starts_at",
            "e"."category",
            COALESCE("e"."city", "e"."venue", ''::"text") AS "location",
            "e"."created_by" AS "organizer_id",
            "p"."id" AS "post_id"
           FROM ("events"."event_posts" "p"
             LEFT JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
          WHERE ("p"."deleted_at" IS NULL)
        )
 SELECT "ev"."kind",
    "ev"."item_id",
    "ev"."title",
    "ev"."body",
    "ev"."starts_at",
    "ev"."category",
    "ev"."location",
    "ev"."organizer_id",
    "ev"."post_id"
   FROM "ev"
UNION ALL
 SELECT "post"."kind",
    "post"."item_id",
    "post"."title",
    "post"."body",
    "post"."starts_at",
    "post"."category",
    "post"."location",
    "post"."organizer_id",
    "post"."post_id"
   FROM "post";


ALTER VIEW "public"."search_docs" OWNER TO "postgres";


COMMENT ON VIEW "public"."search_docs" IS 'SECURITY DEFINER: Enables full-text search across public content. Returns only public/visible records.';



CREATE TABLE IF NOT EXISTS "sponsorship"."sponsors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "website_url" "text",
    "contact_email" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "industry" "text",
    "company_size" "text",
    "brand_values" "jsonb" DEFAULT '{}'::"jsonb",
    "preferred_visibility_options" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sponsorship"."sponsors" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."sponsors" AS
 SELECT "id",
    "name",
    "logo_url",
    "website_url",
    "contact_email",
    "created_by",
    "created_at",
    "industry",
    "company_size",
    "brand_values",
    "preferred_visibility_options",
    "updated_at"
   FROM "sponsorship"."sponsors";


ALTER VIEW "public"."sponsors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."ticket_tiers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "badge_label" "text",
    "price_cents" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "quantity" integer,
    "max_per_order" integer DEFAULT 6,
    "sales_start" timestamp with time zone,
    "sales_end" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "sort_index" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "total_quantity" integer,
    "sold_quantity" integer DEFAULT 0,
    "reserved_quantity" integer DEFAULT 0 NOT NULL,
    "issued_quantity" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "check_no_negative_availability" CHECK (((("total_quantity" - COALESCE("sold_quantity", 0)) - COALESCE("reserved_quantity", 0)) >= 0)),
    CONSTRAINT "check_no_negative_reserved" CHECK (("reserved_quantity" >= 0)),
    CONSTRAINT "check_no_negative_sold" CHECK (("sold_quantity" >= 0)),
    CONSTRAINT "check_reserved_lte_total" CHECK (("reserved_quantity" <= "total_quantity")),
    CONSTRAINT "check_reserved_sold_lte_total" CHECK (((COALESCE("sold_quantity", 0) + COALESCE("reserved_quantity", 0)) <= "total_quantity")),
    CONSTRAINT "check_sold_lte_total" CHECK (("sold_quantity" <= "total_quantity")),
    CONSTRAINT "check_tier_status" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'sold_out'::"text"]))),
    CONSTRAINT "ck_ticket_tiers_qty" CHECK ((("total_quantity" IS NULL) OR (("total_quantity" >= 0) AND ("sold_quantity" >= 0) AND ("sold_quantity" <= "total_quantity")))),
    CONSTRAINT "ticket_tiers_currency_chk" CHECK (("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'CAD'::"text"]))),
    CONSTRAINT "ticket_tiers_inventory_guard" CHECK ((("sold_quantity" >= 0) AND ("sold_quantity" <= COALESCE("total_quantity", "quantity"))))
);


ALTER TABLE "ticketing"."ticket_tiers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."ticket_tiers" AS
 SELECT "id",
    "event_id",
    "name",
    "badge_label",
    "price_cents",
    "currency",
    "quantity",
    "max_per_order",
    "sales_start",
    "sales_end",
    "status",
    "sort_index",
    "created_at",
    "total_quantity",
    "sold_quantity",
    "reserved_quantity",
    "issued_quantity"
   FROM "ticketing"."ticket_tiers";


ALTER VIEW "public"."ticket_tiers" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tickets" AS
 SELECT "id",
    "event_id",
    "tier_id",
    "order_id",
    "owner_user_id",
    "status",
    "qr_code",
    "wallet_pass_url",
    "redeemed_at",
    "created_at",
    "serial_no"
   FROM "ticketing"."tickets";


ALTER VIEW "public"."tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."tickets_enhanced" AS
 SELECT "t"."id",
    "t"."event_id",
    "t"."tier_id",
    "t"."order_id",
    "t"."owner_user_id",
    "t"."status",
    "t"."qr_code",
    "t"."wallet_pass_url",
    "t"."redeemed_at",
    "t"."created_at",
    "e"."title" AS "event_title",
    "e"."start_at" AS "event_date",
    ("e"."start_at")::time without time zone AS "event_time",
    COALESCE("e"."venue", "e"."address", "e"."city") AS "event_location",
    "up"."display_name" AS "organizer_name",
    (("tt"."price_cents")::numeric / 100.0) AS "price",
    COALESCE("tt"."badge_label", "tt"."name") AS "badge",
    "tt"."name" AS "ticket_type",
    "o"."created_at" AS "order_date",
    "e"."cover_image_url" AS "cover_image",
    "o"."contact_email" AS "owner_email",
    "o"."contact_name" AS "owner_name",
    "o"."contact_phone" AS "owner_phone"
   FROM (((("ticketing"."tickets" "t"
     JOIN "events"."events" "e" ON (("e"."id" = "t"."event_id")))
     JOIN "ticketing"."ticket_tiers" "tt" ON (("tt"."id" = "t"."tier_id")))
     LEFT JOIN "ticketing"."orders" "o" ON (("o"."id" = "t"."order_id")))
     LEFT JOIN "users"."user_profiles" "up" ON (("up"."user_id" = "e"."created_by")));


ALTER VIEW "public"."tickets_enhanced" OWNER TO "postgres";


COMMENT ON VIEW "public"."tickets_enhanced" IS 'SECURITY DEFINER: Enhanced ticket view with computed fields. Access controlled by tickets table RLS.';



CREATE MATERIALIZED VIEW "public"."trending_posts" AS
 SELECT "id",
    "event_id",
    "created_at",
    "like_count",
    "comment_count",
    (("like_count" * 2) + "comment_count") AS "trending_score"
   FROM "events"."event_posts" "p"
  WHERE ("deleted_at" IS NULL)
  ORDER BY (("like_count" * 2) + "comment_count") DESC, "created_at" DESC
 LIMIT 500
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."trending_posts" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."user_event_affinity" AS
 SELECT "user_id",
    "event_id",
    "sum"("weight") AS "affinity_score",
    "count"(*) AS "interaction_count",
    "max"("created_at") AS "last_interaction"
   FROM "analytics"."user_event_interactions" "ui"
  GROUP BY "user_id", "event_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."user_event_affinity" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_profiles" AS
 SELECT "user_id",
    "display_name",
    "phone",
    "photo_url",
    "role",
    "verification_status",
    "created_at",
    "updated_at",
    "social_links",
    "sponsor_mode_enabled",
    "bio",
    "location"
   FROM "users"."user_profiles";


ALTER VIEW "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_search" AS
 SELECT "up"."user_id",
    "up"."display_name",
    "up"."photo_url",
    "up"."bio",
    "up"."location",
    "up"."created_at",
    COALESCE("followers"."count", (0)::bigint) AS "follower_count",
    COALESCE("following"."count", (0)::bigint) AS "following_count",
        CASE
            WHEN ("current_user_follow"."id" IS NOT NULL) THEN COALESCE("current_user_follow"."status", 'accepted'::"text")
            ELSE 'none'::"text"
        END AS "current_user_follow_status"
   FROM ((("users"."user_profiles" "up"
     LEFT JOIN ( SELECT "follows"."target_id",
            "count"(*) AS "count"
           FROM "users"."follows"
          WHERE (("follows"."target_type" = 'user'::"public"."follow_target") AND (COALESCE("follows"."status", 'accepted'::"text") = 'accepted'::"text"))
          GROUP BY "follows"."target_id") "followers" ON (("followers"."target_id" = "up"."user_id")))
     LEFT JOIN ( SELECT "follows"."follower_user_id",
            "count"(*) AS "count"
           FROM "users"."follows"
          WHERE (("follows"."target_type" = 'user'::"public"."follow_target") AND (COALESCE("follows"."status", 'accepted'::"text") = 'accepted'::"text"))
          GROUP BY "follows"."follower_user_id") "following" ON (("following"."follower_user_id" = "up"."user_id")))
     LEFT JOIN LATERAL ( SELECT "follows"."id",
            "follows"."status"
           FROM "users"."follows"
          WHERE (("follows"."target_type" = 'user'::"public"."follow_target") AND ("follows"."follower_user_id" = "auth"."uid"()) AND ("follows"."target_id" = "up"."user_id"))
         LIMIT 1) "current_user_follow" ON (true));


ALTER VIEW "public"."user_search" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sponsorship"."sponsorship_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "score" numeric DEFAULT 0 NOT NULL,
    "overlap_metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "viewed_at" timestamp with time zone,
    "contacted_at" timestamp with time zone,
    "declined_reason" "text",
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "explanations" "jsonb",
    "reason_codes" "text"[],
    CONSTRAINT "sponsorship_matches_score_chk" CHECK ((("score" >= (0)::numeric) AND ("score" <= (1)::numeric))),
    CONSTRAINT "sponsorship_matches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'suggested'::"text", 'accepted'::"text", 'rejected'::"text"])))
);


ALTER TABLE "sponsorship"."sponsorship_matches" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."sponsorship_matches" IS 'AI-powered sponsor-event match scores with detailed breakdowns';



COMMENT ON COLUMN "sponsorship"."sponsorship_matches"."overlap_metrics" IS 'JSONB breakdown: budget_fit, audience_overlap, geo_fit, engagement_quality, objectives_similarity';



COMMENT ON CONSTRAINT "sponsorship_matches_score_chk" ON "sponsorship"."sponsorship_matches" IS 'Match scores must be between 0 and 1';



CREATE OR REPLACE VIEW "public"."v_event_marketplace" AS
 SELECT "e"."id" AS "event_id",
    "e"."title" AS "event_title",
    "e"."description",
    "e"."category",
    "e"."start_at",
    "e"."city",
    "e"."country",
    "e"."cover_image_url",
    "eqs"."final_quality_score",
    "eqs"."quality_tier",
    "eqs"."total_views",
    "eqs"."avg_dwell_ms",
    "eqs"."tickets_sold",
    "eqs"."conversion_rate",
    "eqs"."engagement_rate",
    "eqs"."social_mentions",
    "eqs"."sentiment_score",
    "count"(DISTINCT "sm"."sponsor_id") AS "matched_sponsors_count",
    "avg"("sm"."score") AS "avg_sponsor_match_score",
    "max"("sm"."score") AS "best_sponsor_match_score",
    "count"(DISTINCT
        CASE
            WHEN ("sm"."score" > 0.8) THEN "sm"."sponsor_id"
            ELSE NULL::"uuid"
        END) AS "high_quality_sponsors",
    "count"(DISTINCT "sp"."id") AS "available_packages",
    "min"("sp"."price_cents") AS "min_package_price",
    "max"("sp"."price_cents") AS "max_package_price",
    "avg"("sp"."price_cents") AS "avg_package_price",
    "max"("sm"."updated_at") AS "last_match_update"
   FROM ((("events"."events" "e"
     LEFT JOIN "public"."mv_event_quality_scores" "eqs" ON (("eqs"."event_id" = "e"."id")))
     LEFT JOIN "sponsorship"."sponsorship_matches" "sm" ON (("sm"."event_id" = "e"."id")))
     LEFT JOIN "sponsorship"."sponsorship_packages" "sp" ON ((("sp"."event_id" = "e"."id") AND ("sp"."is_active" = true))))
  GROUP BY "e"."id", "e"."title", "e"."description", "e"."category", "e"."start_at", "e"."city", "e"."country", "e"."cover_image_url", "eqs"."final_quality_score", "eqs"."quality_tier", "eqs"."total_views", "eqs"."avg_dwell_ms", "eqs"."tickets_sold", "eqs"."conversion_rate", "eqs"."engagement_rate", "eqs"."social_mentions", "eqs"."sentiment_score";


ALTER VIEW "public"."v_event_marketplace" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_event_marketplace" IS 'Comprehensive marketplace view for events with performance metrics';



CREATE OR REPLACE VIEW "public"."v_event_performance_summary" AS
 SELECT "e"."id" AS "event_id",
    "e"."title" AS "event_title",
    "e"."start_at",
    "e"."category",
    COALESCE("ev"."views_total", (0)::bigint) AS "total_views",
    COALESCE("ev"."avg_dwell_ms", (0)::bigint) AS "avg_dwell_ms",
    COALESCE("ev"."completions", (0)::bigint) AS "video_completions",
    (( SELECT "count"(*) AS "count"
           FROM "ticketing"."orders" "o"
          WHERE (("o"."event_id" = "e"."id") AND ("o"."status" = 'paid'::"public"."order_status"))))::integer AS "orders_count",
    (( SELECT "count"(*) AS "count"
           FROM "ticketing"."tickets" "t"
          WHERE ("t"."event_id" = "e"."id")))::integer AS "tickets_sold",
    (( SELECT "count"(DISTINCT "pi"."user_id") AS "count"
           FROM ("analytics"."post_impressions" "pi"
             JOIN "events"."event_posts" "ep" ON (("ep"."id" = "pi"."post_id")))
          WHERE ("ep"."event_id" = "e"."id")))::integer AS "unique_visitors",
    ( SELECT COALESCE("avg"("pv"."watch_percentage"), (0)::numeric) AS "coalesce"
           FROM "analytics"."post_views" "pv"
          WHERE (("pv"."event_id" = "e"."id") AND ("pv"."qualified" = true))) AS "avg_watch_pct",
    ( SELECT COALESCE((("count"(*))::numeric / (NULLIF("count"(DISTINCT "pi"."user_id"), 0))::numeric), (0)::numeric) AS "coalesce"
           FROM (("analytics"."post_impressions" "pi"
             JOIN "events"."event_posts" "ep" ON (("ep"."id" = "pi"."post_id")))
             JOIN "ticketing"."orders" "o" ON ((("o"."event_id" = "e"."id") AND ("o"."user_id" = "pi"."user_id"))))
          WHERE (("ep"."event_id" = "e"."id") AND ("o"."status" = 'paid'::"public"."order_status"))) AS "conversion_rate",
    COALESCE("eai"."engagement_score", (0)::numeric) AS "engagement_score",
    COALESCE("eai"."social_mentions", 0) AS "social_mentions",
    COALESCE("eai"."sentiment_score", (0)::numeric) AS "sentiment_score"
   FROM (("events"."events" "e"
     LEFT JOIN "analytics"."event_video_counters" "ev" ON (("ev"."event_id" = "e"."id")))
     LEFT JOIN "analytics"."event_audience_insights" "eai" ON (("eai"."event_id" = "e"."id")));


ALTER VIEW "public"."v_event_performance_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_event_performance_summary" IS 'Quick stats for event performance';



CREATE OR REPLACE VIEW "public"."v_event_recommended_sponsors" AS
 SELECT "m"."event_id",
    "m"."sponsor_id",
    "s"."name" AS "sponsor_name",
    "s"."logo_url",
    "sp"."industry",
    "sp"."annual_budget_cents",
    "m"."score",
    "m"."overlap_metrics",
    "m"."status",
    "m"."viewed_at",
    "m"."contacted_at"
   FROM (("sponsorship"."sponsorship_matches" "m"
     JOIN "sponsorship"."sponsors" "s" ON (("s"."id" = "m"."sponsor_id")))
     LEFT JOIN "sponsorship"."sponsor_profiles" "sp" ON (("sp"."sponsor_id" = "m"."sponsor_id")))
  WHERE ("m"."score" >= 0.55)
  ORDER BY "m"."event_id", "m"."score" DESC;


ALTER VIEW "public"."v_event_recommended_sponsors" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_event_recommended_sponsors" IS 'Sponsors recommended for events based on match scores';



CREATE OR REPLACE VIEW "public"."v_sponsor_marketplace" AS
 SELECT "s"."id" AS "sponsor_id",
    "s"."name" AS "sponsor_name",
    "s"."logo_url",
    "s"."website_url",
    "sp"."industry",
    "sp"."annual_budget_cents",
    "sp"."brand_objectives",
    "sp"."target_audience",
    "sp"."preferred_categories",
    "sp"."regions",
    "sp"."activation_preferences",
    "count"(DISTINCT "sm"."event_id") AS "matched_events_count",
    "avg"("sm"."score") AS "avg_match_score",
    "max"("sm"."score") AS "best_match_score",
    "count"(DISTINCT
        CASE
            WHEN ("sm"."score" > 0.8) THEN "sm"."event_id"
            ELSE NULL::"uuid"
        END) AS "high_quality_matches",
    "max"("sm"."updated_at") AS "last_match_update",
        CASE
            WHEN ("sp"."annual_budget_cents" >= 1000000) THEN 'enterprise'::"text"
            WHEN ("sp"."annual_budget_cents" >= 100000) THEN 'mid-market'::"text"
            WHEN ("sp"."annual_budget_cents" >= 10000) THEN 'small-business'::"text"
            ELSE 'unknown'::"text"
        END AS "budget_tier"
   FROM (("sponsorship"."sponsors" "s"
     JOIN "sponsorship"."sponsor_profiles" "sp" ON (("sp"."sponsor_id" = "s"."id")))
     LEFT JOIN "sponsorship"."sponsorship_matches" "sm" ON (("sm"."sponsor_id" = "s"."id")))
  GROUP BY "s"."id", "s"."name", "s"."logo_url", "s"."website_url", "sp"."industry", "sp"."annual_budget_cents", "sp"."brand_objectives", "sp"."target_audience", "sp"."preferred_categories", "sp"."regions", "sp"."activation_preferences";


ALTER VIEW "public"."v_sponsor_marketplace" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_sponsor_marketplace" IS 'Comprehensive marketplace view for sponsors with aggregated metrics';



CREATE OR REPLACE VIEW "public"."v_marketplace_analytics" AS
 SELECT 'sponsors'::"text" AS "entity_type",
    "count"(*) AS "total_count",
    "count"(*) FILTER (WHERE ("v_sponsor_marketplace"."budget_tier" = 'enterprise'::"text")) AS "enterprise_count",
    "count"(*) FILTER (WHERE ("v_sponsor_marketplace"."budget_tier" = 'mid-market'::"text")) AS "mid_market_count",
    "count"(*) FILTER (WHERE ("v_sponsor_marketplace"."budget_tier" = 'small-business'::"text")) AS "small_business_count",
    "avg"("v_sponsor_marketplace"."avg_match_score") AS "avg_match_score",
    "count"(*) FILTER (WHERE ("v_sponsor_marketplace"."high_quality_matches" > 0)) AS "active_sponsors"
   FROM "public"."v_sponsor_marketplace"
UNION ALL
 SELECT 'events'::"text" AS "entity_type",
    "count"(*) AS "total_count",
    "count"(*) FILTER (WHERE ("v_event_marketplace"."quality_tier" = 'premium'::"text")) AS "enterprise_count",
    "count"(*) FILTER (WHERE ("v_event_marketplace"."quality_tier" = 'high'::"text")) AS "mid_market_count",
    "count"(*) FILTER (WHERE ("v_event_marketplace"."quality_tier" = 'medium'::"text")) AS "small_business_count",
    "avg"("v_event_marketplace"."avg_sponsor_match_score") AS "avg_match_score",
    "count"(*) FILTER (WHERE ("v_event_marketplace"."high_quality_sponsors" > 0)) AS "active_sponsors"
   FROM "public"."v_event_marketplace";


ALTER VIEW "public"."v_marketplace_analytics" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_marketplace_analytics" IS 'Analytics dashboard for marketplace metrics';



CREATE OR REPLACE VIEW "public"."v_posts_ready" AS
 SELECT "p"."id",
    "p"."event_id",
    "p"."author_user_id",
    "p"."ticket_tier_id",
    "p"."text",
    "p"."media_urls",
    "p"."created_at",
    "p"."updated_at",
    "p"."like_count",
    "p"."comment_count",
    "p"."deleted_at",
    "p"."post_type",
    "p"."visibility",
    "p"."reply_count",
    "p"."share_count",
    "p"."edited_at",
    "p"."pinned",
    "p"."link_url",
    "p"."link_meta",
    "p"."moderation_state",
    "p"."language"
   FROM ("events"."event_posts" "p"
     LEFT JOIN LATERAL ( SELECT "bool_and"(("ma"."status" = 'ready'::"text")) AS "all_ready"
           FROM ("events"."post_media" "pm"
             JOIN "events"."media_assets" "ma" ON (("ma"."id" = "pm"."media_id")))
          WHERE ("pm"."post_id" = "p"."id")) "m" ON (true))
  WHERE ((("m"."all_ready" IS NULL) OR ("m"."all_ready" = true)) AND ("p"."deleted_at" IS NULL) AND ("p"."moderation_state" <> 'removed'::"text"));


ALTER VIEW "public"."v_posts_ready" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_semantic_event_recommendations" AS
 SELECT "s"."id" AS "sponsor_id",
    "s"."name" AS "sponsor_name",
    "sp"."industry",
    "sp"."annual_budget_cents",
    "e"."id" AS "event_id",
    "e"."title" AS "event_title",
    "e"."category",
    "e"."start_at",
    "sem"."match_score",
    "sem"."semantic_similarity",
    "sem"."objectives_alignment",
    "sem"."description_alignment",
    "eqs"."final_quality_score",
    "eqs"."quality_tier"
   FROM (((("sponsorship"."sponsors" "s"
     JOIN "sponsorship"."sponsor_profiles" "sp" ON (("sp"."sponsor_id" = "s"."id")))
     CROSS JOIN "events"."events" "e")
     CROSS JOIN LATERAL "public"."semantic_sponsor_event_match"("s"."id", "e"."id") "sem"("match_score", "semantic_similarity", "objectives_alignment", "description_alignment"))
     LEFT JOIN "public"."mv_event_quality_scores" "eqs" ON (("eqs"."event_id" = "e"."id")))
  WHERE (("sp"."objectives_embedding" IS NOT NULL) AND ("e"."description_embedding" IS NOT NULL) AND ("sem"."match_score" > 0.5))
  ORDER BY "s"."id", "sem"."match_score" DESC;


ALTER VIEW "public"."v_semantic_event_recommendations" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_semantic_event_recommendations" IS 'Semantic event recommendations for sponsors';



CREATE OR REPLACE VIEW "public"."v_semantic_sponsor_recommendations" AS
 SELECT "e"."id" AS "event_id",
    "e"."title" AS "event_title",
    "e"."category",
    "e"."start_at",
    "s"."id" AS "sponsor_id",
    "s"."name" AS "sponsor_name",
    "sp"."industry",
    "sp"."annual_budget_cents",
    "sem"."match_score",
    "sem"."semantic_similarity",
    "sem"."objectives_alignment",
    "sem"."description_alignment",
    "eqs"."final_quality_score",
    "eqs"."quality_tier"
   FROM (((("events"."events" "e"
     CROSS JOIN "sponsorship"."sponsors" "s")
     JOIN "sponsorship"."sponsor_profiles" "sp" ON (("sp"."sponsor_id" = "s"."id")))
     CROSS JOIN LATERAL "public"."semantic_sponsor_event_match"("s"."id", "e"."id") "sem"("match_score", "semantic_similarity", "objectives_alignment", "description_alignment"))
     LEFT JOIN "public"."mv_event_quality_scores" "eqs" ON (("eqs"."event_id" = "e"."id")))
  WHERE (("sp"."objectives_embedding" IS NOT NULL) AND ("e"."description_embedding" IS NOT NULL) AND ("sem"."match_score" > 0.5))
  ORDER BY "e"."id", "sem"."match_score" DESC;


ALTER VIEW "public"."v_semantic_sponsor_recommendations" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_semantic_sponsor_recommendations" IS 'Semantic sponsor recommendations for events';



CREATE OR REPLACE VIEW "public"."v_sponsor_recommendations" AS
 SELECT "sm"."event_id",
    "sm"."sponsor_id",
    "s"."name" AS "sponsor_name",
    "s"."logo_url" AS "sponsor_logo",
    "s"."industry",
    "sp"."company_size",
    "sp"."annual_budget_cents",
    "sm"."score",
    "sm"."overlap_metrics",
    "sm"."status",
    "sm"."viewed_at",
    "sm"."contacted_at",
    "sm"."updated_at",
    (("sm"."overlap_metrics" ->> 'budget_fit'::"text"))::numeric AS "budget_fit",
    ((("sm"."overlap_metrics" -> 'audience_overlap'::"text") ->> 'categories'::"text"))::numeric AS "category_match",
    ((("sm"."overlap_metrics" -> 'audience_overlap'::"text") ->> 'geo'::"text"))::numeric AS "geo_match",
    (("sm"."overlap_metrics" ->> 'engagement_quality'::"text"))::numeric AS "engagement_fit",
    (("sm"."overlap_metrics" ->> 'objectives_similarity'::"text"))::numeric AS "objectives_fit"
   FROM (("sponsorship"."sponsorship_matches" "sm"
     JOIN "sponsorship"."sponsors" "s" ON (("s"."id" = "sm"."sponsor_id")))
     JOIN "sponsorship"."sponsor_profiles" "sp" ON (("sp"."sponsor_id" = "sm"."sponsor_id")))
  WHERE (("sm"."status" = 'pending'::"text") AND ("sm"."score" > 0.5))
  ORDER BY "sm"."event_id", "sm"."score" DESC;


ALTER VIEW "public"."v_sponsor_recommendations" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_sponsor_recommendations" IS 'Top sponsor matches for event organizers with explainability metrics';



CREATE OR REPLACE VIEW "public"."v_sponsorship_package_cards" AS
 SELECT "p"."id" AS "package_id",
    "p"."event_id",
    "p"."title",
    "p"."tier",
    "p"."price_cents",
    "p"."inventory",
    "p"."sold",
    "p"."expected_reach",
    "p"."avg_engagement_score",
    "p"."package_type",
    "p"."quality_score",
    "p"."quality_updated_at",
    "eps"."metric_value" AS "snapshot_metric_value",
    "eps"."captured_at" AS "snapshot_captured_at",
    "vps"."total_views",
    "vps"."avg_dwell_ms",
    "vps"."tickets_sold",
    "vps"."avg_watch_pct",
    "round"((((COALESCE("p"."quality_score", 50))::numeric / 100.0) * (100)::numeric)) AS "quality_score_100"
   FROM (("sponsorship"."sponsorship_packages" "p"
     LEFT JOIN "analytics"."event_stat_snapshots" "eps" ON (("eps"."id" = "p"."stat_snapshot_id")))
     LEFT JOIN "public"."v_event_performance_summary" "vps" ON (("vps"."event_id" = "p"."event_id")));


ALTER VIEW "public"."v_sponsorship_package_cards" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_sponsorship_package_cards" IS 'Optimized single source for marketplace package cards with performance metrics';



CREATE OR REPLACE VIEW "public"."v_sponsor_recommended_packages" AS
 SELECT "m"."sponsor_id",
    "m"."event_id",
    "p"."id" AS "package_id",
    "p"."title",
    "p"."tier",
    "p"."price_cents",
    "m"."score",
    "m"."overlap_metrics",
    "c"."total_views",
    "c"."tickets_sold",
    "c"."quality_score_100",
    "c"."avg_engagement_score"
   FROM (("sponsorship"."sponsorship_matches" "m"
     JOIN "sponsorship"."sponsorship_packages" "p" ON ((("p"."event_id" = "m"."event_id") AND ("p"."is_active" = true) AND ("p"."visibility" = 'public'::"text"))))
     LEFT JOIN "public"."v_sponsorship_package_cards" "c" ON (("c"."package_id" = "p"."id")))
  WHERE ("m"."score" >= 0.55)
  ORDER BY "m"."sponsor_id", "m"."score" DESC;


ALTER VIEW "public"."v_sponsor_recommended_packages" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_sponsor_recommended_packages" IS 'Packages recommended for sponsors based on match scores';



CREATE OR REPLACE VIEW "public"."v_sponsorship_funnel" AS
 SELECT "e"."id" AS "event_id",
    "e"."title" AS "event_title",
    "e"."start_at",
    "count"("sm"."id") FILTER (WHERE ("sm"."status" = 'pending'::"text")) AS "matches_pending",
    "count"("sm"."id") FILTER (WHERE ("sm"."status" = 'suggested'::"text")) AS "matches_suggested",
    "count"("sm"."id") FILTER (WHERE ("sm"."viewed_at" IS NOT NULL)) AS "matches_viewed",
    "count"("sm"."id") FILTER (WHERE ("sm"."contacted_at" IS NOT NULL)) AS "matches_contacted",
    "count"("sm"."id") FILTER (WHERE ("sm"."status" = 'accepted'::"text")) AS "matches_accepted",
    "count"("sm"."id") FILTER (WHERE ("sm"."status" = 'rejected'::"text")) AS "matches_rejected",
    "avg"("sm"."score") FILTER (WHERE ("sm"."status" = 'accepted'::"text")) AS "avg_accepted_score",
    "avg"("sm"."score") FILTER (WHERE ("sm"."status" = 'rejected'::"text")) AS "avg_rejected_score"
   FROM ("events"."events" "e"
     LEFT JOIN "sponsorship"."sponsorship_matches" "sm" ON (("sm"."event_id" = "e"."id")))
  GROUP BY "e"."id", "e"."title", "e"."start_at";


ALTER VIEW "public"."v_sponsorship_funnel" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_sponsorship_funnel" IS 'Sponsorship funnel metrics for conversion analysis';



CREATE TABLE IF NOT EXISTS "ref"."countries" (
    "code" character(2) NOT NULL,
    "name" "text" NOT NULL,
    "phone_prefix" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ref"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ref"."currencies" (
    "code" character(3) NOT NULL,
    "name" "text" NOT NULL,
    "symbol" "text",
    "decimal_places" integer DEFAULT 2 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ref"."currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ref"."event_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ref"."event_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ref"."industries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ref"."industries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ref"."timezones" (
    "name" "text" NOT NULL,
    "offset_minutes" integer NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ref"."timezones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sponsorship"."deliverable_proofs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "asset_url" "text" NOT NULL,
    "metrics" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "submitted_by" "uuid",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "approved_at" timestamp with time zone,
    "rejected_reason" "text",
    CONSTRAINT "deliverable_proofs_approval_consistency" CHECK (((("approved_at" IS NOT NULL) AND ("rejected_reason" IS NULL)) OR ("approved_at" IS NULL)))
);


ALTER TABLE "sponsorship"."deliverable_proofs" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."deliverable_proofs" IS 'Proof-of-performance artifacts with metrics for deliverables';



COMMENT ON CONSTRAINT "deliverable_proofs_approval_consistency" ON "sponsorship"."deliverable_proofs" IS 'Ensures approved proofs have no rejection reason';



CREATE TABLE IF NOT EXISTS "sponsorship"."deliverables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "spec" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "due_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "evidence_required" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_id" "uuid",
    "package_id" "uuid",
    "package_variant_id" "uuid",
    CONSTRAINT "deliverables_spec_not_empty" CHECK ((("spec" IS NOT NULL) AND ("spec" <> '{}'::"jsonb"))),
    CONSTRAINT "deliverables_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'submitted'::"text", 'needs_changes'::"text", 'approved'::"text", 'waived'::"text"])))
);


ALTER TABLE "sponsorship"."deliverables" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."deliverables" IS 'First-class deliverables tracking for sponsor activations';



COMMENT ON COLUMN "sponsorship"."deliverables"."order_id" IS 'Links deliverable to the specific order it was part of';



COMMENT ON COLUMN "sponsorship"."deliverables"."package_id" IS 'Links deliverable to the package it belongs to';



CREATE TABLE IF NOT EXISTS "sponsorship"."event_sponsorships" (
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "tier" "text" NOT NULL,
    "amount_cents" integer DEFAULT 0 NOT NULL,
    "benefits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activation_status" "text" DEFAULT 'draft'::"text",
    "deliverables" "jsonb" DEFAULT '{}'::"jsonb",
    "roi_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "deliverables_due_date" timestamp with time zone,
    "deliverables_submitted_at" timestamp with time zone,
    "organizer_approved_at" timestamp with time zone,
    "evaluation_notes" "text",
    "contract_id" "uuid",
    "activation_state" "text",
    "sla_id" "uuid",
    CONSTRAINT "event_sponsorships_activation_state_check" CHECK (("activation_state" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'complete'::"text"]))),
    CONSTRAINT "event_sponsorships_amount_positive" CHECK (("amount_cents" >= 0))
);


ALTER TABLE "sponsorship"."event_sponsorships" OWNER TO "postgres";


COMMENT ON COLUMN "sponsorship"."event_sponsorships"."deliverables" IS 'JSONB: list of required deliverables with status tracking';



COMMENT ON COLUMN "sponsorship"."event_sponsorships"."roi_summary" IS 'JSONB: post-event ROI metrics and analysis';



CREATE TABLE IF NOT EXISTS "sponsorship"."fit_recalc_queue" (
    "id" bigint NOT NULL,
    "event_id" "uuid",
    "sponsor_id" "uuid",
    "reason" "text" NOT NULL,
    "queued_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone
);


ALTER TABLE "sponsorship"."fit_recalc_queue" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."fit_recalc_queue" IS 'Queue for incremental recalculation of match scores';



CREATE SEQUENCE IF NOT EXISTS "sponsorship"."fit_recalc_queue_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "sponsorship"."fit_recalc_queue_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "sponsorship"."fit_recalc_queue_id_seq" OWNED BY "sponsorship"."fit_recalc_queue"."id";



CREATE TABLE IF NOT EXISTS "sponsorship"."match_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_features_version_positive" CHECK (("version" > 0))
);


ALTER TABLE "sponsorship"."match_features" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."match_features" IS 'Feature store for ML matching signals and model versioning';



CREATE TABLE IF NOT EXISTS "sponsorship"."match_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "reason_codes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "match_feedback_label_check" CHECK (("label" = ANY (ARRAY['good_fit'::"text", 'bad_fit'::"text", 'later'::"text"])))
);


ALTER TABLE "sponsorship"."match_feedback" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."match_feedback" IS 'Human feedback for improving match algorithms with reason codes';



CREATE TABLE IF NOT EXISTS "sponsorship"."package_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "org_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "default_price_cents" integer NOT NULL,
    "default_benefits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "visibility" "text" DEFAULT 'private'::"text" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "package_templates_default_price_cents_check" CHECK (("default_price_cents" >= 0)),
    CONSTRAINT "package_templates_visibility_check" CHECK (("visibility" = ANY (ARRAY['private'::"text", 'org'::"text", 'public'::"text"])))
);


ALTER TABLE "sponsorship"."package_templates" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."package_templates" IS 'Reusable package blueprints that organizers can instantiate';



CREATE TABLE IF NOT EXISTS "sponsorship"."package_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "package_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "price_cents" integer NOT NULL,
    "benefits" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "inventory" integer DEFAULT 1 NOT NULL,
    "stat_snapshot_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "package_variants_inventory_check" CHECK (("inventory" >= 0)),
    CONSTRAINT "package_variants_price_cents_check" CHECK (("price_cents" >= 0))
);


ALTER TABLE "sponsorship"."package_variants" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."package_variants" IS 'Package variants for A/B testing and different offer configurations';



CREATE TABLE IF NOT EXISTS "sponsorship"."proposal_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_user_id" "uuid" NOT NULL,
    "body" "text",
    "offer" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "attachments" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_messages_offer_not_empty" CHECK ((("offer" IS NOT NULL) AND ("offer" <> '{}'::"jsonb"))),
    CONSTRAINT "proposal_messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['organizer'::"text", 'sponsor'::"text"])))
);


ALTER TABLE "sponsorship"."proposal_messages" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."proposal_messages" IS 'Individual messages and offers within a proposal thread';



CREATE TABLE IF NOT EXISTS "sponsorship"."proposal_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "proposal_threads_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'counter'::"text", 'accepted'::"text", 'rejected'::"text", 'expired'::"text"]))),
    CONSTRAINT "proposal_threads_terminal_states" CHECK ((("status" <> ALL (ARRAY['accepted'::"text", 'rejected'::"text", 'expired'::"text"])) OR ("updated_at" >= "created_at")))
);


ALTER TABLE "sponsorship"."proposal_threads" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."proposal_threads" IS 'Negotiation threads between organizers and sponsors';



CREATE TABLE IF NOT EXISTS "sponsorship"."sponsor_members" (
    "sponsor_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."sponsor_role" DEFAULT 'viewer'::"public"."sponsor_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sponsorship"."sponsor_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "sponsorship"."sponsor_public_profiles" (
    "sponsor_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "headline" "text",
    "about" "text",
    "brand_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "badges" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_verified" boolean DEFAULT false NOT NULL,
    "social_links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sponsorship"."sponsor_public_profiles" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."sponsor_public_profiles" IS 'Public-facing sponsor profiles for discovery and trust building';



CREATE TABLE IF NOT EXISTS "sponsorship"."sponsorship_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "application_fee_cents" integer DEFAULT 0 NOT NULL,
    "stripe_transfer_id" "text",
    "stripe_payout_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "failure_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "sponsorship_payouts_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "sponsorship_payouts_amount_positive" CHECK (("amount_cents" > 0)),
    CONSTRAINT "sponsorship_payouts_application_fee_cents_check" CHECK (("application_fee_cents" >= 0)),
    CONSTRAINT "sponsorship_payouts_fee_valid" CHECK ((("application_fee_cents" >= 0) AND ("application_fee_cents" < "amount_cents"))),
    CONSTRAINT "sponsorship_payouts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "sponsorship"."sponsorship_payouts" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."sponsorship_payouts" IS 'Tracks individual payout transactions to organizers';



CREATE TABLE IF NOT EXISTS "sponsorship"."sponsorship_slas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "sponsor_id" "uuid" NOT NULL,
    "deliverable_id" "uuid",
    "metric" "text" NOT NULL,
    "target" numeric NOT NULL,
    "breach_policy" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "sponsorship"."sponsorship_slas" OWNER TO "postgres";


COMMENT ON TABLE "sponsorship"."sponsorship_slas" IS 'Service level agreements with breach policies and remedies';



CREATE TABLE IF NOT EXISTS "ticketing"."checkout_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "user_id" "uuid",
    "event_id" "uuid",
    "status" "text" DEFAULT 'pending'::"text",
    "hold_ids" "uuid"[] DEFAULT ARRAY[]::"uuid"[],
    "pricing_snapshot" "jsonb",
    "contact_snapshot" "jsonb",
    "verification_state" "jsonb",
    "express_methods" "jsonb",
    "cart_snapshot" "jsonb",
    "stripe_session_id" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "ticketing"."checkout_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."guest_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "tier_id" "uuid",
    "max_uses" integer DEFAULT 1,
    "used_count" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "ticketing"."guest_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."guest_otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "method" "text" NOT NULL,
    "contact" "text" NOT NULL,
    "otp_hash" "text" NOT NULL,
    "event_id" "uuid",
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ticketing"."guest_otp_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."guest_ticket_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token_hash" "text" NOT NULL,
    "method" "text" NOT NULL,
    "contact" "text" NOT NULL,
    "scope" "jsonb" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ticketing"."guest_ticket_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."inventory_operations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "operation_type" "text" NOT NULL,
    "quantity" integer NOT NULL,
    "session_id" "text",
    "order_id" "uuid",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "inventory_operations_operation_type_check" CHECK (("operation_type" = ANY (ARRAY['reserve'::"text", 'release'::"text", 'purchase'::"text", 'refund'::"text"])))
);


ALTER TABLE "ticketing"."inventory_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "amount_cents" integer NOT NULL,
    "reason" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "ticketing"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."scan_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "ticket_id" "uuid",
    "scanner_user_id" "uuid",
    "result" "text" NOT NULL,
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "ticketing"."scan_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ticketing"."ticket_holds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier_id" "uuid" NOT NULL,
    "quantity" integer NOT NULL,
    "session_id" "text",
    "user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "ticket_holds_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "ticket_holds_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'consumed'::"text", 'expired'::"text", 'released'::"text"])))
);


ALTER TABLE "ticketing"."ticket_holds" OWNER TO "postgres";


ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_default" DEFAULT;



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202404" FOR VALUES FROM ('2024-04-01 00:00:00+00') TO ('2024-05-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202405" FOR VALUES FROM ('2024-05-01 00:00:00+00') TO ('2024-06-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202406" FOR VALUES FROM ('2024-06-01 00:00:00+00') TO ('2024-07-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202407" FOR VALUES FROM ('2024-07-01 00:00:00+00') TO ('2024-08-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202408" FOR VALUES FROM ('2024-08-01 00:00:00+00') TO ('2024-09-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202409" FOR VALUES FROM ('2024-09-01 00:00:00+00') TO ('2024-10-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202410" FOR VALUES FROM ('2024-10-01 00:00:00+00') TO ('2024-11-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202411" FOR VALUES FROM ('2024-11-01 00:00:00+00') TO ('2024-12-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202412" FOR VALUES FROM ('2024-12-01 00:00:00+00') TO ('2025-01-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202501" FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202502" FOR VALUES FROM ('2025-02-01 00:00:00+00') TO ('2025-03-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202503" FOR VALUES FROM ('2025-03-01 00:00:00+00') TO ('2025-04-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202504" FOR VALUES FROM ('2025-04-01 00:00:00+00') TO ('2025-05-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202505" FOR VALUES FROM ('2025-05-01 00:00:00+00') TO ('2025-06-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202506" FOR VALUES FROM ('2025-06-01 00:00:00+00') TO ('2025-07-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202507" FOR VALUES FROM ('2025-07-01 00:00:00+00') TO ('2025-08-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202508" FOR VALUES FROM ('2025-08-01 00:00:00+00') TO ('2025-09-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202509" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202510" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."event_impressions_p" ATTACH PARTITION "analytics"."event_impressions_p_202511" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_default" DEFAULT;



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202404" FOR VALUES FROM ('2024-04-01 00:00:00+00') TO ('2024-05-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202405" FOR VALUES FROM ('2024-05-01 00:00:00+00') TO ('2024-06-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202406" FOR VALUES FROM ('2024-06-01 00:00:00+00') TO ('2024-07-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202407" FOR VALUES FROM ('2024-07-01 00:00:00+00') TO ('2024-08-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202408" FOR VALUES FROM ('2024-08-01 00:00:00+00') TO ('2024-09-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202409" FOR VALUES FROM ('2024-09-01 00:00:00+00') TO ('2024-10-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202410" FOR VALUES FROM ('2024-10-01 00:00:00+00') TO ('2024-11-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202411" FOR VALUES FROM ('2024-11-01 00:00:00+00') TO ('2024-12-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202412" FOR VALUES FROM ('2024-12-01 00:00:00+00') TO ('2025-01-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202501" FOR VALUES FROM ('2025-01-01 00:00:00+00') TO ('2025-02-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202502" FOR VALUES FROM ('2025-02-01 00:00:00+00') TO ('2025-03-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202503" FOR VALUES FROM ('2025-03-01 00:00:00+00') TO ('2025-04-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202504" FOR VALUES FROM ('2025-04-01 00:00:00+00') TO ('2025-05-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202505" FOR VALUES FROM ('2025-05-01 00:00:00+00') TO ('2025-06-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202506" FOR VALUES FROM ('2025-06-01 00:00:00+00') TO ('2025-07-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202507" FOR VALUES FROM ('2025-07-01 00:00:00+00') TO ('2025-08-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202508" FOR VALUES FROM ('2025-08-01 00:00:00+00') TO ('2025-09-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202509" FOR VALUES FROM ('2025-09-01 00:00:00+00') TO ('2025-10-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202510" FOR VALUES FROM ('2025-10-01 00:00:00+00') TO ('2025-11-01 00:00:00+00');



ALTER TABLE ONLY "analytics"."ticket_analytics_p" ATTACH PARTITION "analytics"."ticket_analytics_p_202511" FOR VALUES FROM ('2025-11-01 00:00:00+00') TO ('2025-12-01 00:00:00+00');



ALTER TABLE ONLY "public"."mv_refresh_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."mv_refresh_log_id_seq"'::"regclass");



ALTER TABLE ONLY "sponsorship"."fit_recalc_queue" ALTER COLUMN "id" SET DEFAULT "nextval"('"sponsorship"."fit_recalc_queue_id_seq"'::"regclass");



ALTER TABLE ONLY "analytics"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."audience_consents"
    ADD CONSTRAINT "audience_consents_event_id_segment_key_key" UNIQUE ("event_id", "segment_key");



ALTER TABLE ONLY "analytics"."audience_consents"
    ADD CONSTRAINT "audience_consents_event_segment_scope_unique" UNIQUE ("event_id", "segment_key", "scope");



COMMENT ON CONSTRAINT "audience_consents_event_segment_scope_unique" ON "analytics"."audience_consents" IS 'Ensures one consent record per event-segment-scope combination';



ALTER TABLE ONLY "analytics"."audience_consents"
    ADD CONSTRAINT "audience_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."event_audience_insights"
    ADD CONSTRAINT "event_audience_insights_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "analytics"."event_impressions_p"
    ADD CONSTRAINT "event_impressions_p_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_default"
    ADD CONSTRAINT "event_impressions_default_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202404"
    ADD CONSTRAINT "event_impressions_p_202404_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202405"
    ADD CONSTRAINT "event_impressions_p_202405_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202406"
    ADD CONSTRAINT "event_impressions_p_202406_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202407"
    ADD CONSTRAINT "event_impressions_p_202407_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202408"
    ADD CONSTRAINT "event_impressions_p_202408_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202409"
    ADD CONSTRAINT "event_impressions_p_202409_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202410"
    ADD CONSTRAINT "event_impressions_p_202410_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202411"
    ADD CONSTRAINT "event_impressions_p_202411_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202412"
    ADD CONSTRAINT "event_impressions_p_202412_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202501"
    ADD CONSTRAINT "event_impressions_p_202501_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202502"
    ADD CONSTRAINT "event_impressions_p_202502_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202503"
    ADD CONSTRAINT "event_impressions_p_202503_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202504"
    ADD CONSTRAINT "event_impressions_p_202504_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202505"
    ADD CONSTRAINT "event_impressions_p_202505_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202506"
    ADD CONSTRAINT "event_impressions_p_202506_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202507"
    ADD CONSTRAINT "event_impressions_p_202507_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202508"
    ADD CONSTRAINT "event_impressions_p_202508_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202509"
    ADD CONSTRAINT "event_impressions_p_202509_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202510"
    ADD CONSTRAINT "event_impressions_p_202510_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions_p_202511"
    ADD CONSTRAINT "event_impressions_p_202511_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."event_impressions"
    ADD CONSTRAINT "event_impressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."event_stat_snapshots"
    ADD CONSTRAINT "event_stat_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."event_video_counters"
    ADD CONSTRAINT "event_video_counters_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "analytics"."negative_feedback"
    ADD CONSTRAINT "negative_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."negative_feedback"
    ADD CONSTRAINT "negative_feedback_user_id_target_type_target_id_key" UNIQUE ("user_id", "target_type", "target_id");



ALTER TABLE ONLY "analytics"."post_clicks"
    ADD CONSTRAINT "post_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."post_impressions"
    ADD CONSTRAINT "post_impressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."post_video_counters"
    ADD CONSTRAINT "post_video_counters_pkey" PRIMARY KEY ("post_id");



ALTER TABLE ONLY "analytics"."post_views"
    ADD CONSTRAINT "post_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."share_links"
    ADD CONSTRAINT "share_links_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "analytics"."ticket_analytics_p"
    ADD CONSTRAINT "ticket_analytics_p_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_default"
    ADD CONSTRAINT "ticket_analytics_default_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202404"
    ADD CONSTRAINT "ticket_analytics_p_202404_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202405"
    ADD CONSTRAINT "ticket_analytics_p_202405_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202406"
    ADD CONSTRAINT "ticket_analytics_p_202406_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202407"
    ADD CONSTRAINT "ticket_analytics_p_202407_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202408"
    ADD CONSTRAINT "ticket_analytics_p_202408_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202409"
    ADD CONSTRAINT "ticket_analytics_p_202409_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202410"
    ADD CONSTRAINT "ticket_analytics_p_202410_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202411"
    ADD CONSTRAINT "ticket_analytics_p_202411_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202412"
    ADD CONSTRAINT "ticket_analytics_p_202412_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202501"
    ADD CONSTRAINT "ticket_analytics_p_202501_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202502"
    ADD CONSTRAINT "ticket_analytics_p_202502_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202503"
    ADD CONSTRAINT "ticket_analytics_p_202503_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202504"
    ADD CONSTRAINT "ticket_analytics_p_202504_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202505"
    ADD CONSTRAINT "ticket_analytics_p_202505_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202506"
    ADD CONSTRAINT "ticket_analytics_p_202506_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202507"
    ADD CONSTRAINT "ticket_analytics_p_202507_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202508"
    ADD CONSTRAINT "ticket_analytics_p_202508_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202509"
    ADD CONSTRAINT "ticket_analytics_p_202509_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202510"
    ADD CONSTRAINT "ticket_analytics_p_202510_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics_p_202511"
    ADD CONSTRAINT "ticket_analytics_p_202511_pkey" PRIMARY KEY ("id", "created_at");



ALTER TABLE ONLY "analytics"."ticket_analytics"
    ADD CONSTRAINT "ticket_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."user_event_interactions"
    ADD CONSTRAINT "user_event_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."ad_clicks"
    ADD CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."ad_creatives"
    ADD CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."ad_spend_ledger"
    ADD CONSTRAINT "ad_spend_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."campaign_placements"
    ADD CONSTRAINT "campaign_placements_pkey" PRIMARY KEY ("campaign_id", "placement");



ALTER TABLE ONLY "campaigns"."campaign_targeting"
    ADD CONSTRAINT "campaign_targeting_pkey" PRIMARY KEY ("campaign_id");



ALTER TABLE ONLY "campaigns"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."credit_packages"
    ADD CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "campaigns"."promos"
    ADD CONSTRAINT "promos_code_key" UNIQUE ("code");



ALTER TABLE ONLY "campaigns"."promos"
    ADD CONSTRAINT "promos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."cultural_guides"
    ADD CONSTRAINT "cultural_guides_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "events"."event_comment_reactions"
    ADD CONSTRAINT "event_comment_reactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."event_comments"
    ADD CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."event_invites"
    ADD CONSTRAINT "event_invites_pkey" PRIMARY KEY ("event_id", "email");



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "event_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."event_reactions"
    ADD CONSTRAINT "event_reactions_pkey" PRIMARY KEY ("post_id", "user_id", "kind");



ALTER TABLE ONLY "events"."event_reactions"
    ADD CONSTRAINT "event_reactions_unique" UNIQUE ("post_id", "user_id", "kind");



ALTER TABLE ONLY "events"."event_roles"
    ADD CONSTRAINT "event_roles_event_id_user_id_role_key" UNIQUE ("event_id", "user_id", "role");



ALTER TABLE ONLY "events"."event_roles"
    ADD CONSTRAINT "event_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."event_roles"
    ADD CONSTRAINT "event_roles_unique" UNIQUE ("event_id", "user_id", "role");



ALTER TABLE ONLY "events"."event_scanners"
    ADD CONSTRAINT "event_scanners_pkey" PRIMARY KEY ("event_id", "user_id");



ALTER TABLE ONLY "events"."event_series"
    ADD CONSTRAINT "event_series_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."event_share_assets"
    ADD CONSTRAINT "event_share_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "events"."hashtags"
    ADD CONSTRAINT "hashtags_pkey" PRIMARY KEY ("tag");



ALTER TABLE ONLY "events"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."post_hashtags"
    ADD CONSTRAINT "post_hashtags_pkey" PRIMARY KEY ("post_id", "tag");



ALTER TABLE ONLY "events"."post_media"
    ADD CONSTRAINT "post_media_pkey" PRIMARY KEY ("post_id", "media_id");



ALTER TABLE ONLY "events"."post_mentions"
    ADD CONSTRAINT "post_mentions_pkey" PRIMARY KEY ("post_id", "mentioned_user_id");



ALTER TABLE ONLY "events"."role_invites"
    ADD CONSTRAINT "role_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "events"."role_invites"
    ADD CONSTRAINT "role_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "messaging"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id", "participant_type", "participant_user_id", "participant_org_id");



ALTER TABLE ONLY "messaging"."direct_conversations"
    ADD CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "messaging"."direct_messages"
    ADD CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "messaging"."message_job_recipients"
    ADD CONSTRAINT "message_job_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "messaging"."message_jobs"
    ADD CONSTRAINT "message_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "messaging"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "messaging"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ml"."user_embeddings"
    ADD CONSTRAINT "user_embeddings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "organizations"."org_contact_import_entries"
    ADD CONSTRAINT "org_contact_import_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."org_contact_imports"
    ADD CONSTRAINT "org_contact_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."org_invitations"
    ADD CONSTRAINT "org_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."org_invitations"
    ADD CONSTRAINT "org_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "organizations"."org_memberships"
    ADD CONSTRAINT "org_memberships_pkey" PRIMARY KEY ("org_id", "user_id");



ALTER TABLE ONLY "organizations"."org_wallet_transactions"
    ADD CONSTRAINT "org_wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."org_wallet_transactions"
    ADD CONSTRAINT "org_wallet_txn_stripe_event_unique" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "organizations"."org_wallets"
    ADD CONSTRAINT "org_wallets_org_id_key" UNIQUE ("org_id");



ALTER TABLE ONLY "organizations"."org_wallets"
    ADD CONSTRAINT "org_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."organizations"
    ADD CONSTRAINT "organizations_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "organizations"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."payout_accounts"
    ADD CONSTRAINT "payout_accounts_context_type_context_id_key" UNIQUE ("context_type", "context_id");



ALTER TABLE ONLY "organizations"."payout_accounts"
    ADD CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."payout_accounts"
    ADD CONSTRAINT "payout_accounts_stripe_connect_id_key" UNIQUE ("stripe_connect_id");



ALTER TABLE ONLY "organizations"."payout_configurations"
    ADD CONSTRAINT "payout_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "organizations"."payout_configurations"
    ADD CONSTRAINT "payout_configurations_unique_org" UNIQUE ("organization_id");



ALTER TABLE ONLY "payments"."credit_lots"
    ADD CONSTRAINT "credit_lots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "payments"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "payments"."payout_queue"
    ADD CONSTRAINT "payout_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "payments"."wallet_transactions"
    ADD CONSTRAINT "uq_wallet_txn_idem" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "payments"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "payments"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "payments"."wallets"
    ADD CONSTRAINT "wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "payments"."wallets"
    ADD CONSTRAINT "wallets_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "payments"."wallets"
    ADD CONSTRAINT "wallets_user_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."circuit_breaker_state"
    ADD CONSTRAINT "circuit_breaker_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dead_letter_webhooks"
    ADD CONSTRAINT "dead_letter_webhooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."kv_store_d42c04e8"
    ADD CONSTRAINT "kv_store_d42c04e8_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."mv_refresh_log"
    ADD CONSTRAINT "mv_refresh_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outbox"
    ADD CONSTRAINT "outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pgbench_tiers"
    ADD CONSTRAINT "pgbench_tiers_pkey" PRIMARY KEY ("pos");



ALTER TABLE ONLY "public"."rate_limits"
    ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("user_id", "bucket", "minute");



ALTER TABLE ONLY "public"."request_logs"
    ADD CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ref"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "ref"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "ref"."event_categories"
    ADD CONSTRAINT "event_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "ref"."event_categories"
    ADD CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ref"."industries"
    ADD CONSTRAINT "industries_name_key" UNIQUE ("name");



ALTER TABLE ONLY "ref"."industries"
    ADD CONSTRAINT "industries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ref"."timezones"
    ADD CONSTRAINT "timezones_pkey" PRIMARY KEY ("name");



ALTER TABLE ONLY "sponsorship"."deliverable_proofs"
    ADD CONSTRAINT "deliverable_proofs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."event_sponsorships"
    ADD CONSTRAINT "event_sponsorships_pkey" PRIMARY KEY ("event_id", "sponsor_id", "tier");



ALTER TABLE ONLY "sponsorship"."fit_recalc_queue"
    ADD CONSTRAINT "fit_recalc_queue_event_id_sponsor_id_key" UNIQUE ("event_id", "sponsor_id");



ALTER TABLE ONLY "sponsorship"."fit_recalc_queue"
    ADD CONSTRAINT "fit_recalc_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."match_features"
    ADD CONSTRAINT "match_features_event_id_sponsor_id_version_key" UNIQUE ("event_id", "sponsor_id", "version");



ALTER TABLE ONLY "sponsorship"."match_features"
    ADD CONSTRAINT "match_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."match_feedback"
    ADD CONSTRAINT "match_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."package_templates"
    ADD CONSTRAINT "package_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."package_variants"
    ADD CONSTRAINT "package_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."package_variants"
    ADD CONSTRAINT "package_variants_unique_label_per_package" UNIQUE ("package_id", "label");



COMMENT ON CONSTRAINT "package_variants_unique_label_per_package" ON "sponsorship"."package_variants" IS 'Ensures variant labels are unique within a package';



ALTER TABLE ONLY "sponsorship"."proposal_messages"
    ADD CONSTRAINT "proposal_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."proposal_threads"
    ADD CONSTRAINT "proposal_threads_event_id_sponsor_id_created_at_key" UNIQUE ("event_id", "sponsor_id", "created_at");



ALTER TABLE ONLY "sponsorship"."proposal_threads"
    ADD CONSTRAINT "proposal_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsor_members"
    ADD CONSTRAINT "sponsor_members_pkey" PRIMARY KEY ("sponsor_id", "user_id");



ALTER TABLE ONLY "sponsorship"."sponsor_profiles"
    ADD CONSTRAINT "sponsor_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsor_profiles"
    ADD CONSTRAINT "sponsor_profiles_sponsor_id_key" UNIQUE ("sponsor_id");



ALTER TABLE ONLY "sponsorship"."sponsor_public_profiles"
    ADD CONSTRAINT "sponsor_public_profiles_pkey" PRIMARY KEY ("sponsor_id");



ALTER TABLE ONLY "sponsorship"."sponsor_public_profiles"
    ADD CONSTRAINT "sponsor_public_profiles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "sponsorship"."sponsors"
    ADD CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_matches"
    ADD CONSTRAINT "sponsorship_matches_event_id_sponsor_id_key" UNIQUE ("event_id", "sponsor_id");



ALTER TABLE ONLY "sponsorship"."sponsorship_matches"
    ADD CONSTRAINT "sponsorship_matches_event_sponsor_unique" UNIQUE ("event_id", "sponsor_id");



COMMENT ON CONSTRAINT "sponsorship_matches_event_sponsor_unique" ON "sponsorship"."sponsorship_matches" IS 'Ensures one match score per event-sponsor pair for idempotency';



ALTER TABLE ONLY "sponsorship"."sponsorship_matches"
    ADD CONSTRAINT "sponsorship_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_packages"
    ADD CONSTRAINT "sponsorship_packages_event_tier_unique" UNIQUE ("event_id", "tier");



COMMENT ON CONSTRAINT "sponsorship_packages_event_tier_unique" ON "sponsorship"."sponsorship_packages" IS 'Ensures one package per tier per event to prevent duplicates';



ALTER TABLE ONLY "sponsorship"."sponsorship_packages"
    ADD CONSTRAINT "sponsorship_packages_event_tier_version_unique" UNIQUE ("event_id", "tier", "version");



COMMENT ON CONSTRAINT "sponsorship_packages_event_tier_version_unique" ON "sponsorship"."sponsorship_packages" IS 'Ensures unique tier and version combination per event for safe versioning';



ALTER TABLE ONLY "sponsorship"."sponsorship_packages"
    ADD CONSTRAINT "sponsorship_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_payouts"
    ADD CONSTRAINT "sponsorship_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_slas"
    ADD CONSTRAINT "sponsorship_slas_metric_unique" UNIQUE ("event_id", "sponsor_id", "metric");



COMMENT ON CONSTRAINT "sponsorship_slas_metric_unique" ON "sponsorship"."sponsorship_slas" IS 'Prevents duplicate SLA metrics for the same event-sponsor pair';



ALTER TABLE ONLY "sponsorship"."sponsorship_slas"
    ADD CONSTRAINT "sponsorship_slas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."guest_codes"
    ADD CONSTRAINT "guest_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "ticketing"."guest_codes"
    ADD CONSTRAINT "guest_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."guest_otp_codes"
    ADD CONSTRAINT "guest_otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."guest_ticket_sessions"
    ADD CONSTRAINT "guest_ticket_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."guest_ticket_sessions"
    ADD CONSTRAINT "guest_ticket_sessions_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "ticketing"."inventory_operations"
    ADD CONSTRAINT "inventory_operations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."orders"
    ADD CONSTRAINT "orders_stripe_payment_intent_id_key" UNIQUE ("stripe_payment_intent_id");



ALTER TABLE ONLY "ticketing"."orders"
    ADD CONSTRAINT "orders_stripe_session_id_key" UNIQUE ("stripe_session_id");



ALTER TABLE ONLY "ticketing"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."scan_logs"
    ADD CONSTRAINT "scan_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."ticket_holds"
    ADD CONSTRAINT "ticket_holds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."ticket_tiers"
    ADD CONSTRAINT "ticket_tiers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "tickets_qr_code_key" UNIQUE ("qr_code");



ALTER TABLE ONLY "users"."follows"
    ADD CONSTRAINT "follows_actor_unique" UNIQUE ("follower_type", "follower_user_id", "follower_org_id", "target_type", "target_id");



ALTER TABLE ONLY "users"."follows"
    ADD CONSTRAINT "follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "users"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "analytics_events_created_at_idx" ON "analytics"."analytics_events" USING "btree" ("created_at" DESC);



CREATE INDEX "analytics_events_event_id_idx" ON "analytics"."analytics_events" USING "btree" ("event_id");



CREATE INDEX "analytics_events_event_type_idx" ON "analytics"."analytics_events" USING "btree" ("event_type");



CREATE INDEX "analytics_events_user_id_idx" ON "analytics"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "brin_event_impressions_created" ON "analytics"."event_impressions" USING "brin" ("created_at");



CREATE INDEX "brin_post_impressions_created" ON "analytics"."post_impressions" USING "brin" ("created_at");



CREATE INDEX "idx_event_impressions_p_event_id_created_at" ON ONLY "analytics"."event_impressions_p" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_default_event_id_created_at_idx" ON "analytics"."event_impressions_default" USING "btree" ("event_id", "created_at");



CREATE INDEX "idx_event_impressions_p_user_id_created_at" ON ONLY "analytics"."event_impressions_p" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_default_user_id_created_at_idx" ON "analytics"."event_impressions_default" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202404_event_id_created_at_idx" ON "analytics"."event_impressions_p_202404" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202404_user_id_created_at_idx" ON "analytics"."event_impressions_p_202404" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202405_event_id_created_at_idx" ON "analytics"."event_impressions_p_202405" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202405_user_id_created_at_idx" ON "analytics"."event_impressions_p_202405" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202406_event_id_created_at_idx" ON "analytics"."event_impressions_p_202406" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202406_user_id_created_at_idx" ON "analytics"."event_impressions_p_202406" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202407_event_id_created_at_idx" ON "analytics"."event_impressions_p_202407" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202407_user_id_created_at_idx" ON "analytics"."event_impressions_p_202407" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202408_event_id_created_at_idx" ON "analytics"."event_impressions_p_202408" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202408_user_id_created_at_idx" ON "analytics"."event_impressions_p_202408" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202409_event_id_created_at_idx" ON "analytics"."event_impressions_p_202409" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202409_user_id_created_at_idx" ON "analytics"."event_impressions_p_202409" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202410_event_id_created_at_idx" ON "analytics"."event_impressions_p_202410" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202410_user_id_created_at_idx" ON "analytics"."event_impressions_p_202410" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202411_event_id_created_at_idx" ON "analytics"."event_impressions_p_202411" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202411_user_id_created_at_idx" ON "analytics"."event_impressions_p_202411" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202412_event_id_created_at_idx" ON "analytics"."event_impressions_p_202412" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202412_user_id_created_at_idx" ON "analytics"."event_impressions_p_202412" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202501_event_id_created_at_idx" ON "analytics"."event_impressions_p_202501" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202501_user_id_created_at_idx" ON "analytics"."event_impressions_p_202501" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202502_event_id_created_at_idx" ON "analytics"."event_impressions_p_202502" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202502_user_id_created_at_idx" ON "analytics"."event_impressions_p_202502" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202503_event_id_created_at_idx" ON "analytics"."event_impressions_p_202503" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202503_user_id_created_at_idx" ON "analytics"."event_impressions_p_202503" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202504_event_id_created_at_idx" ON "analytics"."event_impressions_p_202504" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202504_user_id_created_at_idx" ON "analytics"."event_impressions_p_202504" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202505_event_id_created_at_idx" ON "analytics"."event_impressions_p_202505" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202505_user_id_created_at_idx" ON "analytics"."event_impressions_p_202505" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202506_event_id_created_at_idx" ON "analytics"."event_impressions_p_202506" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202506_user_id_created_at_idx" ON "analytics"."event_impressions_p_202506" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202507_event_id_created_at_idx" ON "analytics"."event_impressions_p_202507" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202507_user_id_created_at_idx" ON "analytics"."event_impressions_p_202507" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202508_event_id_created_at_idx" ON "analytics"."event_impressions_p_202508" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202508_user_id_created_at_idx" ON "analytics"."event_impressions_p_202508" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202509_event_id_created_at_idx" ON "analytics"."event_impressions_p_202509" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202509_user_id_created_at_idx" ON "analytics"."event_impressions_p_202509" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202510_event_id_created_at_idx" ON "analytics"."event_impressions_p_202510" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202510_user_id_created_at_idx" ON "analytics"."event_impressions_p_202510" USING "btree" ("user_id", "created_at");



CREATE INDEX "event_impressions_p_202511_event_id_created_at_idx" ON "analytics"."event_impressions_p_202511" USING "btree" ("event_id", "created_at");



CREATE INDEX "event_impressions_p_202511_user_id_created_at_idx" ON "analytics"."event_impressions_p_202511" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_analytics_events_event_time" ON "analytics"."analytics_events" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_audience_consents_event_segment" ON "analytics"."audience_consents" USING "btree" ("event_id", "segment_key");



CREATE INDEX "idx_event_aud_ins_brand_affinities_gin" ON "analytics"."event_audience_insights" USING "gin" ("brand_affinities" "jsonb_path_ops");



CREATE INDEX "idx_event_aud_ins_household_income_gin" ON "analytics"."event_audience_insights" USING "gin" ("household_income_segments" "jsonb_path_ops");



CREATE INDEX "idx_event_aud_ins_updated" ON "analytics"."event_audience_insights" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_event_audience_insights_age_gin" ON "analytics"."event_audience_insights" USING "gin" ("age_segments");



CREATE INDEX "idx_event_audience_insights_engagement" ON "analytics"."event_audience_insights" USING "btree" ("engagement_score" DESC NULLS LAST);



CREATE INDEX "idx_event_audience_insights_event" ON "analytics"."event_audience_insights" USING "btree" ("event_id");



CREATE INDEX "idx_event_audience_insights_event_id" ON "analytics"."event_audience_insights" USING "btree" ("event_id");



CREATE INDEX "idx_event_audience_insights_geo_gin" ON "analytics"."event_audience_insights" USING "gin" ("geo_distribution");



CREATE INDEX "idx_event_audience_insights_interests_gin" ON "analytics"."event_audience_insights" USING "gin" ("interests_top");



CREATE UNIQUE INDEX "idx_event_impressions_daily_pk" ON "analytics"."event_impressions_daily" USING "btree" ("event_id", "day");



CREATE INDEX "idx_event_impressions_session_time" ON "analytics"."event_impressions" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_event_impressions_user_time" ON "analytics"."event_impressions" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_event_stat_snapshots_event_metric" ON "analytics"."event_stat_snapshots" USING "btree" ("event_id", "metric_key");



CREATE INDEX "idx_event_stat_snapshots_event_time" ON "analytics"."event_stat_snapshots" USING "btree" ("event_id", "captured_at" DESC);



CREATE INDEX "idx_post_clicks_created_at" ON "analytics"."post_clicks" USING "btree" ("created_at");



CREATE INDEX "idx_post_clicks_event_id" ON "analytics"."post_clicks" USING "btree" ("event_id");



CREATE INDEX "idx_post_clicks_post_id" ON "analytics"."post_clicks" USING "btree" ("post_id");



CREATE INDEX "idx_post_clicks_target" ON "analytics"."post_clicks" USING "btree" ("target");



CREATE UNIQUE INDEX "idx_post_impressions_daily_pk" ON "analytics"."post_impressions_daily" USING "btree" ("post_id", "day");



CREATE INDEX "idx_post_impressions_session_time" ON "analytics"."post_impressions" USING "btree" ("session_id", "created_at" DESC) WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_post_impressions_user_time" ON "analytics"."post_impressions" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_post_views_created_at" ON "analytics"."post_views" USING "btree" ("created_at");



CREATE INDEX "idx_post_views_event_id" ON "analytics"."post_views" USING "btree" ("event_id");



CREATE INDEX "idx_post_views_post_id" ON "analytics"."post_views" USING "btree" ("post_id");



CREATE INDEX "idx_post_views_session_id" ON "analytics"."post_views" USING "btree" ("session_id", "post_id", "created_at") WHERE ("session_id" IS NOT NULL);



CREATE INDEX "idx_post_views_user_id" ON "analytics"."post_views" USING "btree" ("user_id", "post_id", "created_at") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_ticket_analytics_created_at" ON "analytics"."ticket_analytics" USING "btree" ("created_at");



CREATE INDEX "idx_ticket_analytics_event_id" ON "analytics"."ticket_analytics" USING "btree" ("event_id");



CREATE INDEX "idx_ticket_analytics_event_type" ON "analytics"."ticket_analytics" USING "btree" ("event_type");



CREATE INDEX "idx_ticket_analytics_p_event_id_created_at" ON ONLY "analytics"."ticket_analytics_p" USING "btree" ("event_id", "created_at");



CREATE INDEX "idx_ticket_analytics_p_user_id_created_at" ON ONLY "analytics"."ticket_analytics_p" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_ticket_analytics_ticket_id" ON "analytics"."ticket_analytics" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_analytics_user_id" ON "analytics"."ticket_analytics" USING "btree" ("user_id");



CREATE INDEX "idx_user_interactions_created_at" ON "analytics"."user_event_interactions" USING "btree" ("created_at");



CREATE INDEX "idx_user_interactions_event_id" ON "analytics"."user_event_interactions" USING "btree" ("event_id");



CREATE INDEX "idx_user_interactions_type" ON "analytics"."user_event_interactions" USING "btree" ("interaction_type");



CREATE INDEX "idx_user_interactions_user_id" ON "analytics"."user_event_interactions" USING "btree" ("user_id");



CREATE INDEX "post_impr_postid_createdat_idx" ON "analytics"."post_impressions" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "post_views_postid_createdat_idx" ON "analytics"."post_views" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "ticket_analytics_default_event_id_created_at_idx" ON "analytics"."ticket_analytics_default" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_default_user_id_created_at_idx" ON "analytics"."ticket_analytics_default" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202404_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202404" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202404_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202404" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202405_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202405" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202405_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202405" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202406_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202406" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202406_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202406" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202407_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202407" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202407_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202407" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202408_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202408" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202408_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202408" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202409_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202409" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202409_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202409" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202410_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202410" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202410_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202410" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202411_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202411" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202411_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202411" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202412_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202412" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202412_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202412" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202501_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202501" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202501_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202501" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202502_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202502" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202502_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202502" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202503_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202503" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202503_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202503" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202504_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202504" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202504_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202504" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202505_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202505" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202505_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202505" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202506_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202506" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202506_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202506" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202507_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202507" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202507_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202507" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202508_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202508" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202508_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202508" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202509_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202509" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202509_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202509" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202510_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202510" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202510_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202510" USING "btree" ("user_id", "created_at");



CREATE INDEX "ticket_analytics_p_202511_event_id_created_at_idx" ON "analytics"."ticket_analytics_p_202511" USING "btree" ("event_id", "created_at");



CREATE INDEX "ticket_analytics_p_202511_user_id_created_at_idx" ON "analytics"."ticket_analytics_p_202511" USING "btree" ("user_id", "created_at");



CREATE INDEX "idx_ad_clicks_campaign_created" ON "campaigns"."ad_clicks" USING "btree" ("campaign_id", "created_at" DESC);



CREATE INDEX "idx_ad_clicks_campaign_time" ON "campaigns"."ad_clicks" USING "btree" ("campaign_id", "created_at" DESC);



CREATE INDEX "idx_ad_clicks_creative_date" ON "campaigns"."ad_clicks" USING "btree" ("creative_id", "created_at" DESC);



CREATE INDEX "idx_ad_clicks_impression" ON "campaigns"."ad_clicks" USING "btree" ("impression_id");



CREATE INDEX "idx_ad_creatives_campaign" ON "campaigns"."ad_creatives" USING "btree" ("campaign_id", "id");



CREATE INDEX "idx_ad_creatives_campaign_active" ON "campaigns"."ad_creatives" USING "btree" ("campaign_id", "active");



CREATE INDEX "idx_ad_impressions_campaign_created" ON "campaigns"."ad_impressions" USING "btree" ("campaign_id", "created_at" DESC);



CREATE INDEX "idx_ad_impressions_campaign_time" ON "campaigns"."ad_impressions" USING "btree" ("campaign_id", "created_at" DESC);



CREATE INDEX "idx_ad_impressions_creative_date" ON "campaigns"."ad_impressions" USING "btree" ("creative_id", "created_at" DESC);



CREATE INDEX "idx_ad_impressions_user_session" ON "campaigns"."ad_impressions" USING "btree" ("user_id", "session_id", "campaign_id", "created_at" DESC);



CREATE INDEX "idx_ad_spend_campaign_time" ON "campaigns"."ad_spend_ledger" USING "btree" ("campaign_id", "occurred_at");



CREATE INDEX "idx_ad_spend_creative_date" ON "campaigns"."ad_spend_ledger" USING "btree" ("creative_id", "occurred_at" DESC);



CREATE INDEX "idx_ad_spend_wallet_time" ON "campaigns"."ad_spend_ledger" USING "btree" ("wallet_id", "occurred_at");



CREATE INDEX "idx_campaign_placements_enabled" ON "campaigns"."campaign_placements" USING "btree" ("campaign_id", "placement") WHERE ("enabled" = true);



CREATE INDEX "idx_campaigns_org_status_dates" ON "campaigns"."campaigns" USING "btree" ("org_id", "status", "start_date", "end_date");



CREATE INDEX "event_comments_postid_createdat_idx" ON "events"."event_comments" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "event_posts_authorid_createdat_desc" ON "events"."event_posts" USING "btree" ("author_user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "event_posts_deleted_at_idx" ON "events"."event_posts" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "event_posts_event_id_idx" ON "events"."event_posts" USING "btree" ("event_id");



CREATE INDEX "event_posts_eventid_createdat_desc" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC) WHERE (("deleted_at" IS NULL) AND ("visibility" = 'public'::"text") AND ("moderation_state" <> 'removed'::"text"));



CREATE INDEX "event_posts_fts_idx" ON "events"."event_posts" USING "gin" ("to_tsvector"('"simple"'::"regconfig", COALESCE("text", ''::"text")));



CREATE INDEX "event_posts_linkmeta_gin" ON "events"."event_posts" USING "gin" ("link_meta");



CREATE INDEX "event_posts_pinned_idx" ON "events"."event_posts" USING "btree" ("event_id", "pinned" DESC, "created_at" DESC);



CREATE UNIQUE INDEX "event_reactions_like_unique" ON "events"."event_reactions" USING "btree" ("post_id", "user_id") WHERE ("kind" = 'like'::"text");



CREATE INDEX "event_reactions_userid_createdat_idx" ON "events"."event_reactions" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "event_roles_event_id_role_idx" ON "events"."event_roles" USING "btree" ("event_id", "role");



CREATE INDEX "event_series_org_idx" ON "events"."event_series" USING "btree" ("organization_id");



CREATE INDEX "event_share_assets_event_active_idx" ON "events"."event_share_assets" USING "btree" ("event_id", "active");



CREATE INDEX "events_category_idx" ON "events"."events" USING "btree" ("category");



CREATE INDEX "events_fts_idx" ON "events"."events" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("description", ''::"text")) || ' '::"text") || COALESCE("category", ''::"text"))));



CREATE INDEX "events_series_id_idx" ON "events"."events" USING "btree" ("series_id");



CREATE INDEX "events_start_at_idx" ON "events"."events" USING "btree" ("start_at");



CREATE INDEX "events_visibility_category_idx" ON "events"."events" USING "btree" ("visibility", "category");



CREATE INDEX "events_visibility_idx" ON "events"."events" USING "btree" ("visibility");



CREATE INDEX "events_visibility_start_at_idx" ON "events"."events" USING "btree" ("visibility", "start_at");



CREATE INDEX "idx_comment_reactions_comment_id" ON "events"."event_comment_reactions" USING "btree" ("comment_id");



CREATE INDEX "idx_comments_post_created" ON "events"."event_comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "idx_comments_post_created_partial" ON "events"."event_comments" USING "btree" ("post_id", "created_at");



CREATE INDEX "idx_event_comments_created_at" ON "events"."event_comments" USING "btree" ("created_at");



CREATE INDEX "idx_event_comments_post_created" ON "events"."event_comments" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "idx_event_comments_post_created_id_desc" ON "events"."event_comments" USING "btree" ("post_id", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_event_comments_post_id" ON "events"."event_comments" USING "btree" ("post_id");



CREATE INDEX "idx_event_comments_post_time" ON "events"."event_comments" USING "btree" ("post_id", "created_at" DESC);



CREATE INDEX "idx_event_posts_active_counts" ON "events"."event_posts" USING "btree" ("event_id", "like_count", "comment_count") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_posts_author" ON "events"."event_posts" USING "btree" ("author_user_id");



CREATE INDEX "idx_event_posts_author_created_at" ON "events"."event_posts" USING "btree" ("author_user_id", "created_at" DESC);



CREATE INDEX "idx_event_posts_author_created_at_partial" ON "events"."event_posts" USING "btree" ("author_user_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_posts_author_created_id_desc" ON "events"."event_posts" USING "btree" ("author_user_id", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_event_posts_author_user_id" ON "events"."event_posts" USING "btree" ("author_user_id");



CREATE INDEX "idx_event_posts_event_created" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_event_posts_event_created_active_partial" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_posts_event_created_at" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_event_posts_event_created_at_partial" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_posts_event_created_id_desc" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_event_posts_event_id" ON "events"."event_posts" USING "btree" ("event_id");



CREATE INDEX "idx_event_posts_event_id_created_at_active" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_posts_event_time" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_event_posts_not_deleted" ON "events"."event_posts" USING "btree" ("event_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_posts_recent_activity" ON "events"."event_posts" USING "btree" ("event_id", "created_at") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_event_reactions_post" ON "events"."event_reactions" USING "btree" ("post_id");



CREATE INDEX "idx_event_reactions_post_id" ON "events"."event_reactions" USING "btree" ("post_id");



CREATE INDEX "idx_event_reactions_post_kind" ON "events"."event_reactions" USING "btree" ("post_id", "kind");



CREATE INDEX "idx_event_reactions_user_id" ON "events"."event_reactions" USING "btree" ("user_id");



CREATE INDEX "idx_events_category_start" ON "events"."events" USING "btree" ("category", "start_at" DESC);



CREATE INDEX "idx_events_category_start_at" ON "events"."events" USING "btree" ("category", "start_at");



CREATE INDEX "idx_events_city" ON "events"."events" USING "btree" ("city") WHERE ("city" IS NOT NULL);



CREATE INDEX "idx_events_created_by" ON "events"."events" USING "btree" ("created_by");



CREATE INDEX "idx_events_created_id_desc" ON "events"."events" USING "btree" ("created_at" DESC, "id" DESC);



CREATE INDEX "idx_events_desc_vec_hnsw" ON "events"."events" USING "hnsw" ("description_embedding" "public"."vector_ip_ops") WHERE ("description_embedding" IS NOT NULL);



CREATE INDEX "idx_events_description_embedding_hnsw" ON "events"."events" USING "hnsw" ("description_embedding" "public"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_events_org_time" ON "events"."events" USING "btree" ("owner_context_id", "start_at" DESC);



CREATE INDEX "idx_events_slug" ON "events"."events" USING "btree" ("slug");



CREATE INDEX "idx_events_sponsorable_start" ON "events"."events" USING "btree" ("sponsorable", "start_at" DESC) WHERE ("sponsorable" = true);



CREATE INDEX "idx_events_start_at" ON "events"."events" USING "btree" ("start_at");



CREATE INDEX "idx_events_target_audience_gin" ON "events"."events" USING "gin" ("target_audience" "jsonb_path_ops");



CREATE INDEX "idx_events_visibility_start" ON "events"."events" USING "btree" ("visibility", "start_at" DESC);



CREATE INDEX "idx_events_visibility_start_at" ON "events"."events" USING "btree" ("visibility", "start_at");



CREATE INDEX "idx_events_visibility_start_id" ON "events"."events" USING "btree" ("visibility", "start_at" DESC, "id" DESC);



CREATE INDEX "idx_posts_event_created_id" ON "events"."event_posts" USING "btree" ("event_id", "created_at" DESC, "id" DESC);



CREATE INDEX "idx_reactions_post_kind" ON "events"."event_reactions" USING "btree" ("post_id", "kind");



CREATE INDEX "idx_reactions_post_kind_user" ON "events"."event_reactions" USING "btree" ("post_id", "kind", "user_id");



CREATE INDEX "media_assets_status_createdat_idx" ON "events"."media_assets" USING "btree" ("status", "created_at");



CREATE INDEX "post_hashtags_tag_post_idx" ON "events"."post_hashtags" USING "btree" ("tag", "post_id");



CREATE INDEX "post_media_postid_pos_idx" ON "events"."post_media" USING "btree" ("post_id", "position");



CREATE INDEX "post_mentions_user_post_idx" ON "events"."post_mentions" USING "btree" ("mentioned_user_id", "post_id");



CREATE INDEX "role_invites_event_id_role_status_idx" ON "events"."role_invites" USING "btree" ("event_id", "role", "status");



CREATE INDEX "role_invites_token_idx" ON "events"."role_invites" USING "btree" ("token");



CREATE UNIQUE INDEX "role_invites_token_uidx" ON "events"."role_invites" USING "btree" ("token");



CREATE UNIQUE INDEX "uniq_comment_client" ON "events"."event_comments" USING "btree" ("post_id", "author_user_id", "client_id") WHERE ("client_id" IS NOT NULL);



CREATE UNIQUE INDEX "uniq_comment_like" ON "events"."event_comment_reactions" USING "btree" ("comment_id", "user_id", "kind");



CREATE UNIQUE INDEX "ux_event_invites_event_email" ON "events"."event_invites" USING "btree" ("event_id", "lower"("email")) WHERE ("email" IS NOT NULL);



CREATE UNIQUE INDEX "ux_event_scanners_event_user" ON "events"."event_scanners" USING "btree" ("event_id", "user_id");



CREATE INDEX "message_job_recipients_job_id_status_idx" ON "messaging"."message_job_recipients" USING "btree" ("job_id", "status");



CREATE INDEX "message_jobs_event_id_status_scheduled_at_idx" ON "messaging"."message_jobs" USING "btree" ("event_id", "status", "scheduled_at");



CREATE INDEX "notifications_user_id_created_at_idx" ON "messaging"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_user_embeddings_updated_at" ON "ml"."user_embeddings" USING "btree" ("updated_at");



CREATE INDEX "idx_org_contact_entries_email" ON "organizations"."org_contact_import_entries" USING "btree" ("lower"("email"));



CREATE INDEX "idx_org_contact_entries_import_id" ON "organizations"."org_contact_import_entries" USING "btree" ("import_id");



CREATE INDEX "idx_org_contact_entries_phone" ON "organizations"."org_contact_import_entries" USING "btree" ("phone");



CREATE INDEX "idx_org_contact_imports_imported_at" ON "organizations"."org_contact_imports" USING "btree" ("imported_at");



CREATE INDEX "idx_org_contact_imports_org_id" ON "organizations"."org_contact_imports" USING "btree" ("org_id");



CREATE INDEX "idx_org_wallet_transactions_created_at" ON "organizations"."org_wallet_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_org_wallet_transactions_wallet_id" ON "organizations"."org_wallet_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_org_wallet_tx_wallet_time" ON "organizations"."org_wallet_transactions" USING "btree" ("wallet_id", "created_at" DESC);



CREATE INDEX "idx_org_wallets_org_id" ON "organizations"."org_wallets" USING "btree" ("org_id");



CREATE INDEX "idx_organizations_handle" ON "organizations"."organizations" USING "btree" ("handle");



CREATE INDEX "idx_organizations_social_links" ON "organizations"."organizations" USING "gin" ("social_links");



CREATE INDEX "idx_organizations_support_email" ON "organizations"."organizations" USING "btree" ("support_email");



CREATE INDEX "idx_payout_accounts_context" ON "organizations"."payout_accounts" USING "btree" ("context_type", "context_id");



CREATE INDEX "idx_payout_configurations_organization_id" ON "organizations"."payout_configurations" USING "btree" ("organization_id");



CREATE INDEX "org_invitations_email_idx" ON "organizations"."org_invitations" USING "btree" ("email");



CREATE INDEX "org_invitations_org_id_idx" ON "organizations"."org_invitations" USING "btree" ("org_id");



CREATE INDEX "org_invitations_status_idx" ON "organizations"."org_invitations" USING "btree" ("status");



CREATE INDEX "org_invitations_token_idx" ON "organizations"."org_invitations" USING "btree" ("token");



CREATE UNIQUE INDEX "uq_org_wallet_txn_invoice_purchase" ON "organizations"."org_wallet_transactions" USING "btree" ("invoice_id") WHERE ("transaction_type" = 'purchase'::"text");



CREATE UNIQUE INDEX "uq_org_wallet_txn_invoice_refund" ON "organizations"."org_wallet_transactions" USING "btree" ("invoice_id") WHERE ("transaction_type" = 'refund'::"text");



CREATE INDEX "idx_credit_lots_checkout_session" ON "payments"."credit_lots" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "idx_credit_lots_expires" ON "payments"."credit_lots" USING "btree" ("expires_at") WHERE (("expires_at" IS NOT NULL) AND ("depleted_at" IS NULL));



CREATE INDEX "idx_credit_lots_org_wallet" ON "payments"."credit_lots" USING "btree" ("org_wallet_id") WHERE (("org_wallet_id" IS NOT NULL) AND ("quantity_remaining" > 0));



CREATE INDEX "idx_credit_lots_wallet" ON "payments"."credit_lots" USING "btree" ("wallet_id") WHERE (("wallet_id" IS NOT NULL) AND ("quantity_remaining" > 0));



CREATE INDEX "idx_invoices_pi" ON "payments"."invoices" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "idx_invoices_purchased_by" ON "payments"."invoices" USING "btree" ("purchased_by_user_id");



CREATE INDEX "idx_invoices_wallet_id" ON "payments"."invoices" USING "btree" ("wallet_id");



CREATE INDEX "idx_payout_queue_order_status_scheduled" ON "payments"."payout_queue" USING "btree" ("order_id", "status", "scheduled_for");



CREATE INDEX "idx_payout_queue_priority" ON "payments"."payout_queue" USING "btree" ("priority" DESC, "created_at");



CREATE INDEX "idx_payout_queue_status_scheduled" ON "payments"."payout_queue" USING "btree" ("status", "scheduled_for") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_wallet_txns_created_at" ON "payments"."wallet_transactions" USING "btree" ("created_at");



CREATE INDEX "idx_wallet_txns_ref" ON "payments"."wallet_transactions" USING "btree" ("reference_type", "reference_id");



CREATE INDEX "idx_wallet_txns_wallet_created" ON "payments"."wallet_transactions" USING "btree" ("wallet_id", "created_at" DESC);



CREATE INDEX "idx_wallet_txns_wallet_id" ON "payments"."wallet_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_wallets_user_id" ON "payments"."wallets" USING "btree" ("user_id");



CREATE INDEX "idx_cad_campaign_date" ON "public"."campaign_analytics_daily" USING "btree" ("campaign_id", "date");



CREATE INDEX "idx_cad_org_date" ON "public"."campaign_analytics_daily" USING "btree" ("org_id", "date");



CREATE INDEX "idx_campaign_analytics_daily_campaign_date" ON "public"."campaign_analytics_daily" USING "btree" ("campaign_id", "date" DESC);



CREATE INDEX "idx_campaign_analytics_daily_org_date" ON "public"."campaign_analytics_daily" USING "btree" ("org_id", "date" DESC);



CREATE INDEX "idx_crad_campaign_date" ON "public"."creative_analytics_daily" USING "btree" ("campaign_id", "date");



CREATE INDEX "idx_crad_creative_date" ON "public"."creative_analytics_daily" USING "btree" ("creative_id", "date");



CREATE INDEX "idx_crad_org_date" ON "public"."creative_analytics_daily" USING "btree" ("org_id", "date");



CREATE INDEX "idx_creative_analytics_daily_campaign_date" ON "public"."creative_analytics_daily" USING "btree" ("campaign_id", "date" DESC);



CREATE INDEX "idx_creative_analytics_daily_org_date" ON "public"."creative_analytics_daily" USING "btree" ("org_id", "date" DESC);



CREATE INDEX "idx_dead_letter_webhooks_status_time" ON "public"."dead_letter_webhooks" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_dead_letter_webhooks_type" ON "public"."dead_letter_webhooks" USING "btree" ("webhook_type");



CREATE INDEX "idx_event_covis_a" ON "public"."event_covis" USING "btree" ("event_a");



CREATE INDEX "idx_event_covis_b" ON "public"."event_covis" USING "btree" ("event_b");



CREATE INDEX "idx_event_covis_count" ON "public"."event_covis" USING "btree" ("covisit_count" DESC);



CREATE UNIQUE INDEX "idx_event_covis_pk" ON "public"."event_covis" USING "btree" ("event_a", "event_b");



CREATE UNIQUE INDEX "idx_event_video_kpis_daily_unique" ON "public"."event_video_kpis_daily" USING "btree" ("event_id", "d");



CREATE INDEX "idx_idempotency_created" ON "public"."idempotency_keys" USING "btree" ("created_at");



CREATE INDEX "idx_mv_event_quality_scores_category" ON "public"."mv_event_quality_scores" USING "btree" ("category");



CREATE UNIQUE INDEX "idx_mv_event_quality_scores_event_id" ON "public"."mv_event_quality_scores" USING "btree" ("event_id");



CREATE INDEX "idx_mv_event_quality_scores_final_score" ON "public"."mv_event_quality_scores" USING "btree" ("final_quality_score" DESC);



CREATE INDEX "idx_mv_event_quality_scores_quality_tier" ON "public"."mv_event_quality_scores" USING "btree" ("quality_tier");



CREATE INDEX "idx_mv_fit_scores_event_score" ON "public"."mv_sponsor_event_fit_scores" USING "btree" ("event_id", "score" DESC);



CREATE INDEX "idx_mv_fit_scores_sponsor_score" ON "public"."mv_sponsor_event_fit_scores" USING "btree" ("sponsor_id", "score" DESC);



CREATE UNIQUE INDEX "idx_mv_fit_scores_unique" ON "public"."mv_sponsor_event_fit_scores" USING "btree" ("sponsor_id", "event_id");



CREATE INDEX "idx_outbox_unprocessed" ON "public"."outbox" USING "btree" ("created_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_pgbench_tiers_id" ON "public"."pgbench_tiers" USING "btree" ("id");



CREATE INDEX "idx_rate_limits_ip_hash_minute" ON "public"."rate_limits" USING "btree" ("ip_hash", "minute") WHERE ("ip_hash" IS NOT NULL);



CREATE INDEX "idx_request_logs_source_time" ON "public"."request_logs" USING "btree" ("source_type", "created_at" DESC);



CREATE INDEX "idx_trending_posts" ON "public"."trending_posts" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "idx_user_event_affinity_event" ON "public"."user_event_affinity" USING "btree" ("event_id");



CREATE UNIQUE INDEX "idx_user_event_affinity_pk" ON "public"."user_event_affinity" USING "btree" ("user_id", "event_id");



CREATE INDEX "idx_user_event_affinity_score" ON "public"."user_event_affinity" USING "btree" ("affinity_score" DESC);



CREATE INDEX "idx_user_event_affinity_user" ON "public"."user_event_affinity" USING "btree" ("user_id");



CREATE INDEX "kv_store_d42c04e8_key_idx" ON "public"."kv_store_d42c04e8" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_d42c04e8_key_idx1" ON "public"."kv_store_d42c04e8" USING "btree" ("key" "text_pattern_ops");



CREATE INDEX "kv_store_d42c04e8_key_idx2" ON "public"."kv_store_d42c04e8" USING "btree" ("key" "text_pattern_ops");



CREATE UNIQUE INDEX "mv_event_quality_scores_pk" ON "public"."mv_event_quality_scores" USING "btree" ("event_id");



CREATE UNIQUE INDEX "mv_event_reach_snapshot_pk" ON "public"."mv_event_reach_snapshot" USING "btree" ("event_id");



CREATE INDEX "mv_sponsorship_revenue_event_id_idx" ON "public"."mv_sponsorship_revenue" USING "btree" ("event_id");



CREATE UNIQUE INDEX "uq_campaign_analytics_daily" ON "public"."campaign_analytics_daily" USING "btree" ("campaign_id", "date");



CREATE UNIQUE INDEX "uq_creative_analytics_daily" ON "public"."creative_analytics_daily" USING "btree" ("creative_id", "date");



CREATE INDEX "event_sponsorships_event_id_idx" ON "sponsorship"."event_sponsorships" USING "btree" ("event_id");



CREATE INDEX "idx_deliverable_proofs_deliv" ON "sponsorship"."deliverable_proofs" USING "btree" ("deliverable_id");



CREATE INDEX "idx_deliverable_proofs_deliverable_submitted" ON "sponsorship"."deliverable_proofs" USING "btree" ("deliverable_id", "submitted_at" DESC);



CREATE INDEX "idx_deliverables_due_status" ON "sponsorship"."deliverables" USING "btree" ("due_at", "status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'needs_changes'::"text"]));



CREATE INDEX "idx_deliverables_event_sponsor_due" ON "sponsorship"."deliverables" USING "btree" ("event_id", "sponsor_id", "due_at");



CREATE INDEX "idx_deliverables_event_sponsor_status" ON "sponsorship"."deliverables" USING "btree" ("event_id", "sponsor_id", "status");



CREATE INDEX "idx_deliverables_evt_sponsor" ON "sponsorship"."deliverables" USING "btree" ("event_id", "sponsor_id");



CREATE INDEX "idx_deliverables_order" ON "sponsorship"."deliverables" USING "btree" ("order_id");



CREATE INDEX "idx_deliverables_package" ON "sponsorship"."deliverables" USING "btree" ("package_id");



CREATE INDEX "idx_deliverables_status" ON "sponsorship"."deliverables" USING "btree" ("status", "due_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'needs_changes'::"text"]));



CREATE INDEX "idx_fit_recalc_queue_pending" ON "sponsorship"."fit_recalc_queue" USING "btree" ("processed_at" NULLS FIRST, "queued_at");



CREATE INDEX "idx_fit_recalc_queue_processed" ON "sponsorship"."fit_recalc_queue" USING "btree" ("processed_at");



CREATE INDEX "idx_fit_recalc_queue_reason" ON "sponsorship"."fit_recalc_queue" USING "btree" ("reason", "queued_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_fit_recalc_queue_unprocessed" ON "sponsorship"."fit_recalc_queue" USING "btree" ("queued_at") WHERE ("processed_at" IS NULL);



CREATE INDEX "idx_match_event_score" ON "sponsorship"."sponsorship_matches" USING "btree" ("event_id", "score" DESC) WHERE ("score" >= 0.5);



COMMENT ON INDEX "sponsorship"."idx_match_event_score" IS 'Optimizes sponsor recommendations for events';



CREATE INDEX "idx_match_features_event_sponsor_computed" ON "sponsorship"."match_features" USING "btree" ("event_id", "sponsor_id", "computed_at" DESC);



CREATE INDEX "idx_match_features_event_sponsor_ver" ON "sponsorship"."match_features" USING "btree" ("event_id", "sponsor_id", "version" DESC);



CREATE INDEX "idx_match_features_event_sponsor_version" ON "sponsorship"."match_features" USING "btree" ("event_id", "sponsor_id", "version" DESC);



CREATE INDEX "idx_match_feedback_event_sponsor" ON "sponsorship"."match_feedback" USING "btree" ("event_id", "sponsor_id");



CREATE INDEX "idx_match_feedback_event_sponsor_created" ON "sponsorship"."match_feedback" USING "btree" ("event_id", "sponsor_id", "created_at" DESC);



CREATE INDEX "idx_match_feedback_label_created" ON "sponsorship"."match_feedback" USING "btree" ("label", "created_at" DESC);



CREATE INDEX "idx_match_feedback_label_reason" ON "sponsorship"."match_feedback" USING "btree" ("label", "created_at" DESC);



CREATE INDEX "idx_match_sponsor_score" ON "sponsorship"."sponsorship_matches" USING "btree" ("sponsor_id", "score" DESC) WHERE ("score" >= 0.5);



COMMENT ON INDEX "sponsorship"."idx_match_sponsor_score" IS 'Optimizes event recommendations for sponsors';



CREATE INDEX "idx_match_status_updated" ON "sponsorship"."sponsorship_matches" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_match_status_utime" ON "sponsorship"."sponsorship_matches" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_orders_event" ON "sponsorship"."sponsorship_orders" USING "btree" ("event_id");



CREATE INDEX "idx_orders_invoice" ON "sponsorship"."sponsorship_orders" USING "btree" ("invoice_id") WHERE ("invoice_id" IS NOT NULL);



CREATE INDEX "idx_orders_package" ON "sponsorship"."sponsorship_orders" USING "btree" ("package_id");



CREATE INDEX "idx_orders_sponsor" ON "sponsorship"."sponsorship_orders" USING "btree" ("sponsor_id");



CREATE INDEX "idx_package_templates_org" ON "sponsorship"."package_templates" USING "btree" ("org_id", "visibility");



CREATE INDEX "idx_package_variants_package_active" ON "sponsorship"."package_variants" USING "btree" ("package_id", "is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "idx_package_variants_package_label" ON "sponsorship"."package_variants" USING "btree" ("package_id", "label");



CREATE INDEX "idx_pkg_active_vis_price" ON "sponsorship"."sponsorship_packages" USING "btree" ("is_active", "visibility", "price_cents") WHERE ("is_active" = true);



COMMENT ON INDEX "sponsorship"."idx_pkg_active_vis_price" IS 'Optimizes marketplace filtering by status, visibility, and price';



CREATE INDEX "idx_pkg_event" ON "sponsorship"."sponsorship_packages" USING "btree" ("event_id") WHERE ("is_active" = true);



CREATE INDEX "idx_pkg_tier" ON "sponsorship"."sponsorship_packages" USING "btree" ("tier", "is_active");



CREATE INDEX "idx_pkgs_event_active" ON "sponsorship"."sponsorship_packages" USING "btree" ("event_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_pkgs_visibility" ON "sponsorship"."sponsorship_packages" USING "btree" ("visibility") WHERE ("visibility" = 'public'::"text");



CREATE INDEX "idx_prop_msgs_thread_time" ON "sponsorship"."proposal_messages" USING "btree" ("thread_id", "created_at" DESC);



CREATE INDEX "idx_prop_threads_evt_sponsor" ON "sponsorship"."proposal_threads" USING "btree" ("event_id", "sponsor_id");



CREATE INDEX "idx_proposal_messages_thread_time" ON "sponsorship"."proposal_messages" USING "btree" ("thread_id", "created_at" DESC);



CREATE INDEX "idx_proposal_threads_event_sponsor_status" ON "sponsorship"."proposal_threads" USING "btree" ("event_id", "sponsor_id", "status");



CREATE INDEX "idx_proposal_threads_status_updated" ON "sponsorship"."proposal_threads" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_so_event_amount" ON "sponsorship"."sponsorship_orders" USING "btree" ("event_id", "amount_cents" DESC);



CREATE INDEX "idx_so_event_status_created" ON "sponsorship"."sponsorship_orders" USING "btree" ("event_id", "status", "created_at");



CREATE INDEX "idx_sp_is_active" ON "sponsorship"."sponsorship_packages" USING "btree" ("id", "is_active");



CREATE INDEX "idx_sp_profile_budget" ON "sponsorship"."sponsor_profiles" USING "btree" ("annual_budget_cents" DESC NULLS LAST) WHERE ("annual_budget_cents" IS NOT NULL);



CREATE INDEX "idx_sp_profile_categories" ON "sponsorship"."sponsor_profiles" USING "gin" ("preferred_categories") WHERE ("preferred_categories" IS NOT NULL);



CREATE INDEX "idx_sp_profile_industry_size" ON "sponsorship"."sponsor_profiles" USING "btree" ("industry", "company_size");



CREATE INDEX "idx_sp_profile_regions" ON "sponsorship"."sponsor_profiles" USING "gin" ("regions") WHERE ("regions" IS NOT NULL);



CREATE INDEX "idx_sponsor_members_sponsor_user" ON "sponsorship"."sponsor_members" USING "btree" ("sponsor_id", "user_id");



CREATE INDEX "idx_sponsor_objectives_vec_hnsw" ON "sponsorship"."sponsor_profiles" USING "hnsw" ("objectives_embedding" "public"."vector_ip_ops") WHERE ("objectives_embedding" IS NOT NULL);



CREATE INDEX "idx_sponsor_profiles_activation_prefs_gin" ON "sponsorship"."sponsor_profiles" USING "gin" ("activation_preferences" "jsonb_path_ops");



CREATE INDEX "idx_sponsor_profiles_brand_objectives_gin" ON "sponsorship"."sponsor_profiles" USING "gin" ("brand_objectives" "jsonb_path_ops");



CREATE INDEX "idx_sponsor_profiles_budget" ON "sponsorship"."sponsor_profiles" USING "btree" ("annual_budget_cents");



CREATE INDEX "idx_sponsor_profiles_case_studies_gin" ON "sponsorship"."sponsor_profiles" USING "gin" ("case_studies" "jsonb_path_ops");



CREATE INDEX "idx_sponsor_profiles_industry" ON "sponsorship"."sponsor_profiles" USING "btree" ("industry");



CREATE INDEX "idx_sponsor_profiles_industry_budget" ON "sponsorship"."sponsor_profiles" USING "btree" ("industry", "annual_budget_cents");



CREATE INDEX "idx_sponsor_profiles_industry_size" ON "sponsorship"."sponsor_profiles" USING "btree" ("industry", "company_size");



CREATE INDEX "idx_sponsor_profiles_objectives_embedding_hnsw" ON "sponsorship"."sponsor_profiles" USING "hnsw" ("objectives_embedding" "public"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_sponsor_profiles_pref_categories" ON "sponsorship"."sponsor_profiles" USING "gin" ("preferred_categories");



CREATE INDEX "idx_sponsor_profiles_regions" ON "sponsorship"."sponsor_profiles" USING "gin" ("regions");



CREATE INDEX "idx_sponsor_profiles_sponsor_id" ON "sponsorship"."sponsor_profiles" USING "btree" ("sponsor_id");



CREATE INDEX "idx_sponsor_profiles_target_audience_gin" ON "sponsorship"."sponsor_profiles" USING "gin" ("target_audience" "jsonb_path_ops");



CREATE INDEX "idx_sponsor_public_profiles_slug" ON "sponsorship"."sponsor_public_profiles" USING "btree" ("slug");



CREATE INDEX "idx_sponsor_public_profiles_verified" ON "sponsorship"."sponsor_public_profiles" USING "btree" ("is_verified", "updated_at" DESC) WHERE ("is_verified" = true);



CREATE INDEX "idx_sponsor_public_profiles_verified_updated" ON "sponsorship"."sponsor_public_profiles" USING "btree" ("is_verified", "updated_at" DESC) WHERE ("is_verified" = true);



CREATE INDEX "idx_sponsors_brand_values_gin" ON "sponsorship"."sponsors" USING "gin" ("brand_values" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_matches_event_id" ON "sponsorship"."sponsorship_matches" USING "btree" ("event_id");



CREATE INDEX "idx_sponsorship_matches_event_score" ON "sponsorship"."sponsorship_matches" USING "btree" ("event_id", "score" DESC);



CREATE INDEX "idx_sponsorship_matches_event_score_v2" ON "sponsorship"."sponsorship_matches" USING "btree" ("event_id", "score" DESC) WHERE ("score" >= 0.5);



CREATE INDEX "idx_sponsorship_matches_event_sponsor" ON "sponsorship"."sponsorship_matches" USING "btree" ("event_id", "sponsor_id");



CREATE INDEX "idx_sponsorship_matches_score" ON "sponsorship"."sponsorship_matches" USING "btree" ("score" DESC);



CREATE INDEX "idx_sponsorship_matches_sponsor_id" ON "sponsorship"."sponsorship_matches" USING "btree" ("sponsor_id");



CREATE INDEX "idx_sponsorship_matches_sponsor_score" ON "sponsorship"."sponsorship_matches" USING "btree" ("sponsor_id", "score" DESC);



CREATE INDEX "idx_sponsorship_matches_status" ON "sponsorship"."sponsorship_matches" USING "btree" ("status");



CREATE INDEX "idx_sponsorship_matches_status_score" ON "sponsorship"."sponsorship_matches" USING "btree" ("status", "score" DESC) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_sponsorship_matches_status_updated" ON "sponsorship"."sponsorship_matches" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_sponsorship_orders_cancellation_gin" ON "sponsorship"."sponsorship_orders" USING "gin" ("cancellation_policy" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_orders_event" ON "sponsorship"."sponsorship_orders" USING "btree" ("event_id", "status");



CREATE INDEX "idx_sponsorship_orders_event_sponsor_status" ON "sponsorship"."sponsorship_orders" USING "btree" ("event_id", "sponsor_id", "status");



CREATE INDEX "idx_sponsorship_orders_milestone_gin" ON "sponsorship"."sponsorship_orders" USING "gin" ("milestone" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_orders_sponsor" ON "sponsorship"."sponsorship_orders" USING "btree" ("sponsor_id", "status");



CREATE INDEX "idx_sponsorship_orders_status_created" ON "sponsorship"."sponsorship_orders" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_sponsorship_packages_active_quality" ON "sponsorship"."sponsorship_packages" USING "btree" ("is_active", "quality_score" DESC NULLS LAST) WHERE (("is_active" = true) AND ("visibility" = 'public'::"text"));



CREATE INDEX "idx_sponsorship_packages_audience_snapshot_gin" ON "sponsorship"."sponsorship_packages" USING "gin" ("audience_snapshot" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_packages_availability_gin" ON "sponsorship"."sponsorship_packages" USING "gin" ("availability" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_packages_benefits_gin" ON "sponsorship"."sponsorship_packages" USING "gin" ("benefits" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_packages_constraints_gin" ON "sponsorship"."sponsorship_packages" USING "gin" ("constraints" "jsonb_path_ops");



CREATE INDEX "idx_sponsorship_packages_event_active_quality" ON "sponsorship"."sponsorship_packages" USING "btree" ("event_id", "is_active", "quality_score" DESC NULLS LAST) WHERE ("is_active" = true);



CREATE UNIQUE INDEX "idx_sponsorship_packages_event_tier_version" ON "sponsorship"."sponsorship_packages" USING "btree" ("event_id", "tier", "version");



CREATE INDEX "idx_sponsorship_packages_event_visibility_price" ON "sponsorship"."sponsorship_packages" USING "btree" ("event_id", "is_active", "visibility", "price_cents") WHERE ("is_active" = true);



CREATE INDEX "idx_sponsorship_packages_quality" ON "sponsorship"."sponsorship_packages" USING "btree" ("quality_score" DESC NULLS LAST, "created_at" DESC);



CREATE INDEX "idx_sponsorship_packages_tier_active" ON "sponsorship"."sponsorship_packages" USING "btree" ("tier", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_sponsorship_payouts_order" ON "sponsorship"."sponsorship_payouts" USING "btree" ("order_id");



CREATE INDEX "idx_sponsorship_payouts_order_id" ON "sponsorship"."sponsorship_payouts" USING "btree" ("order_id");



CREATE INDEX "idx_sponsorship_payouts_organizer_id" ON "sponsorship"."sponsorship_payouts" USING "btree" ("organizer_id");



CREATE INDEX "idx_sponsorship_payouts_organizer_status" ON "sponsorship"."sponsorship_payouts" USING "btree" ("organizer_id", "status");



CREATE INDEX "idx_sponsorship_payouts_status" ON "sponsorship"."sponsorship_payouts" USING "btree" ("status");



CREATE INDEX "idx_sprof_categories" ON "sponsorship"."sponsor_profiles" USING "gin" ("preferred_categories") WHERE ("preferred_categories" IS NOT NULL);



CREATE INDEX "idx_sprof_industry_size" ON "sponsorship"."sponsor_profiles" USING "btree" ("industry", "company_size");



CREATE INDEX "idx_sprof_obj_vec_hnsw" ON "sponsorship"."sponsor_profiles" USING "hnsw" ("objectives_embedding" "public"."vector_ip_ops") WHERE ("objectives_embedding" IS NOT NULL);



CREATE INDEX "idx_sprof_regions" ON "sponsorship"."sponsor_profiles" USING "gin" ("regions") WHERE ("regions" IS NOT NULL);



CREATE UNIQUE INDEX "proposal_threads_one_active_per_pair" ON "sponsorship"."proposal_threads" USING "btree" ("event_id", "sponsor_id") WHERE ("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'counter'::"text"]));



COMMENT ON INDEX "sponsorship"."proposal_threads_one_active_per_pair" IS 'Ensures only one active negotiation thread per event-sponsor pair';



CREATE UNIQUE INDEX "proposal_threads_one_open" ON "sponsorship"."proposal_threads" USING "btree" ("event_id", "sponsor_id") WHERE ("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'counter'::"text"]));



COMMENT ON INDEX "sponsorship"."proposal_threads_one_open" IS 'Ensures only one open proposal thread per event-sponsor pair';



CREATE INDEX "sponsor_members_user_id_idx" ON "sponsorship"."sponsor_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sponsorship_matches_unique_active" ON "sponsorship"."sponsorship_matches" USING "btree" ("event_id", "sponsor_id") WHERE ("status" = ANY (ARRAY['pending'::"text", 'suggested'::"text", 'accepted'::"text"]));



COMMENT ON INDEX "sponsorship"."sponsorship_matches_unique_active" IS 'Ensures only one active match per event-sponsor pair';



CREATE INDEX "sponsorship_orders_event_id_status_idx" ON "sponsorship"."sponsorship_orders" USING "btree" ("event_id", "status");



CREATE INDEX "sponsorship_orders_sponsor_id_status_idx" ON "sponsorship"."sponsorship_orders" USING "btree" ("sponsor_id", "status");



CREATE INDEX "sponsorship_packages_event_id_idx" ON "sponsorship"."sponsorship_packages" USING "btree" ("event_id");



CREATE INDEX "idx_checkout_sessions_expires" ON "ticketing"."checkout_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_checkout_sessions_order" ON "ticketing"."checkout_sessions" USING "btree" ("order_id");



CREATE INDEX "idx_checkout_sessions_user" ON "ticketing"."checkout_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_guest_codes_code" ON "ticketing"."guest_codes" USING "btree" ("code");



CREATE INDEX "idx_guest_codes_event" ON "ticketing"."guest_codes" USING "btree" ("event_id");



CREATE INDEX "idx_guest_otp_expires" ON "ticketing"."guest_otp_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_guest_otp_lookup" ON "ticketing"."guest_otp_codes" USING "btree" ("method", "contact", "otp_hash");



CREATE INDEX "idx_guest_sessions_expires" ON "ticketing"."guest_ticket_sessions" USING "btree" ("expires_at");



CREATE INDEX "idx_guest_sessions_token" ON "ticketing"."guest_ticket_sessions" USING "btree" ("token_hash");



CREATE INDEX "idx_inventory_operations_tier_type" ON "ticketing"."inventory_operations" USING "btree" ("tier_id", "operation_type", "created_at" DESC);



CREATE INDEX "idx_order_items_order" ON "ticketing"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_event_status_created" ON "ticketing"."orders" USING "btree" ("event_id", "status", "created_at" DESC);



CREATE INDEX "idx_orders_event_user" ON "ticketing"."orders" USING "btree" ("event_id", "user_id");



CREATE INDEX "idx_orders_stripe_session" ON "ticketing"."orders" USING "btree" ("stripe_session_id") WHERE ("stripe_session_id" IS NOT NULL);



CREATE INDEX "idx_ticket_holds_expiry" ON "ticketing"."ticket_holds" USING "btree" ("status", "expires_at") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_ticket_holds_session_status" ON "ticketing"."ticket_holds" USING "btree" ("session_id", "status");



CREATE INDEX "idx_ticket_holds_tier_active" ON "ticketing"."ticket_holds" USING "btree" ("tier_id") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_ticket_holds_tier_status" ON "ticketing"."ticket_holds" USING "btree" ("tier_id", "status", "expires_at");



CREATE INDEX "idx_ticket_tiers_event" ON "ticketing"."ticket_tiers" USING "btree" ("event_id");



CREATE INDEX "idx_ticket_tiers_event_sort" ON "ticketing"."ticket_tiers" USING "btree" ("event_id", "status", "sort_index");



CREATE INDEX "idx_ticket_tiers_event_status" ON "ticketing"."ticket_tiers" USING "btree" ("event_id", "status");



CREATE INDEX "idx_ticket_tiers_inventory" ON "ticketing"."ticket_tiers" USING "btree" ("id", "reserved_quantity", "issued_quantity");



CREATE INDEX "idx_tickets_event_owner" ON "ticketing"."tickets" USING "btree" ("event_id", "owner_user_id");



CREATE INDEX "idx_tickets_event_status" ON "ticketing"."tickets" USING "btree" ("event_id", "status");



CREATE INDEX "idx_tickets_evt_status_owner" ON "ticketing"."tickets" USING "btree" ("event_id", "status", "owner_user_id");



CREATE INDEX "idx_tickets_evt_status_owner_created" ON "ticketing"."tickets" USING "btree" ("event_id", "status", "owner_user_id", "created_at" DESC);



CREATE INDEX "idx_tickets_owner" ON "ticketing"."tickets" USING "btree" ("owner_user_id", "status", "event_id");



CREATE INDEX "idx_tickets_owner_event_status" ON "ticketing"."tickets" USING "btree" ("owner_user_id", "event_id", "status");



CREATE INDEX "idx_tickets_qr_code" ON "ticketing"."tickets" USING "btree" ("qr_code");



CREATE INDEX "ix_tickets_event" ON "ticketing"."tickets" USING "btree" ("event_id");



CREATE INDEX "ix_tickets_order" ON "ticketing"."tickets" USING "btree" ("order_id");



CREATE INDEX "ix_tickets_tier" ON "ticketing"."tickets" USING "btree" ("tier_id");



CREATE UNIQUE INDEX "uniq_active_hold_session_tier" ON "ticketing"."ticket_holds" USING "btree" ("session_id", "tier_id") WHERE (("status" = 'active'::"text") AND ("session_id" IS NOT NULL));



CREATE UNIQUE INDEX "ux_orders_checkout_session_id" ON "ticketing"."orders" USING "btree" ("checkout_session_id") WHERE ("checkout_session_id" IS NOT NULL);



CREATE UNIQUE INDEX "ux_tickets_order_tier_serial" ON "ticketing"."tickets" USING "btree" ("order_id", "tier_id", "serial_no");



CREATE UNIQUE INDEX "ux_tickets_qr_code" ON "ticketing"."tickets" USING "btree" ("qr_code");



CREATE INDEX "idx_follows_follower" ON "users"."follows" USING "btree" ("follower_user_id");



CREATE INDEX "idx_follows_target" ON "users"."follows" USING "btree" ("target_type", "target_id");



CREATE INDEX "idx_follows_user_follower" ON "users"."follows" USING "btree" ("follower_user_id", "target_type") WHERE ("target_type" = 'user'::"public"."follow_target");



CREATE INDEX "idx_follows_user_status" ON "users"."follows" USING "btree" ("status", "target_type") WHERE ("target_type" = 'user'::"public"."follow_target");



CREATE INDEX "idx_follows_user_target" ON "users"."follows" USING "btree" ("follower_user_id", "target_type", "target_id");



CREATE INDEX "idx_user_profiles_social_links" ON "users"."user_profiles" USING "gin" ("social_links");



CREATE INDEX "idx_user_profiles_sponsor_mode" ON "users"."user_profiles" USING "btree" ("sponsor_mode_enabled");



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_default_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_default_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_default_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202404_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202404_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202404_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202405_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202405_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202405_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202406_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202406_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202406_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202407_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202407_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202407_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202408_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202408_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202408_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202409_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202409_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202409_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202410_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202410_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202410_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202411_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202411_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202411_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202412_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202412_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202412_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202501_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202501_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202501_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202502_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202502_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202502_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202503_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202503_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202503_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202504_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202504_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202504_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202505_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202505_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202505_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202506_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202506_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202506_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202507_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202507_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202507_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202508_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202508_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202508_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202509_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202509_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202509_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202510_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202510_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202510_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_event_impressions_p_event_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202511_event_id_created_at_idx";



ALTER INDEX "analytics"."event_impressions_p_pkey" ATTACH PARTITION "analytics"."event_impressions_p_202511_pkey";



ALTER INDEX "analytics"."idx_event_impressions_p_user_id_created_at" ATTACH PARTITION "analytics"."event_impressions_p_202511_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_default_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_default_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_default_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202404_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202404_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202404_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202405_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202405_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202405_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202406_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202406_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202406_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202407_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202407_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202407_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202408_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202408_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202408_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202409_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202409_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202409_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202410_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202410_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202410_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202411_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202411_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202411_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202412_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202412_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202412_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202501_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202501_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202501_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202502_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202502_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202502_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202503_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202503_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202503_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202504_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202504_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202504_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202505_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202505_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202505_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202506_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202506_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202506_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202507_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202507_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202507_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202508_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202508_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202508_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202509_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202509_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202509_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202510_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202510_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202510_user_id_created_at_idx";



ALTER INDEX "analytics"."idx_ticket_analytics_p_event_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202511_event_id_created_at_idx";



ALTER INDEX "analytics"."ticket_analytics_p_pkey" ATTACH PARTITION "analytics"."ticket_analytics_p_202511_pkey";



ALTER INDEX "analytics"."idx_ticket_analytics_p_user_id_created_at" ATTACH PARTITION "analytics"."ticket_analytics_p_202511_user_id_created_at_idx";



CREATE OR REPLACE VIEW "public"."messaging_inbox" AS
 SELECT "dc"."id",
    "dc"."subject",
    "dc"."request_status",
    "dc"."last_message_at",
    "dc"."created_at",
    "dc"."metadata",
    "jsonb_agg"("jsonb_build_object"('participant_type', "cp"."participant_type", 'participant_user_id', "cp"."participant_user_id", 'participant_org_id', "cp"."participant_org_id", 'joined_at', "cp"."joined_at", 'last_read_at', "cp"."last_read_at") ORDER BY "cp"."joined_at") AS "participants"
   FROM ("messaging"."direct_conversations" "dc"
     JOIN "messaging"."conversation_participants" "cp" ON (("cp"."conversation_id" = "dc"."id")))
  GROUP BY "dc"."id";



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "analytics"."event_audience_insights" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_queue_recalc_event_insights" AFTER INSERT OR UPDATE ON "analytics"."event_audience_insights" FOR EACH ROW EXECUTE FUNCTION "public"."fn_queue_recalc_on_event_insights"();



CREATE OR REPLACE TRIGGER "trigger_event_audience_insights_updated_at" BEFORE UPDATE ON "analytics"."event_audience_insights" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "ad_creatives_updated_at" BEFORE UPDATE ON "campaigns"."ad_creatives" FOR EACH ROW EXECUTE FUNCTION "public"."tg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "campaign_targeting_updated_at" BEFORE UPDATE ON "campaigns"."campaign_targeting" FOR EACH ROW EXECUTE FUNCTION "public"."tg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "campaigns_updated_at" BEFORE UPDATE ON "campaigns"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."tg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trg_credit_packages_updated_at" BEFORE UPDATE ON "campaigns"."credit_packages" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_promos_updated_at" BEFORE UPDATE ON "campaigns"."promos" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "event_comments_bump_counts" AFTER INSERT OR DELETE ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."trg_event_comments_bump_counts"();



CREATE OR REPLACE TRIGGER "event_reactions_bump_counts" AFTER INSERT OR DELETE ON "events"."event_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_event_reactions_bump_counts"();



CREATE OR REPLACE TRIGGER "handle_comment_count_trigger" AFTER INSERT OR DELETE ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_comment_count_change"();



CREATE OR REPLACE TRIGGER "refresh_search_docs_events" AFTER INSERT OR DELETE OR UPDATE ON "events"."events" FOR EACH STATEMENT EXECUTE FUNCTION "public"."touch_search_docs_mv"();



CREATE OR REPLACE TRIGGER "refresh_search_docs_posts" AFTER INSERT OR DELETE OR UPDATE ON "events"."event_posts" FOR EACH STATEMENT EXECUTE FUNCTION "public"."touch_search_docs_mv"();



CREATE OR REPLACE TRIGGER "trg_comment_count_del" AFTER DELETE ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_comment_count_change"();



CREATE OR REPLACE TRIGGER "trg_comment_count_ins" AFTER INSERT ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_comment_count_change"();



CREATE OR REPLACE TRIGGER "trg_comment_insert" AFTER INSERT ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."bump_reply_count"();



CREATE OR REPLACE TRIGGER "trg_event_reactions_like_del" AFTER DELETE ON "events"."event_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."_bump_like_count"();



CREATE OR REPLACE TRIGGER "trg_event_reactions_like_ins" AFTER INSERT ON "events"."event_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."_bump_like_count"();



CREATE OR REPLACE TRIGGER "trg_mark_event_completed" BEFORE UPDATE ON "events"."events" FOR EACH ROW EXECUTE FUNCTION "public"."mark_event_completed"();



CREATE OR REPLACE TRIGGER "trg_reaction_delete" AFTER DELETE ON "events"."event_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."decr_like_count"();



CREATE OR REPLACE TRIGGER "trg_reaction_insert" AFTER INSERT ON "events"."event_reactions" FOR EACH ROW EXECUTE FUNCTION "public"."bump_like_count"();



CREATE OR REPLACE TRIGGER "trg_touch_post" BEFORE UPDATE ON "events"."event_posts" FOR EACH ROW EXECUTE FUNCTION "public"."tg_touch_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_comment_count_on_delete" AFTER DELETE ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_comment_count"();



CREATE OR REPLACE TRIGGER "trigger_update_comment_count_on_insert" AFTER INSERT ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_comment_count"();



CREATE OR REPLACE TRIGGER "trigger_update_event_description_embedding" BEFORE INSERT OR UPDATE ON "events"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_description_embedding"();



CREATE OR REPLACE TRIGGER "update_comment_count_on_delete" AFTER DELETE ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_comment_count"();



CREATE OR REPLACE TRIGGER "update_comment_count_on_insert" AFTER INSERT ON "events"."event_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_comment_count"();



CREATE OR REPLACE TRIGGER "trg_direct_messages_refresh" AFTER INSERT ON "messaging"."direct_messages" FOR EACH ROW EXECUTE FUNCTION "public"."refresh_conversation_timestamp"();



CREATE OR REPLACE TRIGGER "trg_org_wallets_updated_at" BEFORE UPDATE ON "organizations"."org_wallets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_updated_at" BEFORE UPDATE ON "payments"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_wallets_updated_at" BEFORE UPDATE ON "payments"."wallets" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_circuit_breaker_state_updated_at" BEFORE UPDATE ON "public"."circuit_breaker_state" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_dead_letter_webhooks_updated_at" BEFORE UPDATE ON "public"."dead_letter_webhooks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."deliverables" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."package_templates" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."proposal_threads" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."sponsor_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."sponsor_public_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."sponsors" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at" BEFORE UPDATE ON "sponsorship"."sponsorship_packages" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_queue_recalc_sponsor_profiles" AFTER INSERT OR UPDATE ON "sponsorship"."sponsor_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."fn_queue_recalc_on_sponsor_profiles"();



CREATE OR REPLACE TRIGGER "trigger_increment_sponsorship_order_version" BEFORE UPDATE ON "sponsorship"."sponsorship_orders" FOR EACH ROW EXECUTE FUNCTION "public"."increment_sponsorship_order_version"();



CREATE OR REPLACE TRIGGER "trigger_sponsor_profiles_updated_at" BEFORE UPDATE ON "sponsorship"."sponsor_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_sponsorship_matches_updated_at" BEFORE UPDATE ON "sponsorship"."sponsorship_matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_update_sponsor_objectives_embedding" BEFORE INSERT OR UPDATE ON "sponsorship"."sponsor_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_sponsor_objectives_embedding"();



CREATE OR REPLACE TRIGGER "update_sponsorship_orders_updated_at" BEFORE UPDATE ON "sponsorship"."sponsorship_orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_sponsorship_orders_updated_at"();



CREATE OR REPLACE TRIGGER "block_delete_sold_tier" BEFORE DELETE ON "ticketing"."ticket_tiers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_block_tier_delete_if_tickets"();



CREATE OR REPLACE TRIGGER "block_price_change_after_sale" BEFORE UPDATE ON "ticketing"."ticket_tiers" FOR EACH ROW EXECUTE FUNCTION "public"."trg_block_tier_price_change_after_sale"();



CREATE OR REPLACE TRIGGER "set_updated_at_checkout_sessions" BEFORE UPDATE ON "ticketing"."checkout_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_assign_serial_no" BEFORE INSERT ON "ticketing"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_assign_serial_no"();



CREATE OR REPLACE TRIGGER "trg_release_capacity" AFTER DELETE ON "ticketing"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_release_tier_capacity"();



CREATE OR REPLACE TRIGGER "trg_reserve_capacity" BEFORE INSERT ON "ticketing"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."trg_reserve_tier_capacity"();



CREATE OR REPLACE TRIGGER "trg_ticket_counts" AFTER INSERT OR DELETE ON "ticketing"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."tg_ticket_counts"();



CREATE OR REPLACE TRIGGER "trg_notify_user_follow" AFTER INSERT OR UPDATE ON "users"."follows" FOR EACH ROW EXECUTE FUNCTION "public"."notify_user_follow"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "users"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "analytics"."audience_consents"
    ADD CONSTRAINT "audience_consents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."event_audience_insights"
    ADD CONSTRAINT "event_audience_insights_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."event_impressions"
    ADD CONSTRAINT "event_impressions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE "analytics"."event_impressions_p"
    ADD CONSTRAINT "event_impressions_p_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id");



ALTER TABLE "analytics"."event_impressions_p"
    ADD CONSTRAINT "event_impressions_p_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "analytics"."event_impressions"
    ADD CONSTRAINT "event_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "analytics"."event_stat_snapshots"
    ADD CONSTRAINT "event_stat_snapshots_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."event_video_counters"
    ADD CONSTRAINT "event_video_counters_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."negative_feedback"
    ADD CONSTRAINT "negative_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."post_impressions"
    ADD CONSTRAINT "post_impressions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."post_impressions"
    ADD CONSTRAINT "post_impressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "analytics"."post_video_counters"
    ADD CONSTRAINT "post_video_counters_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."reports"
    ADD CONSTRAINT "reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "analytics"."ticket_analytics"
    ADD CONSTRAINT "ticket_analytics_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE "analytics"."ticket_analytics_p"
    ADD CONSTRAINT "ticket_analytics_p_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id");



ALTER TABLE "analytics"."ticket_analytics_p"
    ADD CONSTRAINT "ticket_analytics_p_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id");



ALTER TABLE "analytics"."ticket_analytics_p"
    ADD CONSTRAINT "ticket_analytics_p_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "analytics"."ticket_analytics"
    ADD CONSTRAINT "ticket_analytics_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."ticket_analytics"
    ADD CONSTRAINT "ticket_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."user_event_interactions"
    ADD CONSTRAINT "user_event_interactions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."ad_clicks"
    ADD CONSTRAINT "ad_clicks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."ad_clicks"
    ADD CONSTRAINT "ad_clicks_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "campaigns"."ad_creatives"("id");



ALTER TABLE ONLY "campaigns"."ad_clicks"
    ADD CONSTRAINT "ad_clicks_impression_id_fkey" FOREIGN KEY ("impression_id") REFERENCES "campaigns"."ad_impressions"("id");



ALTER TABLE ONLY "campaigns"."ad_clicks"
    ADD CONSTRAINT "ad_clicks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id");



ALTER TABLE ONLY "campaigns"."ad_creatives"
    ADD CONSTRAINT "ad_creatives_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."ad_creatives"
    ADD CONSTRAINT "ad_creatives_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id");



ALTER TABLE ONLY "campaigns"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "campaigns"."ad_creatives"("id");



ALTER TABLE ONLY "campaigns"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id");



ALTER TABLE ONLY "campaigns"."ad_impressions"
    ADD CONSTRAINT "ad_impressions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id");



ALTER TABLE ONLY "campaigns"."ad_spend_ledger"
    ADD CONSTRAINT "ad_spend_ledger_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "campaigns"."ad_creatives"("id");



ALTER TABLE ONLY "campaigns"."ad_spend_ledger"
    ADD CONSTRAINT "ad_spend_ledger_org_wallet_id_fkey" FOREIGN KEY ("org_wallet_id") REFERENCES "organizations"."org_wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "campaigns"."ad_spend_ledger"
    ADD CONSTRAINT "ad_spend_ledger_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."ad_spend_ledger"
    ADD CONSTRAINT "ad_spend_ledger_wallet_transaction_id_fkey" FOREIGN KEY ("wallet_transaction_id") REFERENCES "payments"."wallet_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "campaigns"."campaign_placements"
    ADD CONSTRAINT "campaign_placements_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."campaign_targeting"
    ADD CONSTRAINT "campaign_targeting_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "campaigns"."campaigns"
    ADD CONSTRAINT "campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."cultural_guides"
    ADD CONSTRAINT "cultural_guides_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_comment_reactions"
    ADD CONSTRAINT "event_comment_reactions_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "events"."event_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_comment_reactions"
    ADD CONSTRAINT "event_comment_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_comments"
    ADD CONSTRAINT "event_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "events"."event_comments"
    ADD CONSTRAINT "event_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_invites"
    ADD CONSTRAINT "event_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "event_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "event_posts_author_user_id_user_profiles_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "event_posts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "event_posts_ticket_tier_id_fkey" FOREIGN KEY ("ticket_tier_id") REFERENCES "ticketing"."ticket_tiers"("id");



ALTER TABLE ONLY "events"."event_reactions"
    ADD CONSTRAINT "event_reactions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_reactions"
    ADD CONSTRAINT "event_reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_roles"
    ADD CONSTRAINT "event_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "events"."event_roles"
    ADD CONSTRAINT "event_roles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_roles"
    ADD CONSTRAINT "event_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_scanners"
    ADD CONSTRAINT "event_scanners_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_scanners"
    ADD CONSTRAINT "event_scanners_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "events"."event_scanners"
    ADD CONSTRAINT "event_scanners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_series"
    ADD CONSTRAINT "event_series_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_share_assets"
    ADD CONSTRAINT "event_share_assets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."events"
    ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."events"
    ADD CONSTRAINT "events_owner_context_id_fkey" FOREIGN KEY ("owner_context_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."events"
    ADD CONSTRAINT "events_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "events"."event_series"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "events"."event_comments"
    ADD CONSTRAINT "fk_event_comments_author_user_id" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_comments"
    ADD CONSTRAINT "fk_event_comments_post_id" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "fk_event_posts_author_user_id" FOREIGN KEY ("author_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "fk_event_posts_event_id" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_posts"
    ADD CONSTRAINT "fk_event_posts_ticket_tier_id" FOREIGN KEY ("ticket_tier_id") REFERENCES "ticketing"."ticket_tiers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "events"."event_reactions"
    ADD CONSTRAINT "fk_event_reactions_post_id" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."event_reactions"
    ADD CONSTRAINT "fk_event_reactions_user_id" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."media_assets"
    ADD CONSTRAINT "media_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "events"."post_hashtags"
    ADD CONSTRAINT "post_hashtags_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."post_hashtags"
    ADD CONSTRAINT "post_hashtags_tag_fkey" FOREIGN KEY ("tag") REFERENCES "events"."hashtags"("tag") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."post_media"
    ADD CONSTRAINT "post_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "events"."media_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."post_media"
    ADD CONSTRAINT "post_media_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."post_mentions"
    ADD CONSTRAINT "post_mentions_mentioned_user_id_fkey" FOREIGN KEY ("mentioned_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "events"."post_mentions"
    ADD CONSTRAINT "post_mentions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "events"."event_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."role_invites"
    ADD CONSTRAINT "role_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "events"."role_invites"
    ADD CONSTRAINT "role_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "messaging"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."direct_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_participant_org_id_fkey" FOREIGN KEY ("participant_org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_participant_user_id_fkey" FOREIGN KEY ("participant_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."direct_conversations"
    ADD CONSTRAINT "direct_conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "messaging"."direct_messages"
    ADD CONSTRAINT "direct_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."direct_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_org_id_fkey" FOREIGN KEY ("sender_org_id") REFERENCES "organizations"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "messaging"."direct_messages"
    ADD CONSTRAINT "direct_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "messaging"."message_job_recipients"
    ADD CONSTRAINT "message_job_recipients_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "messaging"."message_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."message_job_recipients"
    ADD CONSTRAINT "message_job_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "messaging"."message_jobs"
    ADD CONSTRAINT "message_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "messaging"."message_jobs"
    ADD CONSTRAINT "message_jobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."message_jobs"
    ADD CONSTRAINT "message_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "messaging"."message_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "messaging"."message_templates"
    ADD CONSTRAINT "message_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "messaging"."message_templates"
    ADD CONSTRAINT "message_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "messaging"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_memberships"
    ADD CONSTRAINT "fk_org_memberships_org_id" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_contact_import_entries"
    ADD CONSTRAINT "org_contact_import_entries_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "organizations"."org_contact_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_contact_imports"
    ADD CONSTRAINT "org_contact_imports_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "organizations"."org_contact_imports"
    ADD CONSTRAINT "org_contact_imports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_invitations"
    ADD CONSTRAINT "org_invitations_accepted_user_id_fkey" FOREIGN KEY ("accepted_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "organizations"."org_invitations"
    ADD CONSTRAINT "org_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "organizations"."org_invitations"
    ADD CONSTRAINT "org_invitations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_memberships"
    ADD CONSTRAINT "org_memberships_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_memberships"
    ADD CONSTRAINT "org_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_wallet_transactions"
    ADD CONSTRAINT "org_wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "organizations"."org_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."org_wallets"
    ADD CONSTRAINT "org_wallets_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "organizations"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "organizations"."payout_configurations"
    ADD CONSTRAINT "payout_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "payments"."credit_lots"
    ADD CONSTRAINT "credit_lots_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "payments"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "payments"."credit_lots"
    ADD CONSTRAINT "credit_lots_org_wallet_id_fkey" FOREIGN KEY ("org_wallet_id") REFERENCES "organizations"."org_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "payments"."credit_lots"
    ADD CONSTRAINT "credit_lots_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "payments"."invoices"
    ADD CONSTRAINT "invoices_org_wallet_id_fkey" FOREIGN KEY ("org_wallet_id") REFERENCES "organizations"."org_wallets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "payments"."invoices"
    ADD CONSTRAINT "invoices_purchased_by_user_id_fkey" FOREIGN KEY ("purchased_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "payments"."invoices"
    ADD CONSTRAINT "invoices_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "payments"."payout_queue"
    ADD CONSTRAINT "payout_queue_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sponsorship"."sponsorship_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "payments"."wallet_transactions"
    ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "payments"."wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "payments"."wallets"
    ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pgbench_tiers"
    ADD CONSTRAINT "pgbench_tiers_id_fkey" FOREIGN KEY ("id") REFERENCES "ticketing"."ticket_tiers"("id");



ALTER TABLE ONLY "ref"."event_categories"
    ADD CONSTRAINT "event_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "ref"."event_categories"("id");



ALTER TABLE ONLY "sponsorship"."deliverable_proofs"
    ADD CONSTRAINT "deliverable_proofs_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "sponsorship"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."deliverable_proofs"
    ADD CONSTRAINT "deliverable_proofs_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."deliverables"
    ADD CONSTRAINT "deliverables_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."deliverables"
    ADD CONSTRAINT "deliverables_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sponsorship"."sponsorship_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."deliverables"
    ADD CONSTRAINT "deliverables_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "sponsorship"."sponsorship_packages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sponsorship"."deliverables"
    ADD CONSTRAINT "deliverables_package_variant_id_fkey" FOREIGN KEY ("package_variant_id") REFERENCES "sponsorship"."package_variants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sponsorship"."deliverables"
    ADD CONSTRAINT "deliverables_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."event_sponsorships"
    ADD CONSTRAINT "event_sponsorships_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."event_sponsorships"
    ADD CONSTRAINT "event_sponsorships_sla_id_fkey" FOREIGN KEY ("sla_id") REFERENCES "sponsorship"."sponsorship_slas"("id");



ALTER TABLE ONLY "sponsorship"."event_sponsorships"
    ADD CONSTRAINT "event_sponsorships_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."match_features"
    ADD CONSTRAINT "match_features_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."match_features"
    ADD CONSTRAINT "match_features_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."match_feedback"
    ADD CONSTRAINT "match_feedback_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."match_feedback"
    ADD CONSTRAINT "match_feedback_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."match_feedback"
    ADD CONSTRAINT "match_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."package_templates"
    ADD CONSTRAINT "package_templates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."package_variants"
    ADD CONSTRAINT "package_variants_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "sponsorship"."sponsorship_packages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."package_variants"
    ADD CONSTRAINT "package_variants_stat_snapshot_id_fkey" FOREIGN KEY ("stat_snapshot_id") REFERENCES "analytics"."event_stat_snapshots"("id");



ALTER TABLE ONLY "sponsorship"."proposal_messages"
    ADD CONSTRAINT "proposal_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."proposal_messages"
    ADD CONSTRAINT "proposal_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "sponsorship"."proposal_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."proposal_threads"
    ADD CONSTRAINT "proposal_threads_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."proposal_threads"
    ADD CONSTRAINT "proposal_threads_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."proposal_threads"
    ADD CONSTRAINT "proposal_threads_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsor_members"
    ADD CONSTRAINT "sponsor_members_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsor_members"
    ADD CONSTRAINT "sponsor_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsor_profiles"
    ADD CONSTRAINT "sponsor_profiles_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsor_public_profiles"
    ADD CONSTRAINT "sponsor_public_profiles_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsors"
    ADD CONSTRAINT "sponsors_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_matches"
    ADD CONSTRAINT "sponsorship_matches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsorship_matches"
    ADD CONSTRAINT "sponsorship_matches_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "payments"."invoices"("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_last_modified_by_fkey" FOREIGN KEY ("last_modified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "sponsorship"."sponsorship_packages"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "sponsorship"."sponsorship_orders"
    ADD CONSTRAINT "sponsorship_orders_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "sponsorship"."sponsorship_packages"
    ADD CONSTRAINT "sponsorship_packages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsorship_packages"
    ADD CONSTRAINT "sponsorship_packages_stat_snapshot_id_fkey" FOREIGN KEY ("stat_snapshot_id") REFERENCES "analytics"."event_stat_snapshots"("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_packages"
    ADD CONSTRAINT "sponsorship_packages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "sponsorship"."package_templates"("id");



ALTER TABLE ONLY "sponsorship"."sponsorship_payouts"
    ADD CONSTRAINT "sponsorship_payouts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sponsorship"."sponsorship_orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "sponsorship"."sponsorship_payouts"
    ADD CONSTRAINT "sponsorship_payouts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsorship_slas"
    ADD CONSTRAINT "sponsorship_slas_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "sponsorship"."deliverables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "sponsorship"."sponsorship_slas"
    ADD CONSTRAINT "sponsorship_slas_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "sponsorship"."sponsorship_slas"
    ADD CONSTRAINT "sponsorship_slas_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsorship"."sponsors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "ticketing"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "ticketing"."checkout_sessions"
    ADD CONSTRAINT "checkout_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "ticketing"."order_items"
    ADD CONSTRAINT "fk_order_items_order_id" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."order_items"
    ADD CONSTRAINT "fk_order_items_tier_id" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."orders"
    ADD CONSTRAINT "fk_orders_event_id" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."ticket_tiers"
    ADD CONSTRAINT "fk_ticket_tiers_event_id" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "fk_tickets_event_id" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "fk_tickets_orders" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "fk_tickets_tier_id" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "fk_tickets_tiers" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id");



ALTER TABLE ONLY "ticketing"."inventory_operations"
    ADD CONSTRAINT "inventory_operations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id");



ALTER TABLE ONLY "ticketing"."inventory_operations"
    ADD CONSTRAINT "inventory_operations_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id");



ALTER TABLE ONLY "ticketing"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."order_items"
    ADD CONSTRAINT "order_items_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id");



ALTER TABLE ONLY "ticketing"."orders"
    ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "ticketing"."refunds"
    ADD CONSTRAINT "refunds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "ticketing"."refunds"
    ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."scan_logs"
    ADD CONSTRAINT "scan_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."scan_logs"
    ADD CONSTRAINT "scan_logs_scanner_user_id_fkey" FOREIGN KEY ("scanner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "ticketing"."scan_logs"
    ADD CONSTRAINT "scan_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticketing"."tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "ticketing"."ticket_holds"
    ADD CONSTRAINT "ticket_holds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id");



ALTER TABLE ONLY "ticketing"."ticket_holds"
    ADD CONSTRAINT "ticket_holds_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."ticket_tiers"
    ADD CONSTRAINT "ticket_tiers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ticketing"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "tickets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "ticketing"."tickets"
    ADD CONSTRAINT "tickets_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "ticketing"."ticket_tiers"("id");



ALTER TABLE ONLY "users"."follows"
    ADD CONSTRAINT "follows_follower_org_id_fkey" FOREIGN KEY ("follower_org_id") REFERENCES "organizations"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "users"."follows"
    ADD CONSTRAINT "follows_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "users"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous impression tracking" ON "analytics"."event_impressions" FOR INSERT TO "anon" WITH CHECK ((("user_id" IS NULL) AND ("session_id" IS NOT NULL)));



CREATE POLICY "Event managers can view interactions for their events" ON "analytics"."user_event_interactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "user_event_interactions"."event_id") AND "public"."is_event_manager"("e"."id")))));



CREATE POLICY "Organizers can view event analytics" ON "analytics"."ticket_analytics" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "events"."events"
  WHERE (("events"."id" = "ticket_analytics"."event_id") AND ("events"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own negative feedback" ON "analytics"."negative_feedback" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own analytics" ON "analytics"."ticket_analytics" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own event impressions" ON "analytics"."event_impressions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own interactions" ON "analytics"."user_event_interactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own event impressions" ON "analytics"."event_impressions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read their own post impressions" ON "analytics"."post_impressions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view event insights" ON "analytics"."event_audience_insights" FOR SELECT USING (true);



CREATE POLICY "Users can view stat snapshots" ON "analytics"."event_stat_snapshots" FOR SELECT USING (true);



CREATE POLICY "Users can view their own analytics" ON "analytics"."ticket_analytics" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own interactions" ON "analytics"."user_event_interactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "allow_analytics_insert" ON "analytics"."analytics_events" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow_analytics_read_own" ON "analytics"."analytics_events" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."role"() = 'service_role'::"text") OR (("event_id" IS NOT NULL) AND "public"."is_event_manager"("event_id"))));



CREATE POLICY "allow_analytics_update_system" ON "analytics"."analytics_events" FOR UPDATE USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



ALTER TABLE "analytics"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."audience_consents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "counters_select_manager" ON "analytics"."event_video_counters" FOR SELECT USING ("public"."is_event_manager"("event_id"));



CREATE POLICY "counters_update_system" ON "analytics"."event_video_counters" USING (true) WITH CHECK (true);



ALTER TABLE "analytics"."event_audience_insights" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."event_impressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."event_stat_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."event_video_counters" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."negative_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."post_clicks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_clicks_insert_any" ON "analytics"."post_clicks" FOR INSERT WITH CHECK (true);



CREATE POLICY "post_clicks_select_manager" ON "analytics"."post_clicks" FOR SELECT USING ("public"."is_event_manager"("event_id"));



ALTER TABLE "analytics"."post_impressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."post_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "post_views_insert_any" ON "analytics"."post_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "post_views_select_manager" ON "analytics"."post_views" FOR SELECT USING ("public"."is_event_manager"("event_id"));



ALTER TABLE "analytics"."reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reports_deny_read" ON "analytics"."reports" FOR SELECT USING (false);



CREATE POLICY "reports_insert_any" ON "analytics"."reports" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



ALTER TABLE "analytics"."share_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "share_links_insert_auth" ON "analytics"."share_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "share_links_public_read" ON "analytics"."share_links" FOR SELECT USING (true);



ALTER TABLE "analytics"."ticket_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."user_event_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "campaigns"."ad_clicks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ad_clicks_insert_service" ON "campaigns"."ad_clicks" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_service_role"());



CREATE POLICY "ad_clicks_select" ON "campaigns"."ad_clicks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "ad_clicks"."campaign_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "campaigns"."ad_creatives" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ad_creatives_manage" ON "campaigns"."ad_creatives" USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "ad_creatives"."campaign_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



CREATE POLICY "ad_creatives_select" ON "campaigns"."ad_creatives" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "ad_creatives"."campaign_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "campaigns"."ad_impressions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ad_impressions_insert_service" ON "campaigns"."ad_impressions" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_service_role"());



CREATE POLICY "ad_impressions_select" ON "campaigns"."ad_impressions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "ad_impressions"."campaign_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "ad_spend_insert_system" ON "campaigns"."ad_spend_ledger" FOR INSERT WITH CHECK (true);



ALTER TABLE "campaigns"."ad_spend_ledger" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ad_spend_select_own" ON "campaigns"."ad_spend_ledger" FOR SELECT USING (("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))));



ALTER TABLE "campaigns"."campaign_placements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_placements_manage" ON "campaigns"."campaign_placements" USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "campaign_placements"."campaign_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



CREATE POLICY "campaign_placements_select" ON "campaigns"."campaign_placements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "campaign_placements"."campaign_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "campaigns"."campaign_targeting" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_targeting_manage" ON "campaigns"."campaign_targeting" USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "campaign_targeting"."campaign_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



CREATE POLICY "campaign_targeting_select" ON "campaigns"."campaign_targeting" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("campaigns"."campaigns" "c"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "c"."org_id")))
  WHERE (("c"."id" = "campaign_targeting"."campaign_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "campaigns"."campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaigns_insert_org_editor" ON "campaigns"."campaigns" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships"
  WHERE (("org_memberships"."org_id" = "campaigns"."org_id") AND ("org_memberships"."user_id" = "auth"."uid"()) AND ("org_memberships"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



CREATE POLICY "campaigns_select_org_member" ON "campaigns"."campaigns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships"
  WHERE (("org_memberships"."org_id" = "campaigns"."org_id") AND ("org_memberships"."user_id" = "auth"."uid"())))));



CREATE POLICY "campaigns_update_org_editor" ON "campaigns"."campaigns" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships"
  WHERE (("org_memberships"."org_id" = "campaigns"."org_id") AND ("org_memberships"."user_id" = "auth"."uid"()) AND ("org_memberships"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



ALTER TABLE "campaigns"."credit_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_packages_select_all" ON "campaigns"."credit_packages" FOR SELECT USING (("is_active" = true));



ALTER TABLE "campaigns"."promos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promos_select_all" ON "campaigns"."promos" FOR SELECT USING (((("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" >= "now"()))));



CREATE POLICY "comment_reacts_delete_own" ON "events"."event_comment_reactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "comment_reacts_insert_own" ON "events"."event_comment_reactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "comment_reacts_read_all" ON "events"."event_comment_reactions" FOR SELECT USING (true);



ALTER TABLE "events"."cultural_guides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cultural_guides_select_with_event" ON "events"."cultural_guides" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "cultural_guides"."event_id") AND (("e"."visibility" = 'public'::"public"."event_visibility") OR "public"."is_event_manager"("e"."id"))))));



CREATE POLICY "cultural_guides_write_manager" ON "events"."cultural_guides" USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "cultural_guides"."event_id") AND "public"."is_event_manager"("e"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "cultural_guides"."event_id") AND "public"."is_event_manager"("e"."id")))));



ALTER TABLE "events"."event_comment_reactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "events"."event_comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_comments_delete" ON "events"."event_comments" FOR DELETE USING (("author_user_id" = "auth"."uid"()));



CREATE POLICY "event_comments_delete_author_or_manager" ON "events"."event_comments" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND (("author_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "events"."event_posts" "p"
  WHERE (("p"."id" = "event_comments"."post_id") AND "public"."is_event_manager"("p"."event_id")))))));



CREATE POLICY "event_comments_insert" ON "events"."event_comments" FOR INSERT WITH CHECK (("author_user_id" = "auth"."uid"()));



CREATE POLICY "event_comments_insert_authorized" ON "events"."event_comments" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND ("author_user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("events"."event_posts" "p"
     JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
  WHERE (("p"."id" = "event_comments"."post_id") AND "public"."can_current_user_post"("e"."id") AND ("p"."deleted_at" IS NULL))))));



CREATE POLICY "event_comments_select" ON "events"."event_comments" FOR SELECT USING (("post_id" IN ( SELECT "event_posts"."id"
   FROM "events"."event_posts"
  WHERE ("event_posts"."event_id" IN ( SELECT "events"."id"
           FROM "events"."events"
          WHERE ("events"."visibility" = 'public'::"public"."event_visibility"))))));



CREATE POLICY "event_comments_select_public_or_access" ON "events"."event_comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("events"."event_posts" "p"
     JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
  WHERE (("p"."id" = "event_comments"."post_id") AND (("e"."visibility" = 'public'::"public"."event_visibility") OR (("auth"."role"() = 'authenticated'::"text") AND ("public"."can_current_user_post"("e"."id") OR ("e"."visibility" = 'unlisted'::"public"."event_visibility")))) AND ("p"."deleted_at" IS NULL)))));



CREATE POLICY "event_comments_update" ON "events"."event_comments" FOR UPDATE USING (("author_user_id" = "auth"."uid"()));



CREATE POLICY "event_comments_update_author_or_manager" ON "events"."event_comments" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND (("author_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "events"."event_posts" "p"
  WHERE (("p"."id" = "event_comments"."post_id") AND "public"."is_event_manager"("p"."event_id"))))))) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND (("author_user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "events"."event_posts" "p"
  WHERE (("p"."id" = "event_comments"."post_id") AND "public"."is_event_manager"("p"."event_id")))))));



ALTER TABLE "events"."event_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_invites_manage_creator" ON "events"."event_invites" USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "event_invites"."event_id") AND ("e"."created_by" = "auth"."uid"())))));



CREATE POLICY "event_invites_manage_individual_owner" ON "events"."event_invites" USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "event_invites"."event_id") AND ("e"."owner_context_type" = 'individual'::"public"."owner_context") AND ("e"."owner_context_id" = "auth"."uid"())))));



CREATE POLICY "event_invites_manage_org_admin" ON "events"."event_invites" USING ((EXISTS ( SELECT 1
   FROM ("events"."events" "e"
     JOIN "organizations"."org_memberships" "m" ON (("m"."org_id" = "e"."owner_context_id")))
  WHERE (("e"."id" = "event_invites"."event_id") AND ("e"."owner_context_type" = 'organization'::"public"."owner_context") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



ALTER TABLE "events"."event_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_posts_delete" ON "events"."event_posts" FOR DELETE USING (("author_user_id" = "auth"."uid"()));



CREATE POLICY "event_posts_delete_author_or_manager" ON "events"."event_posts" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND (("author_user_id" = "auth"."uid"()) OR "public"."is_event_manager"("event_id"))));



CREATE POLICY "event_posts_insert" ON "events"."event_posts" FOR INSERT WITH CHECK (("author_user_id" = "auth"."uid"()));



CREATE POLICY "event_posts_insert_authorized" ON "events"."event_posts" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND ("author_user_id" = "auth"."uid"()) AND "public"."can_current_user_post"("event_id")));



CREATE POLICY "event_posts_read_public_events" ON "events"."event_posts" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "event_posts"."event_id") AND ("e"."visibility" = 'public'::"public"."event_visibility") AND ("event_posts"."deleted_at" IS NULL)))));



CREATE POLICY "event_posts_select" ON "events"."event_posts" FOR SELECT USING ((("event_id" IN ( SELECT "events"."id"
   FROM "events"."events"
  WHERE ("events"."visibility" = 'public'::"public"."event_visibility"))) OR ("event_id" IN ( SELECT "e"."id"
   FROM "events"."events" "e"
  WHERE ("e"."owner_context_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"())))))));



CREATE POLICY "event_posts_select_public_or_access" ON "events"."event_posts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "event_posts"."event_id") AND (("e"."visibility" = 'public'::"public"."event_visibility") OR (("auth"."role"() = 'authenticated'::"text") AND ("public"."can_current_user_post"("e"."id") OR ("e"."visibility" = 'unlisted'::"public"."event_visibility")))) AND ("event_posts"."deleted_at" IS NULL)))));



CREATE POLICY "event_posts_update" ON "events"."event_posts" FOR UPDATE USING (("author_user_id" = "auth"."uid"()));



CREATE POLICY "event_posts_update_author_or_manager" ON "events"."event_posts" FOR UPDATE USING ((("auth"."role"() = 'authenticated'::"text") AND (("author_user_id" = "auth"."uid"()) OR "public"."is_event_manager"("event_id")))) WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND (("author_user_id" = "auth"."uid"()) OR "public"."is_event_manager"("event_id"))));



ALTER TABLE "events"."event_reactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_reactions_delete_self" ON "events"."event_reactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "event_reactions_insert_self" ON "events"."event_reactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "event_reactions_own" ON "events"."event_reactions" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "event_reactions_select" ON "events"."event_reactions" FOR SELECT USING (true);



CREATE POLICY "event_reactions_select_all" ON "events"."event_reactions" FOR SELECT USING (true);



ALTER TABLE "events"."event_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "events"."event_scanners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_scanners_manage_by_org" ON "events"."event_scanners" USING ("public"."is_event_manager"("event_id")) WITH CHECK ("public"."is_event_manager"("event_id"));



CREATE POLICY "event_scanners_read_self" ON "events"."event_scanners" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_event_manager"("event_id") OR "public"."is_event_org_editor"("event_id")));



ALTER TABLE "events"."event_series" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "events"."event_share_assets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "events"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_insert_owner_or_editor" ON "events"."events" FOR INSERT WITH CHECK (((("owner_context_type" = 'individual'::"public"."owner_context") AND ("owner_context_id" = "auth"."uid"())) OR (("owner_context_type" = 'organization'::"public"."owner_context") AND "public"."is_org_role"("owner_context_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"]))));



CREATE POLICY "events_read_access" ON "events"."events" FOR SELECT USING ((("visibility" = 'public'::"public"."event_visibility") OR (("auth"."role"() = 'authenticated'::"text") AND ("visibility" = 'unlisted'::"public"."event_visibility")) OR (("auth"."uid"() IS NOT NULL) AND ("created_by" = "auth"."uid"())) OR (("auth"."uid"() IS NOT NULL) AND ("owner_context_type" = 'individual'::"public"."owner_context") AND ("owner_context_id" = "auth"."uid"())) OR (("auth"."uid"() IS NOT NULL) AND ("owner_context_type" = 'organization'::"public"."owner_context") AND (EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "events"."owner_context_id") AND ("m"."user_id" = "auth"."uid"()))))) OR (("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "ticketing"."tickets" "t"
  WHERE (("t"."event_id" = "events"."id") AND ("t"."owner_user_id" = "auth"."uid"()) AND ("t"."status" = ANY (ARRAY['issued'::"public"."ticket_status", 'transferred'::"public"."ticket_status", 'redeemed'::"public"."ticket_status"]))))))));



CREATE POLICY "events_update_owner_or_editor" ON "events"."events" FOR UPDATE USING ("public"."is_event_manager"("id")) WITH CHECK ("public"."is_event_manager"("id"));



CREATE POLICY "invited can read own" ON "events"."event_invites" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "modify_event_roles_as_admin" ON "events"."event_roles" USING ("public"."is_event_manager"("event_id"));



CREATE POLICY "modify_invites_as_admin" ON "events"."role_invites" USING ("public"."is_event_manager"("event_id"));



CREATE POLICY "org_events_all" ON "events"."events" USING (("owner_context_id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE ("org_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_events_select" ON "events"."events" FOR SELECT USING (("owner_context_id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE ("org_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "public_events_select" ON "events"."events" FOR SELECT USING (("visibility" = 'public'::"public"."event_visibility"));



CREATE POLICY "reactions_delete_self" ON "events"."event_reactions" FOR DELETE USING ((("auth"."role"() = 'authenticated'::"text") AND ("user_id" = "auth"."uid"())));



CREATE POLICY "reactions_insert_access" ON "events"."event_reactions" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND ("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM ("events"."event_posts" "p"
     JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
  WHERE (("p"."id" = "event_reactions"."post_id") AND ("p"."deleted_at" IS NULL) AND (("e"."visibility" = 'public'::"public"."event_visibility") OR "public"."can_current_user_post"("p"."event_id") OR ("e"."visibility" = 'unlisted'::"public"."event_visibility")))))));



CREATE POLICY "reactions_read_public_or_access" ON "events"."event_reactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("events"."event_posts" "p"
     JOIN "events"."events" "e" ON (("e"."id" = "p"."event_id")))
  WHERE (("p"."id" = "event_reactions"."post_id") AND ("p"."deleted_at" IS NULL) AND (("e"."visibility" = 'public'::"public"."event_visibility") OR (("auth"."role"() = 'authenticated'::"text") AND ("public"."can_current_user_post"("p"."event_id") OR ("e"."visibility" = 'unlisted'::"public"."event_visibility"))))))));



CREATE POLICY "read_invites_as_admin" ON "events"."role_invites" FOR SELECT USING ("public"."is_event_manager"("event_id"));



ALTER TABLE "events"."role_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_my_event_roles" ON "events"."event_roles" FOR SELECT USING ((("auth"."uid"() = "user_id") OR "public"."is_event_manager"("event_id")));



CREATE POLICY "series_insert_org" ON "events"."event_series" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "event_series"."organization_id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."role" = ANY (ARRAY['editor'::"public"."org_role", 'admin'::"public"."org_role", 'owner'::"public"."org_role"]))))));



CREATE POLICY "series_read_org" ON "events"."event_series" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "event_series"."organization_id") AND ("m"."user_id" = "auth"."uid"())))));



CREATE POLICY "series_update_org" ON "events"."event_series" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "event_series"."organization_id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."role" = ANY (ARRAY['editor'::"public"."org_role", 'admin'::"public"."org_role", 'owner'::"public"."org_role"]))))));



CREATE POLICY "share_assets_manage_org" ON "events"."event_share_assets" TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "events"."events" "ev"
  WHERE (("ev"."id" = "event_share_assets"."event_id") AND (("ev"."created_by" = "auth"."uid"()) OR (("ev"."owner_context_type" = 'organization'::"public"."owner_context") AND (EXISTS ( SELECT 1
           FROM "organizations"."org_memberships" "om"
          WHERE (("om"."org_id" = "ev"."owner_context_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"])))))))))))) WITH CHECK (true);



CREATE POLICY "share_assets_read_public" ON "events"."event_share_assets" FOR SELECT USING ((("active" = true) AND (EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "event_share_assets"."event_id") AND ("e"."visibility" = 'public'::"public"."event_visibility"))))));



CREATE POLICY "Users can delete their notifications" ON "messaging"."notifications" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their notifications" ON "messaging"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their notifications" ON "messaging"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their notifications" ON "messaging"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "conversation_insert" ON "messaging"."direct_conversations" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "conversation_messages_select" ON "messaging"."direct_messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversation_participants"."conversation_id"
   FROM "messaging"."conversation_participants"
  WHERE ("conversation_participants"."participant_user_id" = "auth"."uid"()))));



CREATE POLICY "conversation_participant_insert" ON "messaging"."conversation_participants" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "conversation_participant_view" ON "messaging"."conversation_participants" FOR SELECT USING (((("participant_type" = 'user'::"public"."conversation_participant_type") AND ("participant_user_id" = "auth"."uid"())) OR (("participant_type" = 'organization'::"public"."conversation_participant_type") AND ("participant_org_id" IS NOT NULL))));



ALTER TABLE "messaging"."conversation_participants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversation_participants_select" ON "messaging"."direct_conversations" FOR SELECT USING (("id" IN ( SELECT "conversation_participants"."conversation_id"
   FROM "messaging"."conversation_participants"
  WHERE ("conversation_participants"."participant_user_id" = "auth"."uid"()))));



CREATE POLICY "conversation_update" ON "messaging"."direct_conversations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "messaging"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "direct_conversations"."id") AND ((("cp"."participant_type" = 'user'::"public"."conversation_participant_type") AND ("cp"."participant_user_id" = "auth"."uid"())) OR (("cp"."participant_type" = 'organization'::"public"."conversation_participant_type") AND ("cp"."participant_org_id" IS NOT NULL))))))) WITH CHECK (true);



CREATE POLICY "conversation_view" ON "messaging"."direct_conversations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "messaging"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "direct_conversations"."id") AND ((("cp"."participant_type" = 'user'::"public"."conversation_participant_type") AND ("cp"."participant_user_id" = "auth"."uid"())) OR (("cp"."participant_type" = 'organization'::"public"."conversation_participant_type") AND ("cp"."participant_org_id" IS NOT NULL)))))));



CREATE POLICY "crud_jobs_as_admin" ON "messaging"."message_jobs" USING ("public"."is_event_manager"("event_id"));



CREATE POLICY "crud_templates_as_admin" ON "messaging"."message_templates" USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "om"
  WHERE (("om"."org_id" = "message_templates"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role"]))))));



ALTER TABLE "messaging"."direct_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "messaging"."direct_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "direct_messages_insert" ON "messaging"."direct_messages" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "messaging"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "direct_messages"."conversation_id") AND ((("direct_messages"."sender_type" = 'user'::"public"."conversation_participant_type") AND ("cp"."participant_type" = 'user'::"public"."conversation_participant_type") AND ("cp"."participant_user_id" = "auth"."uid"())) OR (("direct_messages"."sender_type" = 'organization'::"public"."conversation_participant_type") AND ("cp"."participant_type" = 'organization'::"public"."conversation_participant_type") AND ("cp"."participant_org_id" = "direct_messages"."sender_org_id"))))))));



CREATE POLICY "direct_messages_view" ON "messaging"."direct_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "messaging"."conversation_participants" "cp"
  WHERE (("cp"."conversation_id" = "direct_messages"."conversation_id") AND ((("cp"."participant_type" = 'user'::"public"."conversation_participant_type") AND ("cp"."participant_user_id" = "auth"."uid"())) OR (("cp"."participant_type" = 'organization'::"public"."conversation_participant_type") AND ("cp"."participant_org_id" IS NOT NULL)))))));



CREATE POLICY "insert_recipients_for_my_job" ON "messaging"."message_job_recipients" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "messaging"."message_jobs" "j"
  WHERE (("j"."id" = "message_job_recipients"."job_id") AND (("j"."created_by" = "auth"."uid"()) OR "public"."is_event_manager"("j"."event_id"))))));



ALTER TABLE "messaging"."message_job_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "messaging"."message_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "messaging"."message_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "messaging"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_notifications_all" ON "messaging"."notifications" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "read_recipients_for_my_job" ON "messaging"."message_job_recipients" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "messaging"."message_jobs" "j"
  WHERE (("j"."id" = "message_job_recipients"."job_id") AND (("j"."created_by" = "auth"."uid"()) OR "public"."is_event_manager"("j"."event_id"))))));



CREATE POLICY "service_update_recipients" ON "messaging"."message_job_recipients" FOR UPDATE USING (true) WITH CHECK (true);



CREATE POLICY "System can manage embeddings" ON "ml"."user_embeddings" USING (true) WITH CHECK (true);



CREATE POLICY "Users can view their own embeddings" ON "ml"."user_embeddings" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "ml"."user_embeddings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Organizers can view their payout configs" ON "organizations"."payout_configurations" USING (("organization_id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE ("org_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "admin_orgs_update" ON "organizations"."organizations" FOR UPDATE USING (("id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE (("org_memberships"."user_id" = "auth"."uid"()) AND ("org_memberships"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role"]))))));



CREATE POLICY "anyone_can_read_by_token" ON "organizations"."org_invitations" FOR SELECT USING (true);



CREATE POLICY "delete_contact_entries_for_editors" ON "organizations"."org_contact_import_entries" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_contact_imports" "oci"
  WHERE (("oci"."id" = "org_contact_import_entries"."import_id") AND "public"."is_org_role"("oci"."org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"])))));



CREATE POLICY "delete_contact_imports_for_editors" ON "organizations"."org_contact_imports" FOR DELETE USING ("public"."is_org_role"("org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"]));



CREATE POLICY "insert_contact_entries_for_editors" ON "organizations"."org_contact_import_entries" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "organizations"."org_contact_imports" "oci"
  WHERE (("oci"."id" = "org_contact_import_entries"."import_id") AND "public"."is_org_role"("oci"."org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"])))));



CREATE POLICY "insert_contact_imports_for_editors" ON "organizations"."org_contact_imports" FOR INSERT WITH CHECK ("public"."is_org_role"("org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"]));



CREATE POLICY "member_orgs_select" ON "organizations"."organizations" FOR SELECT USING (("id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE ("org_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_admins_can_create_invitations" ON "organizations"."org_invitations" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "org_invitations"."org_id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role"]))))));



CREATE POLICY "org_admins_can_update_invitations" ON "organizations"."org_invitations" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "org_invitations"."org_id") AND ("m"."user_id" = "auth"."uid"()) AND ("m"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role"]))))));



ALTER TABLE "organizations"."org_contact_import_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "organizations"."org_contact_imports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "organizations"."org_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_members_can_view_invitations" ON "organizations"."org_invitations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "m"
  WHERE (("m"."org_id" = "org_invitations"."org_id") AND ("m"."user_id" = "auth"."uid"())))));



ALTER TABLE "organizations"."org_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_memberships_read_self_fixed" ON "organizations"."org_memberships" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_current_user_org_admin"("org_id")));



CREATE POLICY "org_memberships_select" ON "organizations"."org_memberships" FOR SELECT USING (("org_id" IN ( SELECT "org_memberships_1"."org_id"
   FROM "organizations"."org_memberships" "org_memberships_1"
  WHERE ("org_memberships_1"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_memberships_write_admin_fixed" ON "organizations"."org_memberships" USING ("public"."is_current_user_org_admin"("org_id")) WITH CHECK ("public"."is_current_user_org_admin"("org_id"));



ALTER TABLE "organizations"."org_wallet_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_wallet_transactions_select_member" ON "organizations"."org_wallet_transactions" FOR SELECT TO "authenticated" USING (("wallet_id" IN ( SELECT "ow"."id"
   FROM ("organizations"."org_wallets" "ow"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "ow"."org_id")))
  WHERE ("om"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_wallet_tx_select" ON "organizations"."org_wallet_transactions" FOR SELECT USING (("wallet_id" IN ( SELECT "org_wallets"."id"
   FROM "organizations"."org_wallets"
  WHERE ("org_wallets"."org_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))));



ALTER TABLE "organizations"."org_wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_wallets_select" ON "organizations"."org_wallets" FOR SELECT USING (("org_id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE ("org_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_wallets_select_member" ON "organizations"."org_wallets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_memberships" "om"
  WHERE (("om"."org_id" = "org_wallets"."org_id") AND ("om"."user_id" = "auth"."uid"()) AND ("om"."role" = ANY (ARRAY['owner'::"public"."org_role", 'admin'::"public"."org_role", 'editor'::"public"."org_role", 'viewer'::"public"."org_role"]))))));



ALTER TABLE "organizations"."organizations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orgs_delete_owner" ON "organizations"."organizations" FOR DELETE USING ("public"."is_org_role"("id", ARRAY['owner'::"text"]));



CREATE POLICY "orgs_insert_auth" ON "organizations"."organizations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "orgs_read_all" ON "organizations"."organizations" FOR SELECT USING (true);



CREATE POLICY "orgs_update_admin" ON "organizations"."organizations" FOR UPDATE USING ("public"."is_org_role"("id", ARRAY['admin'::"text", 'owner'::"text"])) WITH CHECK ("public"."is_org_role"("id", ARRAY['admin'::"text", 'owner'::"text"]));



ALTER TABLE "organizations"."payout_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payout_accounts_delete_system_only" ON "organizations"."payout_accounts" FOR DELETE USING (false);



CREATE POLICY "payout_accounts_insert_system_only" ON "organizations"."payout_accounts" FOR INSERT WITH CHECK (false);



CREATE POLICY "payout_accounts_select_self" ON "organizations"."payout_accounts" FOR SELECT USING (((("context_type" = 'individual'::"public"."owner_context") AND ("context_id" = "auth"."uid"())) OR (("context_type" = 'organization'::"public"."owner_context") AND "public"."is_org_role"("context_id", ARRAY['admin'::"text", 'owner'::"text"]))));



CREATE POLICY "payout_accounts_update_system_only" ON "organizations"."payout_accounts" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "organizations"."payout_configurations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_contact_entries_for_members" ON "organizations"."org_contact_import_entries" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_contact_imports" "oci"
  WHERE (("oci"."id" = "org_contact_import_entries"."import_id") AND "public"."is_org_role"("oci"."org_id", ARRAY['viewer'::"text", 'editor'::"text", 'admin'::"text", 'owner'::"text"])))));



CREATE POLICY "select_contact_imports_for_members" ON "organizations"."org_contact_imports" FOR SELECT USING ("public"."is_org_role"("org_id", ARRAY['viewer'::"text", 'editor'::"text", 'admin'::"text", 'owner'::"text"]));



CREATE POLICY "update_contact_entries_for_editors" ON "organizations"."org_contact_import_entries" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "organizations"."org_contact_imports" "oci"
  WHERE (("oci"."id" = "org_contact_import_entries"."import_id") AND "public"."is_org_role"("oci"."org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"])))));



CREATE POLICY "update_contact_imports_for_editors" ON "organizations"."org_contact_imports" FOR UPDATE USING ("public"."is_org_role"("org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"])) WITH CHECK ("public"."is_org_role"("org_id", ARRAY['editor'::"text", 'admin'::"text", 'owner'::"text"]));



ALTER TABLE "payments"."credit_lots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "credit_lots_select_org" ON "payments"."credit_lots" FOR SELECT USING (("org_wallet_id" IN ( SELECT "ow"."id"
   FROM ("organizations"."org_wallets" "ow"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "ow"."org_id")))
  WHERE ("om"."user_id" = "auth"."uid"()))));



CREATE POLICY "credit_lots_select_own" ON "payments"."credit_lots" FOR SELECT USING (("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))));



CREATE POLICY "credit_lots_system_only" ON "payments"."credit_lots" USING (false) WITH CHECK (false);



ALTER TABLE "payments"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_insert_system" ON "payments"."invoices" FOR INSERT WITH CHECK (true);



CREATE POLICY "invoices_select_org" ON "payments"."invoices" FOR SELECT USING (("org_wallet_id" IN ( SELECT "ow"."id"
   FROM ("organizations"."org_wallets" "ow"
     JOIN "organizations"."org_memberships" "om" ON (("om"."org_id" = "ow"."org_id")))
  WHERE ("om"."user_id" = "auth"."uid"()))));



CREATE POLICY "invoices_select_own" ON "payments"."invoices" FOR SELECT USING ((("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))) OR ("purchased_by_user_id" = "auth"."uid"())));



CREATE POLICY "invoices_update_system" ON "payments"."invoices" FOR UPDATE USING (true);



CREATE POLICY "own_credit_lots_select" ON "payments"."credit_lots" FOR SELECT USING ((("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))) OR ("org_wallet_id" IN ( SELECT "org_wallets"."id"
   FROM "organizations"."org_wallets"
  WHERE ("org_wallets"."org_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"())))))));



CREATE POLICY "own_invoices_select" ON "payments"."invoices" FOR SELECT USING ((("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))) OR ("org_wallet_id" IN ( SELECT "org_wallets"."id"
   FROM "organizations"."org_wallets"
  WHERE ("org_wallets"."org_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"())))))));



CREATE POLICY "own_wallet_all" ON "payments"."wallets" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "own_wallet_tx_select" ON "payments"."wallet_transactions" FOR SELECT USING (("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))));



ALTER TABLE "payments"."payout_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "payments"."wallet_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_transactions_insert_system" ON "payments"."wallet_transactions" FOR INSERT WITH CHECK (true);



CREATE POLICY "wallet_transactions_select_own" ON "payments"."wallet_transactions" FOR SELECT USING (("wallet_id" IN ( SELECT "wallets"."id"
   FROM "payments"."wallets"
  WHERE ("wallets"."user_id" = "auth"."uid"()))));



ALTER TABLE "payments"."wallets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallets_select_own" ON "payments"."wallets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "wallets_update_own" ON "payments"."wallets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK ((("auth"."uid"() = "user_id") AND ("balance_credits" = ( SELECT "wallets_1"."balance_credits"
   FROM "payments"."wallets" "wallets_1"
  WHERE ("wallets_1"."id" = "wallets_1"."id")))));



CREATE POLICY "Authenticated users can read mv_refresh_log" ON "public"."mv_refresh_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Public cannot access mv_refresh_log" ON "public"."mv_refresh_log" USING (false);



CREATE POLICY "Public cannot access pgbench_tiers" ON "public"."pgbench_tiers" USING (false);



CREATE POLICY "Service role can manage idempotency keys" ON "public"."idempotency_keys" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to mv_refresh_log" ON "public"."mv_refresh_log" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to pgbench_tiers" ON "public"."pgbench_tiers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Users can access own rate limits or IP entries" ON "public"."rate_limits" USING ((("user_id" = "auth"."uid"()) OR (("user_id" IS NULL) AND ("ip_hash" IS NOT NULL)) OR ("auth"."role"() = 'service_role'::"text"))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("user_id" IS NULL) AND ("ip_hash" IS NOT NULL)) OR ("auth"."role"() = 'service_role'::"text")));



CREATE POLICY "Users can only access own idempotency keys" ON "public"."idempotency_keys" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "cb_all" ON "public"."circuit_breaker_state" USING (false) WITH CHECK (false);



ALTER TABLE "public"."circuit_breaker_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dead_letter_webhooks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dlq_all" ON "public"."dead_letter_webhooks" USING (false) WITH CHECK (false);



ALTER TABLE "public"."idempotency_keys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kv_store_d42c04e8" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kv_store_read_all" ON "public"."kv_store_d42c04e8" FOR SELECT USING (true);



CREATE POLICY "kv_store_write_all" ON "public"."kv_store_d42c04e8" USING (true) WITH CHECK (true);



ALTER TABLE "public"."mv_refresh_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pgbench_tiers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_limits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "req_logs_all" ON "public"."request_logs" USING (false) WITH CHECK (false);



ALTER TABLE "public"."request_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Event owners and sponsors can view deliverables" ON "sponsorship"."deliverables" FOR SELECT USING ((("event_id" IN ( SELECT "events"."id"
   FROM "events"."events"
  WHERE ("events"."owner_context_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))) OR ("sponsor_id" IN ( SELECT "sponsor_members"."sponsor_id"
   FROM "sponsorship"."sponsor_members"
  WHERE ("sponsor_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Org members can view their templates" ON "sponsorship"."package_templates" FOR SELECT USING (("org_id" IN ( SELECT "org_memberships"."org_id"
   FROM "organizations"."org_memberships"
  WHERE ("org_memberships"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view their payouts" ON "sponsorship"."sponsorship_payouts" FOR SELECT USING (("organizer_id" IN ( SELECT "organizations"."id"
   FROM "organizations"."organizations"
  WHERE ("organizations"."id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Proposal participants can view threads" ON "sponsorship"."proposal_threads" FOR SELECT USING ((("created_by" = "auth"."uid"()) OR ("event_id" IN ( SELECT "events"."id"
   FROM "events"."events"
  WHERE ("events"."owner_context_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))) OR ("sponsor_id" IN ( SELECT "sponsor_members"."sponsor_id"
   FROM "sponsorship"."sponsor_members"
  WHERE ("sponsor_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Public sponsor profiles are viewable by everyone" ON "sponsorship"."sponsor_public_profiles" FOR SELECT USING (true);



CREATE POLICY "Users can delete sponsor memberships" ON "sponsorship"."sponsor_members" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert sponsor memberships" ON "sponsorship"."sponsor_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update sponsor memberships" ON "sponsorship"."sponsor_members" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view sponsor memberships" ON "sponsorship"."sponsor_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view sponsor profiles" ON "sponsorship"."sponsor_profiles" FOR SELECT USING (true);



CREATE POLICY "Users can view sponsorship matches" ON "sponsorship"."sponsorship_matches" FOR SELECT USING (true);



ALTER TABLE "sponsorship"."deliverable_proofs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."deliverables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."event_sponsorships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_sponsorships_read" ON "sponsorship"."event_sponsorships" FOR SELECT TO "authenticated" USING (("public"."is_event_manager"("event_id") OR ("sponsor_id" IN ( SELECT "sponsor_members"."sponsor_id"
   FROM "sponsorship"."sponsor_members"
  WHERE ("sponsor_members"."user_id" = "auth"."uid"())))));



ALTER TABLE "sponsorship"."fit_recalc_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."match_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."match_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_sponsor_crud" ON "sponsorship"."sponsorship_orders" USING ((("sponsor_id" IN ( SELECT "sponsor_members"."sponsor_id"
   FROM "sponsorship"."sponsor_members"
  WHERE ("sponsor_members"."user_id" = "auth"."uid"()))) OR "public"."is_event_manager"("event_id"))) WITH CHECK (("sponsor_id" IN ( SELECT "sponsor_members"."sponsor_id"
   FROM "sponsorship"."sponsor_members"
  WHERE ("sponsor_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "organizers_manage_packages" ON "sponsorship"."sponsorship_packages" USING ((EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "sponsorship_packages"."event_id") AND "public"."is_event_manager"("e"."id")))));



ALTER TABLE "sponsorship"."package_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."package_variants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packages_event_manager_write" ON "sponsorship"."sponsorship_packages" TO "authenticated" USING ("public"."is_event_manager"("event_id")) WITH CHECK ("public"."is_event_manager"("event_id"));



CREATE POLICY "packages_public_read" ON "sponsorship"."sponsorship_packages" FOR SELECT TO "authenticated", "anon" USING (("visibility" = 'public'::"text"));



ALTER TABLE "sponsorship"."proposal_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."proposal_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_sponsors_select" ON "sponsorship"."sponsors" FOR SELECT USING (true);



ALTER TABLE "sponsorship"."sponsor_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sponsor_members_all" ON "sponsorship"."sponsors" USING (("id" IN ( SELECT "sponsor_members"."sponsor_id"
   FROM "sponsorship"."sponsor_members"
  WHERE ("sponsor_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "sponsor_members_rw_self" ON "sponsorship"."sponsor_members" TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "sponsorship"."sponsor_members" "sm"
  WHERE (("sm"."sponsor_id" = "sponsor_members"."sponsor_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = ANY (ARRAY['owner'::"public"."sponsor_role", 'admin'::"public"."sponsor_role"]))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "sponsorship"."sponsor_members" "sm"
  WHERE (("sm"."sponsor_id" = "sponsor_members"."sponsor_id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = ANY (ARRAY['owner'::"public"."sponsor_role", 'admin'::"public"."sponsor_role"]))))));



ALTER TABLE "sponsorship"."sponsor_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."sponsor_public_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."sponsors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sponsors_insert_authenticated" ON "sponsorship"."sponsors" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "sponsors_read_member_only" ON "sponsorship"."sponsors" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "sponsorship"."sponsor_members" "sm"
  WHERE (("sm"."sponsor_id" = "sponsors"."id") AND ("sm"."user_id" = "auth"."uid"())))));



CREATE POLICY "sponsors_read_packages" ON "sponsorship"."sponsorship_packages" FOR SELECT USING ((("visibility" = 'public'::"text") AND ("is_active" = true)));



CREATE POLICY "sponsors_update_admin_only" ON "sponsorship"."sponsors" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "sponsorship"."sponsor_members" "sm"
  WHERE (("sm"."sponsor_id" = "sponsors"."id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = ANY (ARRAY['owner'::"public"."sponsor_role", 'admin'::"public"."sponsor_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "sponsorship"."sponsor_members" "sm"
  WHERE (("sm"."sponsor_id" = "sponsors"."id") AND ("sm"."user_id" = "auth"."uid"()) AND ("sm"."role" = ANY (ARRAY['owner'::"public"."sponsor_role", 'admin'::"public"."sponsor_role"]))))));



ALTER TABLE "sponsorship"."sponsorship_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."sponsorship_orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."sponsorship_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."sponsorship_payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "sponsorship"."sponsorship_slas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Service role can manage guest OTP codes" ON "ticketing"."guest_otp_codes" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage guest sessions" ON "ticketing"."guest_ticket_sessions" USING (true) WITH CHECK (true);



ALTER TABLE "ticketing"."guest_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guest_codes_manage_host" ON "ticketing"."guest_codes" USING ("public"."is_event_manager"("event_id")) WITH CHECK ("public"."is_event_manager"("event_id"));



CREATE POLICY "guest_codes_validate_public" ON "ticketing"."guest_codes" FOR SELECT USING (true);



ALTER TABLE "ticketing"."guest_otp_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "ticketing"."guest_ticket_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "ticketing"."inventory_operations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_operations_admin_read" ON "ticketing"."inventory_operations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("ticketing"."ticket_tiers" "tt"
     JOIN "events"."events" "e" ON (("e"."id" = "tt"."event_id")))
  WHERE (("tt"."id" = "inventory_operations"."tier_id") AND "public"."is_event_manager"("e"."id")))));



CREATE POLICY "inventory_operations_system_write" ON "ticketing"."inventory_operations" USING (false) WITH CHECK (false);



ALTER TABLE "ticketing"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_delete_system_only" ON "ticketing"."order_items" FOR DELETE USING (false);



CREATE POLICY "order_items_select_owner_or_manager" ON "ticketing"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "ticketing"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND (("o"."user_id" = "auth"."uid"()) OR "public"."is_event_manager"("o"."event_id"))))));



CREATE POLICY "order_items_update_system_only" ON "ticketing"."order_items" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "order_items_write_system_only" ON "ticketing"."order_items" FOR INSERT WITH CHECK (false);



ALTER TABLE "ticketing"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_delete_system_only" ON "ticketing"."orders" FOR DELETE USING (false);



CREATE POLICY "orders_insert_own_only" ON "ticketing"."orders" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "orders"."event_id") AND ("e"."visibility" = ANY (ARRAY['public'::"public"."event_visibility", 'unlisted'::"public"."event_visibility"])))))));



CREATE POLICY "orders_select_owner_or_manager" ON "ticketing"."orders" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_event_manager"("event_id")));



CREATE POLICY "orders_update_system_only" ON "ticketing"."orders" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "org_orders_select" ON "ticketing"."orders" FOR SELECT USING (("event_id" IN ( SELECT "e"."id"
   FROM "events"."events" "e"
  WHERE ("e"."owner_context_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))));



CREATE POLICY "org_tickets_select" ON "ticketing"."tickets" FOR SELECT USING (("event_id" IN ( SELECT "e"."id"
   FROM "events"."events" "e"
  WHERE ("e"."owner_context_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))));



CREATE POLICY "org_tiers_all" ON "ticketing"."ticket_tiers" USING (("event_id" IN ( SELECT "e"."id"
   FROM "events"."events" "e"
  WHERE ("e"."owner_context_id" IN ( SELECT "org_memberships"."org_id"
           FROM "organizations"."org_memberships"
          WHERE ("org_memberships"."user_id" = "auth"."uid"()))))));



CREATE POLICY "own_order_items_select" ON "ticketing"."order_items" FOR SELECT USING (("order_id" IN ( SELECT "orders"."id"
   FROM "ticketing"."orders"
  WHERE ("orders"."user_id" = "auth"."uid"()))));



CREATE POLICY "own_orders_select" ON "ticketing"."orders" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "own_tickets_select" ON "ticketing"."tickets" FOR SELECT USING (("owner_user_id" = "auth"."uid"()));



CREATE POLICY "public_tiers_select" ON "ticketing"."ticket_tiers" FOR SELECT USING (("event_id" IN ( SELECT "events"."id"
   FROM "events"."events"
  WHERE ("events"."visibility" = 'public'::"public"."event_visibility"))));



ALTER TABLE "ticketing"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_delete_system_only" ON "ticketing"."refunds" FOR DELETE USING (false);



CREATE POLICY "refunds_select_owner_or_manager" ON "ticketing"."refunds" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "ticketing"."orders" "o"
  WHERE (("o"."id" = "refunds"."order_id") AND (("o"."user_id" = "auth"."uid"()) OR "public"."is_event_manager"("o"."event_id"))))));



CREATE POLICY "refunds_update_system_only" ON "ticketing"."refunds" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "refunds_write_system_only" ON "ticketing"."refunds" FOR INSERT WITH CHECK (false);



ALTER TABLE "ticketing"."scan_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "scan_logs_select_event_team" ON "ticketing"."scan_logs" FOR SELECT USING (("public"."is_event_manager"("event_id") OR (EXISTS ( SELECT 1
   FROM "events"."event_scanners" "s"
  WHERE (("s"."event_id" = "scan_logs"."event_id") AND ("s"."user_id" = "auth"."uid"()) AND ("s"."status" = 'enabled'::"text"))))));



ALTER TABLE "ticketing"."ticket_holds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_holds_system_write" ON "ticketing"."ticket_holds" USING (false) WITH CHECK (false);



CREATE POLICY "ticket_holds_user_read" ON "ticketing"."ticket_holds" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("ticketing"."ticket_tiers" "tt"
     JOIN "events"."events" "e" ON (("e"."id" = "tt"."event_id")))
  WHERE (("tt"."id" = "ticket_holds"."tier_id") AND "public"."is_event_manager"("e"."id"))))));



ALTER TABLE "ticketing"."ticket_tiers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_tiers_delete_manager_only" ON "ticketing"."ticket_tiers" FOR DELETE USING ("public"."is_event_manager"("event_id"));



CREATE POLICY "ticket_tiers_insert_manager_only" ON "ticketing"."ticket_tiers" FOR INSERT WITH CHECK ("public"."is_event_manager"("event_id"));



CREATE POLICY "ticket_tiers_select_public_or_manager" ON "ticketing"."ticket_tiers" FOR SELECT USING (((("status" = 'active'::"text") AND (EXISTS ( SELECT 1
   FROM "events"."events" "e"
  WHERE (("e"."id" = "ticket_tiers"."event_id") AND ("e"."visibility" = ANY (ARRAY['public'::"public"."event_visibility", 'unlisted'::"public"."event_visibility"])))))) OR "public"."is_event_manager"("event_id")));



CREATE POLICY "ticket_tiers_update_manager_only" ON "ticketing"."ticket_tiers" FOR UPDATE USING ("public"."is_event_manager"("event_id")) WITH CHECK ("public"."is_event_manager"("event_id"));



ALTER TABLE "ticketing"."tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tickets_delete_system_only" ON "ticketing"."tickets" FOR DELETE USING (false);



CREATE POLICY "tickets_insert_system_only" ON "ticketing"."tickets" FOR INSERT WITH CHECK (false);



CREATE POLICY "tickets_select_owner_or_manager" ON "ticketing"."tickets" FOR SELECT USING ((("owner_user_id" = "auth"."uid"()) OR "public"."is_event_manager"("event_id")));



CREATE POLICY "tickets_update_system_only" ON "ticketing"."tickets" FOR UPDATE USING (false) WITH CHECK (false);



CREATE POLICY "Allow profile creation during signup" ON "users"."user_profiles" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can update their own profile" ON "users"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own sponsor mode" ON "users"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view all profiles" ON "users"."user_profiles" FOR SELECT USING (true);



ALTER TABLE "users"."follows" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "follows_delete_policy" ON "users"."follows" FOR DELETE USING ((("follower_user_id" = "auth"."uid"()) OR (("target_type" = 'user'::"public"."follow_target") AND ("target_id" = "auth"."uid"()))));



CREATE POLICY "follows_insert_policy" ON "users"."follows" FOR INSERT WITH CHECK ((("follower_user_id" = "auth"."uid"()) AND (("target_type" <> 'user'::"public"."follow_target") OR ("target_id" <> "auth"."uid"()))));



CREATE POLICY "follows_select_policy" ON "users"."follows" FOR SELECT USING ((("follower_user_id" = "auth"."uid"()) OR (("target_type" = 'user'::"public"."follow_target") AND ("target_id" = "auth"."uid"())) OR ("target_type" = ANY (ARRAY['organizer'::"public"."follow_target", 'event'::"public"."follow_target"]))));



CREATE POLICY "follows_update_policy" ON "users"."follows" FOR UPDATE USING (("follower_user_id" = "auth"."uid"())) WITH CHECK ((("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text"])) AND ("follower_user_id" = "auth"."uid"())));



CREATE POLICY "own_follows_all" ON "users"."follows" USING (("follower_user_id" = "auth"."uid"()));



CREATE POLICY "own_profile_all" ON "users"."user_profiles" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "public_follows_select" ON "users"."follows" FOR SELECT USING (true);



CREATE POLICY "public_profiles_select" ON "users"."user_profiles" FOR SELECT USING (true);



ALTER TABLE "users"."user_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_profiles_read_all" ON "users"."user_profiles" FOR SELECT USING (true);



CREATE POLICY "user_profiles_update_self" ON "users"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "events"."event_comments";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "events"."event_posts";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "events"."event_reactions";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "users"."follows";



GRANT USAGE ON SCHEMA "analytics" TO "authenticated";
GRANT USAGE ON SCHEMA "analytics" TO "app_read";
GRANT USAGE ON SCHEMA "analytics" TO "app_write";



GRANT USAGE ON SCHEMA "campaigns" TO "app_read";
GRANT USAGE ON SCHEMA "campaigns" TO "app_write";






GRANT USAGE ON SCHEMA "events" TO "app_read";
GRANT USAGE ON SCHEMA "events" TO "app_write";



GRANT USAGE ON SCHEMA "messaging" TO "app_read";
GRANT USAGE ON SCHEMA "messaging" TO "app_write";



GRANT USAGE ON SCHEMA "ml" TO "app_read";
GRANT USAGE ON SCHEMA "ml" TO "app_write";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT USAGE ON SCHEMA "organizations" TO "app_read";
GRANT USAGE ON SCHEMA "organizations" TO "app_write";



GRANT USAGE ON SCHEMA "payments" TO "app_read";
GRANT USAGE ON SCHEMA "payments" TO "app_write";



GRANT USAGE ON SCHEMA "ref" TO "app_read";
GRANT USAGE ON SCHEMA "ref" TO "app_write";



GRANT USAGE ON SCHEMA "sponsorship" TO "app_read";
GRANT USAGE ON SCHEMA "sponsorship" TO "app_write";



GRANT USAGE ON SCHEMA "ticketing" TO "app_read";
GRANT USAGE ON SCHEMA "ticketing" TO "app_write";



GRANT USAGE ON SCHEMA "users" TO "app_read";
GRANT USAGE ON SCHEMA "users" TO "app_write";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."_bump_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."_bump_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_bump_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_org_invitation"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_org_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_org_invitation"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_role_invite"("p_token" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_role_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_role_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_role_invite"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."bump_reply_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."bump_reply_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."bump_reply_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_platform_fee"("p_amount_cents" integer, "p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_platform_fee"("p_amount_cents" integer, "p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_platform_fee"("p_amount_cents" integer, "p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_current_user_post"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_current_user_post"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_current_user_post"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_view_event"("p_user" "uuid", "p_event" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_event"("p_user" "uuid", "p_event" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_event"("p_user" "uuid", "p_event" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_circuit_breaker"("p_service_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_circuit_breaker"("p_service_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_circuit_breaker"("p_service_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_user_id" "uuid", "p_ip_address" "text", "p_max_per_minute" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_user_id" "uuid", "p_ip_address" "text", "p_max_per_minute" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_rate_limit"("p_bucket" "text", "p_user_id" "uuid", "p_ip_address" "text", "p_max_per_minute" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."check_recalc_queue_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_recalc_queue_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_recalc_queue_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."claim_order_ticketing"("p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."claim_order_ticketing"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."claim_order_ticketing"("p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_holds"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_holds"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_holds"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_guest_sessions"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_guest_sessions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_guest_sessions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_assets"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_assets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_assets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_keys"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_keys"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_keys"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_recalc_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_recalc_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_recalc_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_ticket_holds"("p_hold_ids" "uuid"[], "p_order_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_ticket_holds"("p_hold_ids" "uuid"[], "p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_ticket_holds"("p_hold_ids" "uuid"[], "p_order_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_event_attendees"("p_event" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_event_attendees"("p_event" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_event_attendees"("p_event" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_event_series"("p_org_id" "uuid", "p_created_by" "uuid", "p_name" "text", "p_description" "text", "p_recurrence" "public"."recurrence_pattern", "p_interval" integer, "p_series_start" timestamp with time zone, "p_series_end" "date", "p_max_events" integer, "p_timezone" "text", "p_template" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_event_series"("p_org_id" "uuid", "p_created_by" "uuid", "p_name" "text", "p_description" "text", "p_recurrence" "public"."recurrence_pattern", "p_interval" integer, "p_series_start" timestamp with time zone, "p_series_end" "date", "p_max_events" integer, "p_timezone" "text", "p_template" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_event_series"("p_org_id" "uuid", "p_created_by" "uuid", "p_name" "text", "p_description" "text", "p_recurrence" "public"."recurrence_pattern", "p_interval" integer, "p_series_start" timestamp with time zone, "p_series_end" "date", "p_max_events" integer, "p_timezone" "text", "p_template" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_follow_notification"("target_user_id" "uuid", "follower_user_id" "uuid", "follower_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_follow_notification"("target_user_id" "uuid", "follower_user_id" "uuid", "follower_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_follow_notification"("target_user_id" "uuid", "follower_user_id" "uuid", "follower_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_next_month_partitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_next_month_partitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_next_month_partitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_organization_with_membership"("p_name" "text", "p_handle" "text", "p_logo_url" "text", "p_creator_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_organization_with_membership"("p_name" "text", "p_handle" "text", "p_logo_url" "text", "p_creator_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_organization_with_membership"("p_name" "text", "p_handle" "text", "p_logo_url" "text", "p_creator_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_org_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_org_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decr_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decr_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decr_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_credits_fifo"("p_amount" integer, "p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_credits_fifo"("p_amount" integer, "p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_credits_fifo"("p_amount" integer, "p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dlq_enqueue_webhook"("p_correlation_id" "uuid", "p_webhook_type" "text", "p_payload" "jsonb", "p_original_timestamp" timestamp with time zone, "p_failure_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dlq_enqueue_webhook"("p_correlation_id" "uuid", "p_webhook_type" "text", "p_payload" "jsonb", "p_original_timestamp" timestamp with time zone, "p_failure_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dlq_enqueue_webhook"("p_correlation_id" "uuid", "p_webhook_type" "text", "p_payload" "jsonb", "p_original_timestamp" timestamp with time zone, "p_failure_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."dlq_pop_next"("p_webhook_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dlq_pop_next"("p_webhook_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dlq_pop_next"("p_webhook_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."dlq_set_status"("p_id" "uuid", "p_status" "text", "p_failure_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."dlq_set_status"("p_id" "uuid", "p_status" "text", "p_failure_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dlq_set_status"("p_id" "uuid", "p_status" "text", "p_failure_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_next_month_partitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_next_month_partitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_next_month_partitions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_org_wallet_exists"("p_org_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_org_wallet_exists"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_org_wallet_exists"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_org_wallet_exists"("p_org_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."ensure_wallet_exists_for_auth_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ensure_wallet_exists_for_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_wallet_exists_for_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_wallet_exists_for_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_sql"("sql_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_sql"("sql_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_sql"("sql_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."extend_ticket_holds"("p_session_id" "text", "p_extend_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."extend_ticket_holds"("p_session_id" "text", "p_extend_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."extend_ticket_holds"("p_session_id" "text", "p_extend_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_similar_events"("p_description_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."find_similar_events"("p_description_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_similar_events"("p_description_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."find_similar_sponsors"("p_objectives_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."find_similar_sponsors"("p_objectives_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_similar_sponsors"("p_objectives_embedding" "public"."vector", "p_limit" integer, "p_threshold" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_compute_match_score"("p_event_id" "uuid", "p_sponsor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_compute_match_score"("p_event_id" "uuid", "p_sponsor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_compute_match_score"("p_event_id" "uuid", "p_sponsor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_queue_recalc_on_event_insights"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_queue_recalc_on_event_insights"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_queue_recalc_on_event_insights"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_queue_recalc_on_sponsor_profiles"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_queue_recalc_on_sponsor_profiles"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_queue_recalc_on_sponsor_profiles"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_upsert_match"("p_event_id" "uuid", "p_sponsor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_upsert_match"("p_event_id" "uuid", "p_sponsor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_upsert_match"("p_event_id" "uuid", "p_sponsor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gen_qr_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."gen_qr_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gen_qr_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_event_sponsors"("p_event_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_event_sponsors"("p_event_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_event_sponsors"("p_event_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_credits"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_credits"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_credits"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_campaign_analytics"("p_campaign_ids" "uuid"[], "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_campaign_analytics"("p_campaign_ids" "uuid"[], "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_campaign_analytics"("p_campaign_ids" "uuid"[], "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_credit_lot_breakdown"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_credit_lot_breakdown"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_credit_lot_breakdown"("p_wallet_id" "uuid", "p_org_wallet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_user_org_role"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_user_org_role"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_user_org_role"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_attendees"("p_event" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_attendees"("p_event" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_attendees"("p_event" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_kpis_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_kpis_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_kpis_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_posts"("p_event_ids" "uuid"[], "p_k" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_posts"("p_event_ids" "uuid"[], "p_k" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_posts"("p_event_ids" "uuid"[], "p_k" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_social_links"("links" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_social_links"("links" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_social_links"("links" "jsonb") TO "service_role";



GRANT ALL ON TABLE "events"."event_posts" TO "anon";
GRANT ALL ON TABLE "events"."event_posts" TO "authenticated";
GRANT ALL ON TABLE "events"."event_posts" TO "service_role";



GRANT ALL ON TABLE "users"."user_profiles" TO "anon";
GRANT ALL ON TABLE "users"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "users"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."event_posts_with_meta_v2" TO "anon";
GRANT ALL ON TABLE "public"."event_posts_with_meta_v2" TO "authenticated";
GRANT ALL ON TABLE "public"."event_posts_with_meta_v2" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_posts_cursor_v2"("in_event_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_posts_cursor_v2"("in_event_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_posts_cursor_v2"("in_event_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_recommendations"("p_sponsor_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_recommendations"("p_sponsor_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_recommendations"("p_sponsor_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_scans_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_scans_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_scans_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feed_item_for_post"("p_user" "uuid", "p_post_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_feed_item_for_post"("p_user" "uuid", "p_post_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feed_item_for_post"("p_user" "uuid", "p_post_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_hero_feed"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_hero_feed"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_hero_feed"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids"("p_user" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_ids_v2"("in_user_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids_v2"("in_user_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_ids_v2"("in_user_id" "uuid", "in_limit" integer, "in_cursor_ts" timestamp with time zone, "in_cursor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_ranked"("p_user_id" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_ranked"("p_user_id" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_ranked"("p_user_id" "uuid", "p_limit" integer, "p_cursor_item_id" "uuid", "p_categories" "text"[], "p_user_lat" double precision, "p_user_lng" double precision, "p_max_distance_miles" double precision, "p_date_filters" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_home_feed_v2"("p_user" "uuid", "p_limit" integer, "p_cursor_ts" timestamp with time zone, "p_cursor_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_inventory_health"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_inventory_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_inventory_health"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mutual_connections"("user1_id" "uuid", "user2_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mutual_connections"("user1_id" "uuid", "user2_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mutual_connections"("user1_id" "uuid", "user2_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_org_analytics"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_org_analytics"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_org_analytics"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_audio_tasks"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_audio_tasks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_audio_tasks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_post_engagement_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_post_engagement_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_post_engagement_daily"("p_event_ids" "uuid"[], "p_from_date" "date", "p_to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_recommendations"("p_user_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_recommendations"("p_user_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_recommendations"("p_user_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sponsor_recommendations"("p_event_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_sponsor_recommendations"("p_event_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sponsor_recommendations"("p_event_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tier_inventory_status"("p_tier_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tier_inventory_status"("p_tier_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tier_inventory_status"("p_tier_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_top_posts_analytics"("p_event_id" "uuid", "p_metric" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_posts_analytics"("p_event_id" "uuid", "p_metric" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_posts_analytics"("p_event_id" "uuid", "p_metric" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_analytics"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_analytics"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_analytics"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_connections"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_connections"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_connections"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_earned_badges"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_earned_badges"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_earned_badges"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_event_badge"("p_user_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_event_badge"("p_user_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_event_badge"("p_user_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_highest_tier_badge"("user_id_param" "uuid", "event_id_param" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_highest_tier_badge"("user_id_param" "uuid", "event_id_param" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_highest_tier_badge"("user_id_param" "uuid", "event_id_param" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organizations"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organizations"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organizations"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_comment_count_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_comment_count_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_comment_count_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_like_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_like_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_like_sync"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_safety_talk_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_safety_talk_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_safety_talk_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_ip"("ip_address" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_ip"("ip_address" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_ip"("ip_address" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inc_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."inc_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."inc_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_sponsorship_order_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_sponsorship_order_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_sponsorship_order_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_current_user_org_admin"("p_org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_current_user_org_admin"("p_org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_current_user_org_admin"("p_org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_individual_owner"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_individual_owner"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_individual_owner"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_manager"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_manager"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_manager"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_event_org_editor"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_event_org_editor"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_event_org_editor"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_org_role"("p_org_id" "uuid", "p_roles" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."is_org_role"("p_org_id" "uuid", "p_roles" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_org_role"("p_org_id" "uuid", "p_roles" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_service_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_service_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_service_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_request"("p_correlation_id" "uuid", "p_source_type" "text", "p_function_name" "text", "p_http_method" "text", "p_url" "text", "p_headers" "jsonb", "p_body" "jsonb", "p_response_status" integer, "p_response_body" "jsonb", "p_execution_time_ms" integer, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_request"("p_correlation_id" "uuid", "p_source_type" "text", "p_function_name" "text", "p_http_method" "text", "p_url" "text", "p_headers" "jsonb", "p_body" "jsonb", "p_response_status" integer, "p_response_body" "jsonb", "p_execution_time_ms" integer, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_request"("p_correlation_id" "uuid", "p_source_type" "text", "p_function_name" "text", "p_http_method" "text", "p_url" "text", "p_headers" "jsonb", "p_body" "jsonb", "p_response_status" integer, "p_response_body" "jsonb", "p_execution_time_ms" integer, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_audio_complete"("p_talk_id" "uuid", "p_asset_id" "uuid", "p_url" "text", "p_file_size" bigint, "p_etag" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_audio_complete"("p_talk_id" "uuid", "p_asset_id" "uuid", "p_url" "text", "p_file_size" bigint, "p_etag" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_audio_complete"("p_talk_id" "uuid", "p_asset_id" "uuid", "p_url" "text", "p_file_size" bigint, "p_etag" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_event_completed"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_event_completed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_event_completed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_text"("txt" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_text"("txt" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_text"("txt" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_user_follow"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_user_follow"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_user_follow"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."org_wallet_apply_purchase"("p_wallet_id" "uuid", "p_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."org_wallet_apply_purchase"("p_wallet_id" "uuid", "p_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."org_wallet_apply_purchase"("p_wallet_id" "uuid", "p_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_wallet_apply_purchase"("p_wallet_id" "uuid", "p_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."org_wallet_apply_refund"("p_wallet_id" "uuid", "p_refund_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."org_wallet_apply_refund"("p_wallet_id" "uuid", "p_refund_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."org_wallet_apply_refund"("p_wallet_id" "uuid", "p_refund_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_wallet_apply_refund"("p_wallet_id" "uuid", "p_refund_credits" integer, "p_invoice_id" "uuid", "p_stripe_event_id" "text", "p_description" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."org_wallet_apply_spend"("p_wallet_id" "uuid", "p_credits" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_description" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."org_wallet_apply_spend"("p_wallet_id" "uuid", "p_credits" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_description" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."org_wallet_apply_spend"("p_wallet_id" "uuid", "p_credits" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_description" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_wallet_apply_spend"("p_wallet_id" "uuid", "p_credits" integer, "p_reference_type" "text", "p_reference_id" "uuid", "p_description" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."org_wallet_freeze_if_negative"("p_wallet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."org_wallet_freeze_if_negative"("p_wallet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."org_wallet_freeze_if_negative"("p_wallet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."process_match_queue"("p_batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."process_match_queue"("p_batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_match_queue"("p_batch_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."process_payout_queue"() TO "anon";
GRANT ALL ON FUNCTION "public"."process_payout_queue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."process_payout_queue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_dead_letters"("p_keep_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_dead_letters"("p_keep_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_dead_letters"("p_keep_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_request_logs"("p_keep_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."prune_request_logs"("p_keep_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_request_logs"("p_keep_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_sponsorship_payout"("p_order_id" "uuid", "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."queue_sponsorship_payout"("p_order_id" "uuid", "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_sponsorship_payout"("p_order_id" "uuid", "p_priority" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_org_wallet_balance"("p_wallet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_org_wallet_balance"("p_wallet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_org_wallet_balance"("p_wallet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recompute_wallet_balance"("p_wallet" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_wallet_balance"("p_wallet" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_wallet_balance"("p_wallet" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_ads_analytics"("p_concurrently" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_ads_analytics"("p_concurrently" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_ads_analytics"("p_concurrently" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_ads_analytics"("p_concurrently" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_analytics_views"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_analytics_views"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_analytics_views"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_campaign_analytics"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_campaign_analytics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_campaign_analytics"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_campaign_analytics"("p_concurrently" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_campaign_analytics"("p_concurrently" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_campaign_analytics"("p_concurrently" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_campaign_analytics"("p_concurrently" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_conversation_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_conversation_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_conversation_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_covis"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_covis"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_covis"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_event_quality_scores"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_event_quality_scores"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_event_quality_scores"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_search_docs"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_search_docs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_search_docs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_semantic_marketplace"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_semantic_marketplace"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_semantic_marketplace"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_sponsorship_mvs"("concurrent" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_sponsorship_mvs"("concurrent" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_sponsorship_mvs"("concurrent" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_trending_posts"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_trending_posts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_trending_posts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_user_affinity"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_user_affinity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_user_affinity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_user_embedding"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_user_embedding"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_user_embedding"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_video_analytics"() TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_video_analytics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_video_analytics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."release_ticket_holds"("p_hold_ids" "uuid"[], "p_session_id" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."release_ticket_holds"("p_hold_ids" "uuid"[], "p_session_id" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_ticket_holds"("p_hold_ids" "uuid"[], "p_session_id" "text", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_tickets_atomic"("p_tier_id" "uuid", "p_quantity" integer, "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_tickets_atomic"("p_tier_id" "uuid", "p_quantity" integer, "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_tickets_atomic"("p_tier_id" "uuid", "p_quantity" integer, "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_tickets_batch"("p_reservations" "jsonb", "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_tickets_batch"("p_reservations" "jsonb", "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_tickets_batch"("p_reservations" "jsonb", "p_session_id" "text", "p_user_id" "uuid", "p_expires_minutes" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_campaign_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_campaign_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_campaign_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_creative_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_creative_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_creative_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_creative_analytics_daily"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."rpc_creative_analytics_rollup"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[], "p_include_series" boolean, "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."rpc_creative_analytics_rollup"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[], "p_include_series" boolean, "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_creative_analytics_rollup"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[], "p_include_series" boolean, "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_creative_analytics_rollup"("p_org_id" "uuid", "p_from" "date", "p_to" "date", "p_campaign_ids" "uuid"[], "p_creative_ids" "uuid"[], "p_include_series" boolean, "p_sort" "text", "p_dir" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_all"("p_user" "uuid", "p_q" "text", "p_category" "text", "p_date_from" "date", "p_date_to" "date", "p_only_events" boolean, "p_limit" integer, "p_offset" integer, "p_location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."search_all"("p_user" "uuid", "p_q" "text", "p_category" "text", "p_date_from" "date", "p_date_to" "date", "p_only_events" boolean, "p_limit" integer, "p_offset" integer, "p_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_all"("p_user" "uuid", "p_q" "text", "p_category" "text", "p_date_from" "date", "p_date_to" "date", "p_only_events" boolean, "p_limit" integer, "p_offset" integer, "p_location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."semantic_event_search"("p_query_text" "text", "p_category" "text", "p_city" "text", "p_start_date" "date", "p_end_date" "date", "p_quality_tier" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."semantic_event_search"("p_query_text" "text", "p_category" "text", "p_city" "text", "p_start_date" "date", "p_end_date" "date", "p_quality_tier" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."semantic_event_search"("p_query_text" "text", "p_category" "text", "p_city" "text", "p_start_date" "date", "p_end_date" "date", "p_quality_tier" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."semantic_sponsor_event_match"("p_sponsor_id" "uuid", "p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."semantic_sponsor_event_match"("p_sponsor_id" "uuid", "p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."semantic_sponsor_event_match"("p_sponsor_id" "uuid", "p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."semantic_sponsor_search"("p_query_text" "text", "p_industry" "text", "p_budget_min" integer, "p_budget_max" integer, "p_regions" "text"[], "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."semantic_sponsor_search"("p_query_text" "text", "p_industry" "text", "p_budget_min" integer, "p_budget_max" integer, "p_regions" "text"[], "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."semantic_sponsor_search"("p_query_text" "text", "p_industry" "text", "p_budget_min" integer, "p_budget_max" integer, "p_regions" "text"[], "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similar_events"("p_event_id" "uuid", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."similar_events"("p_event_id" "uuid", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."similar_events"("p_event_id" "uuid", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_post_like_count"("p_post" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_post_like_count"("p_post" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_post_like_count"("p_post" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."test_like_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."test_like_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."test_like_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_assign_serial_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_assign_serial_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_assign_serial_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_ticket_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_ticket_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_ticket_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_search_docs_mv"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_search_docs_mv"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_search_docs_mv"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_assign_serial_no"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_assign_serial_no"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_assign_serial_no"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_block_tier_delete_if_tickets"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_block_tier_delete_if_tickets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_block_tier_delete_if_tickets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_block_tier_price_change_after_sale"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_block_tier_price_change_after_sale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_block_tier_price_change_after_sale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_event_comments_bump_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_event_comments_bump_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_event_comments_bump_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_event_reactions_bump_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_event_reactions_bump_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_event_reactions_bump_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_release_tier_capacity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_release_tier_capacity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_release_tier_capacity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_reserve_tier_capacity"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_reserve_tier_capacity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_reserve_tier_capacity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_circuit_breaker_state"("p_service_id" "text", "p_success" boolean, "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_circuit_breaker_state"("p_service_id" "text", "p_success" boolean, "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_circuit_breaker_state"("p_service_id" "text", "p_success" boolean, "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_description_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_description_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_description_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_comment_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_comment_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_comment_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sponsor_objectives_embedding"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sponsor_objectives_embedding"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sponsor_objectives_embedding"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sponsorship_matches"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sponsorship_matches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sponsorship_matches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_sponsorship_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_sponsorship_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_sponsorship_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_orgs"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_orgs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_orgs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_related_event_ids"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_related_event_ids"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_related_event_ids"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_sponsorship_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_sponsorship_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_sponsorship_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_apply_purchase"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_credits" integer, "p_usd_cents" integer, "p_receipt_url" "text", "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_apply_purchase"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_credits" integer, "p_usd_cents" integer, "p_receipt_url" "text", "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_apply_purchase"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_credits" integer, "p_usd_cents" integer, "p_receipt_url" "text", "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_apply_refund"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_refund_usd_cents" integer, "p_idempotency_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_apply_refund"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_refund_usd_cents" integer, "p_idempotency_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_apply_refund"("p_invoice_id" "uuid", "p_wallet_id" "uuid", "p_refund_usd_cents" integer, "p_idempotency_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."wallet_freeze_if_negative"("p_wallet_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."wallet_freeze_if_negative"("p_wallet_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wallet_freeze_if_negative"("p_wallet_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";



GRANT ALL ON TABLE "analytics"."analytics_events" TO "anon";
GRANT ALL ON TABLE "analytics"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "analytics"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "analytics"."audience_consents" TO "anon";
GRANT ALL ON TABLE "analytics"."audience_consents" TO "authenticated";
GRANT ALL ON TABLE "analytics"."audience_consents" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_audience_insights" TO "anon";
GRANT ALL ON TABLE "analytics"."event_audience_insights" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_audience_insights" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions" TO "service_role";



GRANT SELECT ON TABLE "analytics"."event_impressions_daily" TO "authenticated";
GRANT SELECT ON TABLE "analytics"."event_impressions_daily" TO "app_read";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "analytics"."event_impressions_daily" TO "app_write";



GRANT ALL ON TABLE "analytics"."event_impressions_p" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_default" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_default" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_default" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202404" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202404" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202404" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202405" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202405" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202405" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202406" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202406" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202406" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202407" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202407" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202407" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202408" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202408" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202408" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202409" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202409" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202409" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202410" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202410" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202410" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202411" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202411" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202411" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202412" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202412" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202412" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202501" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202501" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202501" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202502" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202502" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202502" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202503" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202503" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202503" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202504" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202504" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202504" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202505" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202505" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202505" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202506" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202506" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202506" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202507" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202507" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202507" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202508" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202508" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202508" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202509" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202509" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202509" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202510" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202510" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202510" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_impressions_p_202511" TO "anon";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202511" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_impressions_p_202511" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_stat_snapshots" TO "anon";
GRANT ALL ON TABLE "analytics"."event_stat_snapshots" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_stat_snapshots" TO "service_role";



GRANT ALL ON TABLE "analytics"."event_video_counters" TO "anon";
GRANT ALL ON TABLE "analytics"."event_video_counters" TO "authenticated";
GRANT ALL ON TABLE "analytics"."event_video_counters" TO "service_role";



GRANT ALL ON TABLE "analytics"."negative_feedback" TO "anon";
GRANT ALL ON TABLE "analytics"."negative_feedback" TO "authenticated";
GRANT ALL ON TABLE "analytics"."negative_feedback" TO "service_role";



GRANT ALL ON TABLE "analytics"."post_clicks" TO "anon";
GRANT ALL ON TABLE "analytics"."post_clicks" TO "authenticated";
GRANT ALL ON TABLE "analytics"."post_clicks" TO "service_role";



GRANT ALL ON TABLE "analytics"."post_impressions" TO "anon";
GRANT ALL ON TABLE "analytics"."post_impressions" TO "authenticated";
GRANT ALL ON TABLE "analytics"."post_impressions" TO "service_role";



GRANT SELECT ON TABLE "analytics"."post_impressions_daily" TO "authenticated";
GRANT SELECT ON TABLE "analytics"."post_impressions_daily" TO "app_read";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "analytics"."post_impressions_daily" TO "app_write";



GRANT ALL ON TABLE "analytics"."post_video_counters" TO "anon";
GRANT ALL ON TABLE "analytics"."post_video_counters" TO "authenticated";
GRANT ALL ON TABLE "analytics"."post_video_counters" TO "service_role";



GRANT ALL ON TABLE "analytics"."post_views" TO "anon";
GRANT ALL ON TABLE "analytics"."post_views" TO "authenticated";
GRANT ALL ON TABLE "analytics"."post_views" TO "service_role";



GRANT ALL ON TABLE "analytics"."reports" TO "anon";
GRANT ALL ON TABLE "analytics"."reports" TO "authenticated";
GRANT ALL ON TABLE "analytics"."reports" TO "service_role";



GRANT ALL ON TABLE "analytics"."share_links" TO "anon";
GRANT ALL ON TABLE "analytics"."share_links" TO "authenticated";
GRANT ALL ON TABLE "analytics"."share_links" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_default" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_default" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_default" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202404" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202404" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202404" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202405" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202405" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202405" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202406" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202406" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202406" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202407" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202407" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202407" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202408" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202408" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202408" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202409" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202409" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202409" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202410" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202410" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202410" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202411" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202411" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202411" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202412" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202412" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202412" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202501" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202501" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202501" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202502" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202502" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202502" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202503" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202503" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202503" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202504" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202504" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202504" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202505" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202505" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202505" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202506" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202506" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202506" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202507" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202507" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202507" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202508" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202508" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202508" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202509" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202509" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202509" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202510" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202510" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202510" TO "service_role";



GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202511" TO "anon";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202511" TO "authenticated";
GRANT ALL ON TABLE "analytics"."ticket_analytics_p_202511" TO "service_role";



GRANT ALL ON TABLE "analytics"."user_event_interactions" TO "anon";
GRANT ALL ON TABLE "analytics"."user_event_interactions" TO "authenticated";
GRANT ALL ON TABLE "analytics"."user_event_interactions" TO "service_role";



GRANT ALL ON TABLE "campaigns"."ad_clicks" TO "anon";
GRANT ALL ON TABLE "campaigns"."ad_clicks" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."ad_clicks" TO "service_role";



GRANT ALL ON TABLE "campaigns"."ad_creatives" TO "anon";
GRANT ALL ON TABLE "campaigns"."ad_creatives" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."ad_creatives" TO "service_role";



GRANT ALL ON TABLE "campaigns"."ad_impressions" TO "anon";
GRANT ALL ON TABLE "campaigns"."ad_impressions" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."ad_impressions" TO "service_role";



GRANT ALL ON TABLE "campaigns"."ad_spend_ledger" TO "anon";
GRANT ALL ON TABLE "campaigns"."ad_spend_ledger" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."ad_spend_ledger" TO "service_role";



GRANT ALL ON TABLE "campaigns"."campaign_placements" TO "anon";
GRANT ALL ON TABLE "campaigns"."campaign_placements" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."campaign_placements" TO "service_role";



GRANT ALL ON TABLE "campaigns"."campaign_targeting" TO "anon";
GRANT ALL ON TABLE "campaigns"."campaign_targeting" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."campaign_targeting" TO "service_role";



GRANT ALL ON TABLE "campaigns"."campaigns" TO "anon";
GRANT ALL ON TABLE "campaigns"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."campaigns" TO "service_role";



GRANT ALL ON TABLE "campaigns"."credit_packages" TO "anon";
GRANT ALL ON TABLE "campaigns"."credit_packages" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."credit_packages" TO "service_role";



GRANT ALL ON TABLE "campaigns"."promos" TO "anon";
GRANT ALL ON TABLE "campaigns"."promos" TO "authenticated";
GRANT ALL ON TABLE "campaigns"."promos" TO "service_role";









GRANT ALL ON TABLE "events"."cultural_guides" TO "anon";
GRANT ALL ON TABLE "events"."cultural_guides" TO "authenticated";
GRANT ALL ON TABLE "events"."cultural_guides" TO "service_role";



GRANT ALL ON TABLE "events"."event_comment_reactions" TO "anon";
GRANT ALL ON TABLE "events"."event_comment_reactions" TO "authenticated";
GRANT ALL ON TABLE "events"."event_comment_reactions" TO "service_role";



GRANT ALL ON TABLE "events"."event_comments" TO "anon";
GRANT ALL ON TABLE "events"."event_comments" TO "authenticated";
GRANT ALL ON TABLE "events"."event_comments" TO "service_role";



GRANT ALL ON TABLE "events"."event_invites" TO "anon";
GRANT ALL ON TABLE "events"."event_invites" TO "authenticated";
GRANT ALL ON TABLE "events"."event_invites" TO "service_role";



GRANT ALL ON TABLE "events"."event_reactions" TO "anon";
GRANT ALL ON TABLE "events"."event_reactions" TO "authenticated";
GRANT ALL ON TABLE "events"."event_reactions" TO "service_role";



GRANT ALL ON TABLE "events"."event_roles" TO "anon";
GRANT ALL ON TABLE "events"."event_roles" TO "authenticated";
GRANT ALL ON TABLE "events"."event_roles" TO "service_role";



GRANT ALL ON TABLE "events"."event_scanners" TO "anon";
GRANT ALL ON TABLE "events"."event_scanners" TO "authenticated";
GRANT ALL ON TABLE "events"."event_scanners" TO "service_role";



GRANT ALL ON TABLE "events"."event_series" TO "anon";
GRANT ALL ON TABLE "events"."event_series" TO "authenticated";
GRANT ALL ON TABLE "events"."event_series" TO "service_role";



GRANT ALL ON TABLE "events"."event_share_assets" TO "anon";
GRANT ALL ON TABLE "events"."event_share_assets" TO "authenticated";
GRANT ALL ON TABLE "events"."event_share_assets" TO "service_role";



GRANT ALL ON TABLE "events"."events" TO "anon";
GRANT ALL ON TABLE "events"."events" TO "authenticated";
GRANT ALL ON TABLE "events"."events" TO "service_role";



GRANT ALL ON TABLE "events"."hashtags" TO "anon";
GRANT ALL ON TABLE "events"."hashtags" TO "authenticated";
GRANT ALL ON TABLE "events"."hashtags" TO "service_role";



GRANT ALL ON TABLE "events"."media_assets" TO "anon";
GRANT ALL ON TABLE "events"."media_assets" TO "authenticated";
GRANT ALL ON TABLE "events"."media_assets" TO "service_role";



GRANT ALL ON TABLE "events"."post_hashtags" TO "anon";
GRANT ALL ON TABLE "events"."post_hashtags" TO "authenticated";
GRANT ALL ON TABLE "events"."post_hashtags" TO "service_role";



GRANT ALL ON TABLE "events"."post_media" TO "anon";
GRANT ALL ON TABLE "events"."post_media" TO "authenticated";
GRANT ALL ON TABLE "events"."post_media" TO "service_role";



GRANT ALL ON TABLE "events"."post_mentions" TO "anon";
GRANT ALL ON TABLE "events"."post_mentions" TO "authenticated";
GRANT ALL ON TABLE "events"."post_mentions" TO "service_role";



GRANT ALL ON TABLE "events"."role_invites" TO "anon";
GRANT ALL ON TABLE "events"."role_invites" TO "authenticated";
GRANT ALL ON TABLE "events"."role_invites" TO "service_role";









GRANT ALL ON TABLE "messaging"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "messaging"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "messaging"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "messaging"."direct_conversations" TO "anon";
GRANT ALL ON TABLE "messaging"."direct_conversations" TO "authenticated";
GRANT ALL ON TABLE "messaging"."direct_conversations" TO "service_role";



GRANT ALL ON TABLE "messaging"."direct_messages" TO "anon";
GRANT ALL ON TABLE "messaging"."direct_messages" TO "authenticated";
GRANT ALL ON TABLE "messaging"."direct_messages" TO "service_role";



GRANT ALL ON TABLE "messaging"."message_job_recipients" TO "anon";
GRANT ALL ON TABLE "messaging"."message_job_recipients" TO "authenticated";
GRANT ALL ON TABLE "messaging"."message_job_recipients" TO "service_role";



GRANT ALL ON TABLE "messaging"."message_jobs" TO "anon";
GRANT ALL ON TABLE "messaging"."message_jobs" TO "authenticated";
GRANT ALL ON TABLE "messaging"."message_jobs" TO "service_role";



GRANT ALL ON TABLE "messaging"."message_templates" TO "anon";
GRANT ALL ON TABLE "messaging"."message_templates" TO "authenticated";
GRANT ALL ON TABLE "messaging"."message_templates" TO "service_role";



GRANT ALL ON TABLE "messaging"."notifications" TO "anon";
GRANT ALL ON TABLE "messaging"."notifications" TO "authenticated";
GRANT ALL ON TABLE "messaging"."notifications" TO "service_role";



GRANT ALL ON TABLE "ml"."user_embeddings" TO "anon";
GRANT ALL ON TABLE "ml"."user_embeddings" TO "authenticated";
GRANT ALL ON TABLE "ml"."user_embeddings" TO "service_role";



GRANT ALL ON TABLE "organizations"."org_contact_import_entries" TO "anon";
GRANT ALL ON TABLE "organizations"."org_contact_import_entries" TO "authenticated";
GRANT ALL ON TABLE "organizations"."org_contact_import_entries" TO "service_role";



GRANT ALL ON TABLE "organizations"."org_contact_imports" TO "anon";
GRANT ALL ON TABLE "organizations"."org_contact_imports" TO "authenticated";
GRANT ALL ON TABLE "organizations"."org_contact_imports" TO "service_role";



GRANT ALL ON TABLE "organizations"."org_invitations" TO "anon";
GRANT ALL ON TABLE "organizations"."org_invitations" TO "authenticated";
GRANT ALL ON TABLE "organizations"."org_invitations" TO "service_role";



GRANT ALL ON TABLE "organizations"."org_memberships" TO "anon";
GRANT ALL ON TABLE "organizations"."org_memberships" TO "authenticated";
GRANT ALL ON TABLE "organizations"."org_memberships" TO "service_role";



GRANT ALL ON TABLE "organizations"."org_wallet_transactions" TO "anon";
GRANT ALL ON TABLE "organizations"."org_wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "organizations"."org_wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "organizations"."org_wallets" TO "anon";
GRANT ALL ON TABLE "organizations"."org_wallets" TO "authenticated";
GRANT ALL ON TABLE "organizations"."org_wallets" TO "service_role";



GRANT ALL ON TABLE "organizations"."organizations" TO "anon";
GRANT ALL ON TABLE "organizations"."organizations" TO "authenticated";
GRANT ALL ON TABLE "organizations"."organizations" TO "service_role";



GRANT ALL ON TABLE "organizations"."payout_accounts" TO "anon";
GRANT ALL ON TABLE "organizations"."payout_accounts" TO "authenticated";
GRANT ALL ON TABLE "organizations"."payout_accounts" TO "service_role";



GRANT ALL ON TABLE "organizations"."payout_configurations" TO "anon";
GRANT ALL ON TABLE "organizations"."payout_configurations" TO "authenticated";
GRANT ALL ON TABLE "organizations"."payout_configurations" TO "service_role";



GRANT ALL ON TABLE "payments"."credit_lots" TO "anon";
GRANT ALL ON TABLE "payments"."credit_lots" TO "authenticated";
GRANT ALL ON TABLE "payments"."credit_lots" TO "service_role";



GRANT ALL ON TABLE "payments"."invoices" TO "anon";
GRANT ALL ON TABLE "payments"."invoices" TO "authenticated";
GRANT ALL ON TABLE "payments"."invoices" TO "service_role";



GRANT ALL ON TABLE "payments"."payout_queue" TO "anon";
GRANT ALL ON TABLE "payments"."payout_queue" TO "authenticated";
GRANT ALL ON TABLE "payments"."payout_queue" TO "service_role";



GRANT ALL ON TABLE "payments"."wallet_transactions" TO "anon";
GRANT ALL ON TABLE "payments"."wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "payments"."wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "payments"."wallets" TO "anon";
GRANT ALL ON TABLE "payments"."wallets" TO "authenticated";
GRANT ALL ON TABLE "payments"."wallets" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_analytics_daily" TO "anon";
GRANT ALL ON TABLE "public"."campaign_analytics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_analytics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_analytics_daily_secured" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_analytics_daily_secured" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."circuit_breaker_state" TO "anon";
GRANT ALL ON TABLE "public"."circuit_breaker_state" TO "authenticated";
GRANT ALL ON TABLE "public"."circuit_breaker_state" TO "service_role";



GRANT ALL ON TABLE "public"."creative_analytics_daily" TO "anon";
GRANT ALL ON TABLE "public"."creative_analytics_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."creative_analytics_daily" TO "service_role";



GRANT ALL ON TABLE "public"."creative_analytics_daily_secured" TO "authenticated";
GRANT ALL ON TABLE "public"."creative_analytics_daily_secured" TO "service_role";



GRANT ALL ON TABLE "public"."dead_letter_webhooks" TO "anon";
GRANT ALL ON TABLE "public"."dead_letter_webhooks" TO "authenticated";
GRANT ALL ON TABLE "public"."dead_letter_webhooks" TO "service_role";



GRANT ALL ON TABLE "public"."event_comments" TO "anon";
GRANT ALL ON TABLE "public"."event_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."event_comments" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_connect" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_connect" TO "service_role";



GRANT ALL ON TABLE "public"."event_connect" TO "anon";
GRANT ALL ON TABLE "public"."event_connect" TO "authenticated";
GRANT ALL ON TABLE "public"."event_connect" TO "service_role";



GRANT ALL ON TABLE "public"."event_covis" TO "anon";
GRANT ALL ON TABLE "public"."event_covis" TO "authenticated";
GRANT ALL ON TABLE "public"."event_covis" TO "service_role";



GRANT ALL ON TABLE "public"."event_posts" TO "anon";
GRANT ALL ON TABLE "public"."event_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."event_posts" TO "service_role";



GRANT ALL ON TABLE "public"."event_posts_with_meta" TO "anon";
GRANT ALL ON TABLE "public"."event_posts_with_meta" TO "authenticated";
GRANT ALL ON TABLE "public"."event_posts_with_meta" TO "service_role";



GRANT ALL ON TABLE "public"."event_reactions" TO "anon";
GRANT ALL ON TABLE "public"."event_reactions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_reactions" TO "service_role";



GRANT ALL ON TABLE "public"."event_recent_posts_top3" TO "anon";
GRANT ALL ON TABLE "public"."event_recent_posts_top3" TO "authenticated";
GRANT ALL ON TABLE "public"."event_recent_posts_top3" TO "service_role";



GRANT ALL ON TABLE "public"."event_video_kpis_daily" TO "anon";
GRANT ALL ON TABLE "public"."event_video_kpis_daily" TO "authenticated";
GRANT ALL ON TABLE "public"."event_video_kpis_daily" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."events_enhanced" TO "anon";
GRANT ALL ON TABLE "public"."events_enhanced" TO "authenticated";
GRANT ALL ON TABLE "public"."events_enhanced" TO "service_role";



GRANT ALL ON TABLE "users"."follows" TO "anon";
GRANT ALL ON TABLE "users"."follows" TO "authenticated";
GRANT ALL ON TABLE "users"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."follow_profiles" TO "anon";
GRANT ALL ON TABLE "public"."follow_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."follow_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."follow_stats" TO "anon";
GRANT ALL ON TABLE "public"."follow_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."follow_stats" TO "service_role";



GRANT ALL ON TABLE "public"."following_stats" TO "anon";
GRANT ALL ON TABLE "public"."following_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."following_stats" TO "service_role";



GRANT ALL ON TABLE "public"."follows" TO "anon";
GRANT ALL ON TABLE "public"."follows" TO "authenticated";
GRANT ALL ON TABLE "public"."follows" TO "service_role";



GRANT ALL ON TABLE "public"."idempotency_keys" TO "anon";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."idempotency_keys" TO "service_role";



GRANT ALL ON TABLE "public"."kv_store_d42c04e8" TO "anon";
GRANT ALL ON TABLE "public"."kv_store_d42c04e8" TO "authenticated";
GRANT ALL ON TABLE "public"."kv_store_d42c04e8" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsorship_packages" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsorship_packages" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsorship_packages" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_sponsorships" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_sponsorships" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_sponsorships" TO "service_role";



GRANT ALL ON TABLE "public"."messaging_inbox" TO "anon";
GRANT ALL ON TABLE "public"."messaging_inbox" TO "authenticated";
GRANT ALL ON TABLE "public"."messaging_inbox" TO "service_role";



GRANT ALL ON TABLE "ticketing"."orders" TO "anon";
GRANT ALL ON TABLE "ticketing"."orders" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."orders" TO "service_role";



GRANT ALL ON TABLE "ticketing"."tickets" TO "anon";
GRANT ALL ON TABLE "ticketing"."tickets" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."v_event_quality_score" TO "anon";
GRANT ALL ON TABLE "public"."v_event_quality_score" TO "authenticated";
GRANT ALL ON TABLE "public"."v_event_quality_score" TO "service_role";



GRANT ALL ON TABLE "public"."mv_event_quality_scores" TO "anon";
GRANT ALL ON TABLE "public"."mv_event_quality_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_event_quality_scores" TO "service_role";



GRANT ALL ON TABLE "public"."mv_event_reach_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."mv_event_reach_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_event_reach_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."mv_refresh_log" TO "anon";
GRANT ALL ON TABLE "public"."mv_refresh_log" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_refresh_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."mv_refresh_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."mv_refresh_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."mv_refresh_log_id_seq" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsor_profiles" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsor_profiles" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsor_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."mv_sponsor_event_fit_scores" TO "anon";
GRANT ALL ON TABLE "public"."mv_sponsor_event_fit_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_sponsor_event_fit_scores" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsorship_orders" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsorship_orders" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsorship_orders" TO "service_role";



GRANT ALL ON TABLE "public"."mv_sponsorship_revenue" TO "anon";
GRANT ALL ON TABLE "public"."mv_sponsorship_revenue" TO "authenticated";
GRANT ALL ON TABLE "public"."mv_sponsorship_revenue" TO "service_role";



GRANT ALL ON TABLE "ticketing"."order_items" TO "anon";
GRANT ALL ON TABLE "ticketing"."order_items" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."org_memberships" TO "anon";
GRANT ALL ON TABLE "public"."org_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."org_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."org_wallet_transactions" TO "anon";
GRANT ALL ON TABLE "public"."org_wallet_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."org_wallet_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."org_wallets" TO "anon";
GRANT ALL ON TABLE "public"."org_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."org_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."outbox" TO "anon";
GRANT ALL ON TABLE "public"."outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."outbox" TO "service_role";



GRANT ALL ON TABLE "public"."pgbench_tiers" TO "anon";
GRANT ALL ON TABLE "public"."pgbench_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."pgbench_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."request_logs" TO "anon";
GRANT ALL ON TABLE "public"."request_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."request_logs" TO "service_role";



GRANT ALL ON TABLE "public"."search_docs" TO "anon";
GRANT ALL ON TABLE "public"."search_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."search_docs" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsors" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsors" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsors" TO "service_role";



GRANT ALL ON TABLE "public"."sponsors" TO "anon";
GRANT ALL ON TABLE "public"."sponsors" TO "authenticated";
GRANT ALL ON TABLE "public"."sponsors" TO "service_role";



GRANT ALL ON TABLE "ticketing"."ticket_tiers" TO "anon";
GRANT ALL ON TABLE "ticketing"."ticket_tiers" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."ticket_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_tiers" TO "anon";
GRANT ALL ON TABLE "public"."ticket_tiers" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_tiers" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."tickets_enhanced" TO "anon";
GRANT ALL ON TABLE "public"."tickets_enhanced" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets_enhanced" TO "service_role";



GRANT ALL ON TABLE "public"."trending_posts" TO "anon";
GRANT ALL ON TABLE "public"."trending_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."trending_posts" TO "service_role";



GRANT ALL ON TABLE "public"."user_event_affinity" TO "anon";
GRANT ALL ON TABLE "public"."user_event_affinity" TO "authenticated";
GRANT ALL ON TABLE "public"."user_event_affinity" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_search" TO "anon";
GRANT ALL ON TABLE "public"."user_search" TO "authenticated";
GRANT ALL ON TABLE "public"."user_search" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsorship_matches" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsorship_matches" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsorship_matches" TO "service_role";



GRANT ALL ON TABLE "public"."v_event_marketplace" TO "anon";
GRANT ALL ON TABLE "public"."v_event_marketplace" TO "authenticated";
GRANT ALL ON TABLE "public"."v_event_marketplace" TO "service_role";



GRANT ALL ON TABLE "public"."v_event_performance_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_event_performance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_event_performance_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_event_recommended_sponsors" TO "anon";
GRANT ALL ON TABLE "public"."v_event_recommended_sponsors" TO "authenticated";
GRANT ALL ON TABLE "public"."v_event_recommended_sponsors" TO "service_role";



GRANT ALL ON TABLE "public"."v_sponsor_marketplace" TO "anon";
GRANT ALL ON TABLE "public"."v_sponsor_marketplace" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sponsor_marketplace" TO "service_role";



GRANT ALL ON TABLE "public"."v_marketplace_analytics" TO "anon";
GRANT ALL ON TABLE "public"."v_marketplace_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."v_marketplace_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."v_posts_ready" TO "anon";
GRANT ALL ON TABLE "public"."v_posts_ready" TO "authenticated";
GRANT ALL ON TABLE "public"."v_posts_ready" TO "service_role";



GRANT ALL ON TABLE "public"."v_semantic_event_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."v_semantic_event_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_semantic_event_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."v_semantic_sponsor_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."v_semantic_sponsor_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_semantic_sponsor_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."v_sponsor_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."v_sponsor_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sponsor_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."v_sponsorship_package_cards" TO "anon";
GRANT ALL ON TABLE "public"."v_sponsorship_package_cards" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sponsorship_package_cards" TO "service_role";



GRANT ALL ON TABLE "public"."v_sponsor_recommended_packages" TO "anon";
GRANT ALL ON TABLE "public"."v_sponsor_recommended_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sponsor_recommended_packages" TO "service_role";



GRANT ALL ON TABLE "public"."v_sponsorship_funnel" TO "anon";
GRANT ALL ON TABLE "public"."v_sponsorship_funnel" TO "authenticated";
GRANT ALL ON TABLE "public"."v_sponsorship_funnel" TO "service_role";



GRANT SELECT ON TABLE "ref"."countries" TO "app_read";
GRANT SELECT ON TABLE "ref"."countries" TO "app_write";



GRANT SELECT ON TABLE "ref"."currencies" TO "app_read";
GRANT SELECT ON TABLE "ref"."currencies" TO "app_write";



GRANT SELECT ON TABLE "ref"."event_categories" TO "app_read";
GRANT SELECT ON TABLE "ref"."event_categories" TO "app_write";



GRANT SELECT ON TABLE "ref"."industries" TO "app_read";
GRANT SELECT ON TABLE "ref"."industries" TO "app_write";



GRANT SELECT ON TABLE "ref"."timezones" TO "app_read";
GRANT SELECT ON TABLE "ref"."timezones" TO "app_write";



GRANT ALL ON TABLE "sponsorship"."deliverable_proofs" TO "anon";
GRANT ALL ON TABLE "sponsorship"."deliverable_proofs" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."deliverable_proofs" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."deliverables" TO "anon";
GRANT ALL ON TABLE "sponsorship"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."deliverables" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."event_sponsorships" TO "anon";
GRANT ALL ON TABLE "sponsorship"."event_sponsorships" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."event_sponsorships" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."fit_recalc_queue" TO "anon";
GRANT ALL ON TABLE "sponsorship"."fit_recalc_queue" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."fit_recalc_queue" TO "service_role";



GRANT ALL ON SEQUENCE "sponsorship"."fit_recalc_queue_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "sponsorship"."fit_recalc_queue_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "sponsorship"."fit_recalc_queue_id_seq" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."match_features" TO "anon";
GRANT ALL ON TABLE "sponsorship"."match_features" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."match_features" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."match_feedback" TO "anon";
GRANT ALL ON TABLE "sponsorship"."match_feedback" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."match_feedback" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."package_templates" TO "anon";
GRANT ALL ON TABLE "sponsorship"."package_templates" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."package_templates" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."package_variants" TO "anon";
GRANT ALL ON TABLE "sponsorship"."package_variants" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."package_variants" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."proposal_messages" TO "anon";
GRANT ALL ON TABLE "sponsorship"."proposal_messages" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."proposal_messages" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."proposal_threads" TO "anon";
GRANT ALL ON TABLE "sponsorship"."proposal_threads" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."proposal_threads" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsor_members" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsor_members" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsor_members" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsor_public_profiles" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsor_public_profiles" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsor_public_profiles" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsorship_payouts" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsorship_payouts" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsorship_payouts" TO "service_role";



GRANT ALL ON TABLE "sponsorship"."sponsorship_slas" TO "anon";
GRANT ALL ON TABLE "sponsorship"."sponsorship_slas" TO "authenticated";
GRANT ALL ON TABLE "sponsorship"."sponsorship_slas" TO "service_role";



GRANT ALL ON TABLE "ticketing"."checkout_sessions" TO "anon";
GRANT ALL ON TABLE "ticketing"."checkout_sessions" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."checkout_sessions" TO "service_role";



GRANT ALL ON TABLE "ticketing"."guest_codes" TO "anon";
GRANT ALL ON TABLE "ticketing"."guest_codes" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."guest_codes" TO "service_role";



GRANT ALL ON TABLE "ticketing"."guest_otp_codes" TO "anon";
GRANT ALL ON TABLE "ticketing"."guest_otp_codes" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."guest_otp_codes" TO "service_role";



GRANT ALL ON TABLE "ticketing"."guest_ticket_sessions" TO "anon";
GRANT ALL ON TABLE "ticketing"."guest_ticket_sessions" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."guest_ticket_sessions" TO "service_role";



GRANT ALL ON TABLE "ticketing"."inventory_operations" TO "anon";
GRANT ALL ON TABLE "ticketing"."inventory_operations" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."inventory_operations" TO "service_role";



GRANT ALL ON TABLE "ticketing"."refunds" TO "anon";
GRANT ALL ON TABLE "ticketing"."refunds" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."refunds" TO "service_role";



GRANT ALL ON TABLE "ticketing"."scan_logs" TO "anon";
GRANT ALL ON TABLE "ticketing"."scan_logs" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."scan_logs" TO "service_role";



GRANT ALL ON TABLE "ticketing"."ticket_holds" TO "anon";
GRANT ALL ON TABLE "ticketing"."ticket_holds" TO "authenticated";
GRANT ALL ON TABLE "ticketing"."ticket_holds" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "analytics" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "campaigns" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "campaigns" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "campaigns" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "campaigns" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "events" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "events" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "events" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "events" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "messaging" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "messaging" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "messaging" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "messaging" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ml" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ml" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ml" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ml" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "organizations" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "organizations" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "organizations" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "organizations" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "payments" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "payments" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "payments" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "payments" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ref" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ref" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ref" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ref" GRANT SELECT ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "sponsorship" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "sponsorship" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "sponsorship" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "sponsorship" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ticketing" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ticketing" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ticketing" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "ticketing" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "users" GRANT SELECT ON SEQUENCES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "users" GRANT SELECT,USAGE ON SEQUENCES TO "app_write";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "users" GRANT SELECT ON TABLES TO "app_read";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "users" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "app_write";



























RESET ALL;
