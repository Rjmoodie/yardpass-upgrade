-- Verify all new columns exist
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_schema = 'events' 
  AND table_name = 'event_comments'
  AND column_name IN ('is_pinned', 'parent_comment_id', 'mentions', 'deleted_at', 'reply_count')
ORDER BY column_name;
