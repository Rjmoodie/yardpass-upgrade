-- Harden campaign delivery with pacing-aware spend charging
ALTER TABLE public.campaign_placements
  ADD COLUMN IF NOT EXISTS default_rate_model TEXT NOT NULL DEFAULT 'cpm' CHECK (default_rate_model IN ('cpm','cpc')),
  ADD COLUMN IF NOT EXISTS cpm_rate_credits INTEGER NOT NULL DEFAULT 65 CHECK (cpm_rate_credits >= 0),
  ADD COLUMN IF NOT EXISTS cpc_rate_credits INTEGER CHECK (cpc_rate_credits IS NULL OR cpc_rate_credits >= 0);

COMMENT ON COLUMN public.campaign_placements.default_rate_model IS 'Primary billing model for the placement (cpm or cpc).';
COMMENT ON COLUMN public.campaign_placements.cpm_rate_credits IS 'Credits charged per 1,000 impressions for this placement.';
COMMENT ON COLUMN public.campaign_placements.cpc_rate_credits IS 'Credits charged per click when using CPC pacing.';

-- Ensure we always have a wallet reference when returning creatives
CREATE OR REPLACE FUNCTION public.get_active_campaign_creatives(
  p_placement public.ad_placement,
  p_limit integer DEFAULT 8,
  p_user_id uuid DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  campaign_id uuid,
  creative_id uuid,
  org_id uuid,
  event_id uuid,
  post_id uuid,
  objective public.campaign_objective,
  pacing_strategy public.pacing_strategy,
  headline text,
  body_text text,
  cta_label text,
  cta_url text,
  media_type public.creative_media_type,
  media_url text,
  poster_url text,
  event_title text,
  event_description text,
  event_cover_image text,
  event_starts_at timestamptz,
  event_location text,
  event_city text,
  event_category text,
  organizer_name text,
  organizer_id uuid,
  owner_context_type text,
  priority numeric,
  frequency_cap_per_user integer,
  frequency_cap_period public.frequency_period,
  targeting jsonb,
  default_rate_model text,
  cpm_rate_credits integer,
  cpc_rate_credits integer,
  remaining_credits integer,
  daily_remaining integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible_campaigns AS (
    SELECT
      c.id,
      c.org_id,
      c.objective,
      c.pacing_strategy,
      c.total_budget_credits,
      c.spent_credits,
      c.start_date,
      c.end_date,
      c.frequency_cap_per_user,
      c.frequency_cap_period,
      c.daily_budget_credits,
      c.timezone,
      cp.placement,
      cp.default_rate_model,
      cp.cpm_rate_credits,
      cp.cpc_rate_credits,
      ct.locations,
      ct.categories,
      ct.keywords,
      ct.exclude_ticket_holders,
      ct.exclude_past_attendees,
      COALESCE(bal.balance_credits, 0) AS wallet_balance,
      COALESCE(spend_today.spent_today, 0) AS spent_today
    FROM public.campaigns c
    JOIN public.campaign_placements cp ON cp.campaign_id = c.id
    LEFT JOIN public.campaign_targeting ct ON ct.campaign_id = c.id
    LEFT JOIN LATERAL (
      SELECT ow.balance_credits
      FROM public.org_wallets ow
      WHERE ow.org_id = c.org_id
      ORDER BY ow.created_at
      LIMIT 1
    ) bal ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(credits_charged), 0) AS spent_today
      FROM public.ad_spend_ledger l
      WHERE l.campaign_id = c.id
        AND l.occurred_at >= ((date_trunc('day', (p_now AT TIME ZONE c.timezone))) AT TIME ZONE c.timezone)
        AND l.occurred_at < (((date_trunc('day', (p_now AT TIME ZONE c.timezone)) + interval '1 day')) AT TIME ZONE c.timezone)
    ) spend_today ON TRUE
    WHERE cp.placement = p_placement
      AND cp.enabled = TRUE
      AND c.status = 'active'
      AND c.start_date <= p_now
      AND (c.end_date IS NULL OR c.end_date >= p_now)
      AND c.total_budget_credits > c.spent_credits
      AND (c.daily_budget_credits IS NULL OR spend_today.spent_today < c.daily_budget_credits)
      AND COALESCE(bal.balance_credits, 0) > 0
  ),
  eligible_creatives AS (
    SELECT
      ec.*, 
      ac.id AS creative_id,
      ac.headline,
      ac.body_text,
      ac.cta_label,
      ac.cta_url,
      ac.media_type,
      ac.media_url,
      ac.poster_url,
      ac.post_id,
      ac.updated_at
    FROM eligible_campaigns ec
    JOIN public.ad_creatives ac ON ac.campaign_id = ec.id AND ac.active = TRUE
  ),
  creative_events AS (
    SELECT
      ec.id AS campaign_id,
      ec.org_id,
      ec.objective,
      ec.pacing_strategy,
      ec.total_budget_credits,
      ec.spent_credits,
      ec.start_date,
      ec.end_date,
      ec.frequency_cap_per_user,
      ec.frequency_cap_period,
      ec.daily_budget_credits,
      ec.timezone,
      ec.default_rate_model,
      ec.cpm_rate_credits,
      ec.cpc_rate_credits,
      ec.wallet_balance,
      ec.spent_today,
      ec.locations,
      ec.categories,
      ec.keywords,
      ec.exclude_ticket_holders,
      ec.exclude_past_attendees,
      ec.placement,
      ec.creative_id,
      ec.headline,
      ec.body_text,
      ec.cta_label,
      ec.cta_url,
      ec.media_type,
      ec.media_url,
      ec.poster_url,
      ec.post_id,
      ec.updated_at,
      COALESCE(ep.event_id, e.id) AS event_id,
      e.title AS event_title,
      e.description AS event_description,
      e.cover_image_url AS event_cover_image,
      e.start_at AS event_starts_at,
      e.city AS event_city,
      e.category AS event_category,
      e.venue,
      e.owner_context_type,
      e.owner_context_id,
      e.created_by,
      e.visibility
    FROM eligible_creatives ec
    LEFT JOIN public.event_posts ep ON ep.id = ec.post_id
    LEFT JOIN public.events e ON e.id = COALESCE(ep.event_id, ec.post_id)
  )
  SELECT
    ce.campaign_id,
    ce.creative_id,
    ce.org_id,
    ce.event_id,
    ce.post_id,
    ce.objective,
    ce.pacing_strategy,
    ce.headline,
    ce.body_text,
    ce.cta_label,
    ce.cta_url,
    ce.media_type,
    ce.media_url,
    ce.poster_url,
    ce.event_title,
    ce.event_description,
    ce.event_cover_image,
    ce.event_starts_at,
    CASE
      WHEN ce.venue IS NOT NULL AND ce.event_city IS NOT NULL THEN ce.venue || ', ' || ce.event_city
      WHEN ce.venue IS NOT NULL THEN ce.venue
      ELSE ce.event_city
    END AS event_location,
    ce.event_city,
    ce.event_category,
    CASE
      WHEN ce.owner_context_type = 'organization' THEN org.name
      ELSE prof.display_name
    END AS organizer_name,
    CASE
      WHEN ce.owner_context_type = 'organization' THEN ce.owner_context_id
      ELSE ce.created_by
    END AS organizer_id,
    ce.owner_context_type,
    (
      CASE WHEN ce.pacing_strategy = 'accelerated' THEN 1.4 ELSE 1 END
      + COALESCE(GREATEST(0, LEAST(1, (ce.total_budget_credits - ce.spent_credits)::numeric / NULLIF(ce.total_budget_credits, 0))), 0)
      + LEAST(1.0, COALESCE(EXTRACT(EPOCH FROM (p_now - ce.updated_at)) / 86400.0, 1.0) * -0.1 + 1.0)
    ) AS priority,
    ce.frequency_cap_per_user,
    ce.frequency_cap_period,
    jsonb_strip_nulls(jsonb_build_object(
      'locations', ce.locations,
      'categories', ce.categories,
      'keywords', ce.keywords,
      'exclude_ticket_holders', ce.exclude_ticket_holders,
      'exclude_past_attendees', ce.exclude_past_attendees
    )) AS targeting,
    ce.default_rate_model,
    ce.cpm_rate_credits,
    ce.cpc_rate_credits,
    GREATEST(0, ce.total_budget_credits - ce.spent_credits) AS remaining_credits,
    CASE
      WHEN ce.daily_budget_credits IS NULL THEN NULL
      ELSE GREATEST(0, ce.daily_budget_credits - ce.spent_today)
    END AS daily_remaining
  FROM creative_events ce
  LEFT JOIN public.organizations org ON org.id = ce.owner_context_id
  LEFT JOIN public.user_profiles prof ON prof.user_id = ce.created_by
  WHERE ce.event_id IS NOT NULL
    AND (ce.visibility IS NULL OR ce.visibility = 'public')
  ORDER BY priority DESC, ce.updated_at DESC
  LIMIT COALESCE(NULLIF(p_limit, 0), 8);
$$;

GRANT EXECUTE ON FUNCTION public.get_active_campaign_creatives(public.ad_placement, integer, uuid, timestamptz)
TO anon, authenticated;

-- Transactional impression logger that charges wallets
CREATE OR REPLACE FUNCTION public.log_impression_and_charge(
  p_campaign_id uuid,
  p_creative_id uuid DEFAULT NULL,
  p_event_id uuid DEFAULT NULL,
  p_post_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_placement public.ad_placement,
  p_user_agent text DEFAULT NULL,
  p_ip_address text DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS TABLE (
  impression_id uuid,
  charged_credits integer,
  remaining_budget integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign campaigns%ROWTYPE;
  v_wallet RECORD;
  v_charge integer;
  v_rate_model text;
  v_cpm_rate integer;
  v_cpc_rate integer;
  v_daily_spent integer;
  v_local_date date;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_wallet_tx_id uuid;
  v_frequency_window_start timestamptz;
  v_frequency_count integer;
BEGIN
  IF p_user_id IS NULL AND (p_session_id IS NULL OR length(trim(p_session_id)) = 0) THEN
    RAISE EXCEPTION 'session_id required for anonymous delivery';
  END IF;

  SELECT *
  INTO v_campaign
  FROM campaigns
  WHERE id = p_campaign_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  IF v_campaign.status <> 'active' THEN
    RAISE EXCEPTION 'Campaign not active';
  END IF;

  IF p_now < v_campaign.start_date OR (v_campaign.end_date IS NOT NULL AND p_now > v_campaign.end_date) THEN
    RAISE EXCEPTION 'Campaign out of flight';
  END IF;

  SELECT default_rate_model, cpm_rate_credits, cpc_rate_credits
  INTO v_rate_model, v_cpm_rate, v_cpc_rate
  FROM campaign_placements
  WHERE campaign_id = p_campaign_id
    AND placement = p_placement
    AND enabled = TRUE
  LIMIT 1;

  IF v_rate_model IS NULL THEN
    RAISE EXCEPTION 'Placement disabled';
  END IF;

  IF v_rate_model = 'cpm' THEN
    v_charge := CEIL(1::numeric * v_cpm_rate / 1000.0);
    IF v_charge < 1 THEN
      v_charge := 1;
    END IF;
  ELSIF v_rate_model = 'cpc' THEN
    v_charge := GREATEST(1, COALESCE(v_cpc_rate, 0));
  ELSE
    RAISE EXCEPTION 'Unsupported rate model %', v_rate_model;
  END IF;

  IF v_campaign.total_budget_credits - v_campaign.spent_credits < v_charge THEN
    RAISE EXCEPTION 'Campaign budget exhausted';
  END IF;

  IF v_campaign.frequency_cap_per_user IS NOT NULL THEN
    IF v_campaign.frequency_cap_period = 'week' THEN
      v_frequency_window_start := p_now - interval '7 days';
    ELSIF v_campaign.frequency_cap_period = 'day' THEN
      v_frequency_window_start := p_now - interval '1 day';
    ELSIF v_campaign.frequency_cap_period = 'session' THEN
      v_frequency_window_start := p_now - interval '4 hours';
    ELSE
      v_frequency_window_start := NULL;
    END IF;

    SELECT COUNT(*)
    INTO v_frequency_count
    FROM ad_impressions
    WHERE campaign_id = p_campaign_id
      AND (
        (p_user_id IS NOT NULL AND user_id = p_user_id)
        OR (p_user_id IS NULL AND p_session_id IS NOT NULL AND session_id = p_session_id)
      )
      AND (v_frequency_window_start IS NULL OR created_at >= v_frequency_window_start);

    IF v_frequency_count >= v_campaign.frequency_cap_per_user THEN
      RAISE EXCEPTION 'Frequency cap reached';
    END IF;
  END IF;

  IF v_campaign.daily_budget_credits IS NOT NULL THEN
    v_local_date := (p_now AT TIME ZONE v_campaign.timezone)::date;
    v_day_start := (v_local_date::timestamp) AT TIME ZONE v_campaign.timezone;
    v_day_end := ((v_local_date + 1)::timestamp) AT TIME ZONE v_campaign.timezone;

    SELECT COALESCE(SUM(credits_charged), 0)
    INTO v_daily_spent
    FROM ad_spend_ledger
    WHERE campaign_id = p_campaign_id
      AND occurred_at >= v_day_start
      AND occurred_at < v_day_end;

    IF v_daily_spent + v_charge > v_campaign.daily_budget_credits THEN
      RAISE EXCEPTION 'Daily budget exhausted';
    END IF;
  END IF;

  SELECT id, balance_credits, status
  INTO v_wallet
  FROM org_wallets
  WHERE org_id = v_campaign.org_id
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization wallet missing';
  END IF;

  IF v_wallet.status = 'frozen' THEN
    RAISE EXCEPTION 'Wallet frozen';
  END IF;

  IF v_wallet.balance_credits < v_charge THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  INSERT INTO ad_impressions (campaign_id, creative_id, event_id, post_id, user_id, session_id, placement, user_agent, ip_address)
  VALUES (p_campaign_id, p_creative_id, p_event_id, p_post_id, p_user_id, p_session_id, p_placement, p_user_agent, p_ip_address)
  RETURNING id INTO impression_id;

  UPDATE campaigns
  SET spent_credits = spent_credits + v_charge,
      updated_at = now()
  WHERE id = p_campaign_id;

  INSERT INTO org_wallet_transactions (wallet_id, credits_delta, transaction_type, description, reference_type, reference_id, metadata)
  VALUES (v_wallet.id, -v_charge, 'spend', 'Ad impression charge', 'campaign', p_campaign_id, jsonb_build_object('impression_id', impression_id, 'placement', p_placement))
  RETURNING id INTO v_wallet_tx_id;

  UPDATE org_wallets
  SET balance_credits = balance_credits - v_charge,
      updated_at = now()
  WHERE id = v_wallet.id;

  INSERT INTO ad_spend_ledger (campaign_id, creative_id, event_id, metric_type, quantity, rate_model, rate_usd_cents, credits_charged, occurred_at, org_wallet_id, wallet_transaction_id)
  VALUES (p_campaign_id, p_creative_id, p_event_id, 'impression', 1, v_rate_model, CASE WHEN v_rate_model = 'cpm' THEN v_cpm_rate ELSE v_cpc_rate END, v_charge, p_now, v_wallet.id, v_wallet_tx_id);

  SELECT GREATEST(0, total_budget_credits - spent_credits)
  INTO remaining_budget
  FROM campaigns
  WHERE id = p_campaign_id;

  charged_credits := v_charge;
  RETURN;
END;
$$;

-- Lightweight click logger for attribution
CREATE OR REPLACE FUNCTION public.log_ad_click_event(
  p_campaign_id uuid,
  p_creative_id uuid DEFAULT NULL,
  p_impression_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_now timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_click_id uuid;
BEGIN
  IF p_user_id IS NULL AND (p_session_id IS NULL OR length(trim(p_session_id)) = 0) THEN
    RAISE EXCEPTION 'session_id required for anonymous click';
  END IF;

  INSERT INTO ad_clicks (campaign_id, creative_id, impression_id, user_id, session_id, created_at)
  VALUES (p_campaign_id, p_creative_id, p_impression_id, p_user_id, p_session_id, p_now)
  RETURNING id INTO v_click_id;

  RETURN v_click_id;
END;
$$;
