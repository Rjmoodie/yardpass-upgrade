-- Verify SECURITY DEFINER is set
SELECT 
  proname,
  prosecdef AS is_security_definer,
  provolatile,
  prosrc LIKE '%UNION ALL%' AS has_posts
FROM pg_proc
WHERE proname IN ('get_home_feed_ids', 'get_home_feed_ranked')
  AND pronamespace = 'public'::regnamespace;

-- If is_security_definer = false, run this:
-- ALTER FUNCTION public.get_home_feed_ids(uuid, integer, uuid, text[], double precision, double precision, double precision, text[], text) SECURITY DEFINER;
-- ALTER FUNCTION public.get_home_feed_ranked(uuid, integer, uuid, text[], double precision, double precision, double precision, text[], text) SECURITY DEFINER;

-- Test with a fresh call
SELECT 
  item_type,
  COUNT(*) as count
FROM public.get_home_feed_ranked(
  '34cce931-f181-4caf-8f05-4bcc7ee3ecaa'::uuid,
  30,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL
)
GROUP BY item_type
ORDER BY item_type;





