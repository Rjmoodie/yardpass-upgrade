-- =====================================================
-- PHASE 3: INTELLIGENCE - PGVECTOR & EMBEDDINGS
-- =====================================================
-- This migration enables pgvector extension and adds vector embeddings
-- for semantic similarity search and AI-powered matching

-- =====================================================
-- 1. ENABLE PGVECTOR EXTENSION
-- =====================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- 2. ADD VECTOR COLUMNS TO EXISTING TABLES
-- =====================================================

-- Add vector embedding column to sponsor_profiles
ALTER TABLE public.sponsor_profiles 
ADD COLUMN IF NOT EXISTS objectives_embedding vector(1536);

-- Add vector embedding column to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS description_embedding vector(1536);

-- =====================================================
-- 3. CREATE VECTOR INDEXES
-- =====================================================

-- Create HNSW indexes for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_objectives_embedding_hnsw 
ON public.sponsor_profiles 
USING hnsw (objectives_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_events_description_embedding_hnsw 
ON public.events 
USING hnsw (description_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- =====================================================
-- 4. CREATE VECTOR SIMILARITY FUNCTIONS
-- =====================================================

-- Function to find similar sponsors by objectives
CREATE OR REPLACE FUNCTION public.find_similar_sponsors(
  p_objectives_embedding vector(1536),
  p_limit integer DEFAULT 10,
  p_threshold numeric DEFAULT 0.7
)
RETURNS TABLE (
  sponsor_id uuid,
  similarity_score numeric,
  sponsor_name text,
  industry text
)
LANGUAGE sql
STABLE
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

-- Function to find similar events by description
CREATE OR REPLACE FUNCTION public.find_similar_events(
  p_description_embedding vector(1536),
  p_limit integer DEFAULT 10,
  p_threshold numeric DEFAULT 0.7
)
RETURNS TABLE (
  event_id uuid,
  similarity_score numeric,
  event_title text,
  category text
)
LANGUAGE sql
STABLE
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

-- =====================================================
-- 5. CREATE SEMANTIC MATCHING FUNCTION
-- =====================================================

-- Advanced function for semantic sponsor-event matching
CREATE OR REPLACE FUNCTION public.semantic_sponsor_event_match(
  p_sponsor_id uuid,
  p_event_id uuid
)
RETURNS TABLE (
  match_score numeric,
  semantic_similarity numeric,
  objectives_alignment numeric,
  description_alignment numeric
)
LANGUAGE plpgsql
STABLE
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

-- =====================================================
-- 6. CREATE VECTOR UPDATE TRIGGERS
-- =====================================================

-- Function to update sponsor objectives embedding
CREATE OR REPLACE FUNCTION public.update_sponsor_objectives_embedding()
RETURNS trigger
LANGUAGE plpgsql
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

-- Function to update event description embedding
CREATE OR REPLACE FUNCTION public.update_event_description_embedding()
RETURNS trigger
LANGUAGE plpgsql
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

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_sponsor_objectives_embedding ON public.sponsor_profiles;
CREATE TRIGGER trigger_update_sponsor_objectives_embedding
  BEFORE INSERT OR UPDATE ON public.sponsor_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sponsor_objectives_embedding();

DROP TRIGGER IF EXISTS trigger_update_event_description_embedding ON public.events;
CREATE TRIGGER trigger_update_event_description_embedding
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_event_description_embedding();

-- =====================================================
-- 7. CREATE SEMANTIC MARKETPLACE VIEWS
-- =====================================================

-- View for semantic event recommendations
CREATE OR REPLACE VIEW public.v_semantic_event_recommendations AS
SELECT
  s.id AS sponsor_id,
  s.name AS sponsor_name,
  sp.industry,
  sp.annual_budget_cents,
  e.id AS event_id,
  e.title AS event_title,
  e.category,
  e.start_at,
  sem.match_score,
  sem.semantic_similarity,
  sem.objectives_alignment,
  sem.description_alignment,
  eqs.final_quality_score,
  eqs.quality_tier
FROM public.sponsors s
JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
CROSS JOIN public.events e
CROSS JOIN LATERAL public.semantic_sponsor_event_match(s.id, e.id) sem
LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
WHERE sp.objectives_embedding IS NOT NULL
AND e.description_embedding IS NOT NULL
AND sem.match_score > 0.5
ORDER BY s.id, sem.match_score DESC;

-- View for semantic sponsor recommendations
CREATE OR REPLACE VIEW public.v_semantic_sponsor_recommendations AS
SELECT
  e.id AS event_id,
  e.title AS event_title,
  e.category,
  e.start_at,
  s.id AS sponsor_id,
  s.name AS sponsor_name,
  sp.industry,
  sp.annual_budget_cents,
  sem.match_score,
  sem.semantic_similarity,
  sem.objectives_alignment,
  sem.description_alignment,
  eqs.final_quality_score,
  eqs.quality_tier
FROM public.events e
CROSS JOIN public.sponsors s
JOIN public.sponsor_profiles sp ON sp.sponsor_id = s.id
CROSS JOIN LATERAL public.semantic_sponsor_event_match(s.id, e.id) sem
LEFT JOIN public.mv_event_quality_scores eqs ON eqs.event_id = e.id
WHERE sp.objectives_embedding IS NOT NULL
AND e.description_embedding IS NOT NULL
AND sem.match_score > 0.5
ORDER BY e.id, sem.match_score DESC;

-- =====================================================
-- 8. CREATE VECTOR SIMILARITY INDEXES
-- =====================================================

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sponsor_profiles_industry_budget 
ON public.sponsor_profiles (industry, annual_budget_cents);

CREATE INDEX IF NOT EXISTS idx_events_category_start_at 
ON public.events (category, start_at);

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON EXTENSION vector IS 'Enables vector similarity search with pgvector';
COMMENT ON COLUMN public.sponsor_profiles.objectives_embedding IS 'Vector embedding of sponsor objectives for semantic matching';
COMMENT ON COLUMN public.events.description_embedding IS 'Vector embedding of event description for semantic matching';
COMMENT ON FUNCTION public.find_similar_sponsors(vector, integer, numeric) IS 'Finds sponsors with similar objectives using vector similarity';
COMMENT ON FUNCTION public.find_similar_events(vector, integer, numeric) IS 'Finds events with similar descriptions using vector similarity';
COMMENT ON FUNCTION public.semantic_sponsor_event_match(uuid, uuid) IS 'Calculates semantic similarity between sponsor and event';
COMMENT ON VIEW public.v_semantic_event_recommendations IS 'Semantic event recommendations for sponsors';
COMMENT ON VIEW public.v_semantic_sponsor_recommendations IS 'Semantic sponsor recommendations for events';
