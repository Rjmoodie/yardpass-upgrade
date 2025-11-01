-- =====================================================
-- SPONSORSHIP SYSTEM: SEED DATA FOR TESTING
-- =====================================================
-- This migration creates sample data to test the sponsorship matching system
-- Safe to run in dev/staging - skip in production

-- Only run if we don't have existing sponsorship data
DO $$
BEGIN
  -- Check if we already have sponsors
  IF NOT EXISTS (SELECT 1 FROM public.sponsors LIMIT 1) THEN
    
    -- =====================================================
    -- 1. CREATE SAMPLE SPONSORS
    -- =====================================================
    INSERT INTO public.sponsors (
      id, 
      name, 
      logo_url, 
      website_url, 
      description,
      industry,
      company_size,
      brand_values
    )
    VALUES
      (
        '00000000-0000-0000-0000-000000000001', 
        'TechCorp Industries', 
        'https://via.placeholder.com/200', 
        'https://techcorp.example.com',
        'Leading technology solutions for enterprise clients',
        'Technology',
        'enterprise',
        '{"innovation": true, "reliability": true, "cutting_edge": true}'
      ),
      (
        '00000000-0000-0000-0000-000000000002', 
        'GreenEarth Solutions', 
        'https://via.placeholder.com/200', 
        'https://greenearth.example.com',
        'Sustainable products and eco-friendly solutions',
        'Sustainability',
        'mid_market',
        '{"eco_friendly": true, "community": true, "transparency": true}'
      ),
      (
        '00000000-0000-0000-0000-000000000003', 
        'Athletic Pro Gear', 
        'https://via.placeholder.com/200', 
        'https://athleticpro.example.com',
        'Premium athletic equipment and sportswear',
        'Sports & Fitness',
        'mid_market',
        '{"performance": true, "quality": true, "athlete_endorsed": true}'
      )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Created sample sponsors';
  END IF;

  -- =====================================================
  -- 2. CREATE SPONSOR PROFILES
  -- =====================================================
  IF NOT EXISTS (SELECT 1 FROM public.sponsor_profiles LIMIT 1) THEN
    -- Insert profiles for each sponsor (check if they exist first)
    IF NOT EXISTS (SELECT 1 FROM public.sponsor_profiles WHERE sponsor_id = '00000000-0000-0000-0000-000000000001'::uuid) THEN
      INSERT INTO public.sponsor_profiles (
        sponsor_id, 
        industry, 
        company_size, 
        annual_budget_cents,
        brand_objectives,
        target_audience,
        preferred_categories,
        regions,
        activation_preferences
      )
      VALUES
        (
          '00000000-0000-0000-0000-000000000001'::uuid,
          'Technology',
          'enterprise',
          25000000, -- $250k
          '{"awareness": true, "lead_generation": true}'::jsonb,
          '{"age": "25-44", "income": "high"}'::jsonb,
          ARRAY['Tech', 'Business', 'Innovation'],
          ARRAY['California', 'New York', 'Texas'],
          '{"booth": true, "speaking_slot": true}'::jsonb
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sponsor_profiles WHERE sponsor_id = '00000000-0000-0000-0000-000000000002'::uuid) THEN
      INSERT INTO public.sponsor_profiles (
        sponsor_id, 
        industry, 
        company_size, 
        annual_budget_cents,
        brand_objectives,
        target_audience,
        preferred_categories,
        regions,
        activation_preferences
      )
      VALUES
        (
          '00000000-0000-0000-0000-000000000002'::uuid,
          'Sustainability',
          'mid_market',
          10000000, -- $100k
          '{"brand_building": true, "community": true}'::jsonb,
          '{"age": "18-54", "values": "eco-conscious"}'::jsonb,
          ARRAY['Environmental', 'Community', 'Lifestyle'],
          ARRAY['Oregon', 'Washington', 'Colorado'],
          '{"sampling": true, "content": true}'::jsonb
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.sponsor_profiles WHERE sponsor_id = '00000000-0000-0000-0000-000000000003'::uuid) THEN
      INSERT INTO public.sponsor_profiles (
        sponsor_id, 
        industry, 
        company_size, 
        annual_budget_cents,
        brand_objectives,
        target_audience,
        preferred_categories,
        regions,
        activation_preferences
      )
      VALUES
        (
          '00000000-0000-0000-0000-000000000003'::uuid,
          'Sports & Fitness',
          'mid_market',
          15000000, -- $150k
          '{"product_launch": true, "athlete_partnerships": true}'::jsonb,
          '{"age": "18-35", "interests": "fitness"}'::jsonb,
          ARRAY['Sports', 'Fitness', 'Health'],
          ARRAY['California', 'Florida', 'Arizona'],
          '{"product_demo": true, "athlete_meet": true}'::jsonb
        );
    END IF;

    RAISE NOTICE 'Created sample sponsor profiles';
  END IF;

  -- =====================================================
  -- 3. CREATE SAMPLE EVENT AUDIENCE INSIGHTS
  -- (Only for events that exist in the system)
  -- =====================================================
  
  -- Get a few existing event IDs (if any)
  DECLARE
    event_ids uuid[];
  BEGIN
    SELECT ARRAY_AGG(id) INTO event_ids 
    FROM public.events 
    LIMIT 3;

    IF array_length(event_ids, 1) > 0 THEN
      -- Upsert insights for first event using a different approach
      -- Delete and re-insert to avoid conflict issues
      DELETE FROM public.event_audience_insights WHERE event_id = event_ids[1];
      
      INSERT INTO public.event_audience_insights (
        event_id,
        attendee_count,
        avg_dwell_time_ms,
        geo_distribution,
        age_segments,
        engagement_score,
        ticket_conversion_rate,
        social_mentions,
        sentiment_score
      )
      VALUES
        (
          event_ids[1],
          500,
          180000, -- 3 minutes
          '{"California": 250, "New York": 150, "Texas": 100}'::jsonb,
          '{"18-24": 0.2, "25-34": 0.4, "35-44": 0.25, "45+": 0.15}'::jsonb,
          0.78,
          0.35,
          125,
          0.82
        );

      RAISE NOTICE 'Created sample event audience insights for % events', array_length(event_ids, 1);
    END IF;
  END;

  -- =====================================================
  -- 4. TRIGGER INITIAL MATCH CALCULATIONS
  -- =====================================================
  
  -- Queue initial recalculations for all sponsor-event pairs
  -- Only insert if not already in queue
  INSERT INTO public.fit_recalc_queue (event_id, sponsor_id, reason, queued_at)
  SELECT 
    e.id AS event_id,
    sp.sponsor_id,
    'initial_seed' AS reason,
    now() AS queued_at
  FROM public.events e
  CROSS JOIN public.sponsor_profiles sp
  WHERE NOT EXISTS (
    SELECT 1 FROM public.fit_recalc_queue frq
    WHERE frq.event_id = e.id 
    AND frq.sponsor_id = sp.sponsor_id
    AND frq.processed_at IS NULL
  )
  LIMIT 50; -- Limit to avoid overwhelming the queue

  RAISE NOTICE 'Queued initial match calculations';

END $$;

-- =====================================================
-- 5. CREATE SAMPLE SPONSORSHIP PACKAGES
-- (Only if we have events)
-- =====================================================
DO $$
DECLARE
  event_ids uuid[];
  pkg_count integer := 0;
BEGIN
  SELECT ARRAY_AGG(id) INTO event_ids 
  FROM public.events 
  WHERE start_at > now()
  LIMIT 5;

  IF array_length(event_ids, 1) > 0 THEN
    -- Create packages for each event
    FOR i IN 1..array_length(event_ids, 1) LOOP
      -- Note: sponsorship_packages is a view, insert into underlying table
      INSERT INTO sponsorship.sponsorship_packages (
        event_id,
        title,
        tier,
        price_cents,
        currency,
        inventory,
        sold,
        benefits,
        visibility,
        is_active,
        expected_reach,
        avg_engagement_score,
        package_type
      )
      VALUES
        (
          event_ids[i],
          'Gold Sponsorship',
          'Gold',
          500000, -- $5,000
          'USD',
          2,
          0,
          '{"logo_placement": "prominent", "speaking_slot": true, "booth_space": "premium"}',
          'public',
          true,
          5000,
          0.75,
          'standard'
        ),
        (
          event_ids[i],
          'Silver Sponsorship',
          'Silver',
          250000, -- $2,500
          'USD',
          5,
          0,
          '{"logo_placement": "standard", "booth_space": "standard"}',
          'public',
          true,
          2500,
          0.70,
          'standard'
        ),
        (
          event_ids[i],
          'Bronze Sponsorship',
          'Bronze',
          100000, -- $1,000
          'USD',
          10,
          0,
          '{"logo_placement": "small", "social_mentions": true}',
          'public',
          true,
          1000,
          0.65,
          'standard'
        )
      ON CONFLICT DO NOTHING;
      
      pkg_count := pkg_count + 3;
    END LOOP;

    RAISE NOTICE 'Created % sample sponsorship packages', pkg_count;
  END IF;
END $$;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Sponsorship seed data migration complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Wait 10 minutes for cron job to process queue';
  RAISE NOTICE '2. Or manually trigger: SELECT process_match_queue(50);';
  RAISE NOTICE '3. View matches: SELECT * FROM sponsorship_matches;';
  RAISE NOTICE '4. Test UI components with the sample data';
END $$;

