-- Check actual structure of ai_recommendation_events table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'analytics'
  AND table_name = 'ai_recommendation_events'
ORDER BY ordinal_position;

