-- Check if creatives exist for your campaign
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.status as campaign_status,
  COUNT(ac.id) as total_creatives,
  COUNT(ac.id) FILTER (WHERE ac.active = true) as active_creatives,
  json_agg(
    json_build_object(
      'id', ac.id,
      'headline', ac.headline,
      'media_type', ac.media_type,
      'active', ac.active,
      'created_at', ac.created_at
    )
  ) FILTER (WHERE ac.id IS NOT NULL) as creatives_list
FROM campaigns.campaigns c
LEFT JOIN campaigns.ad_creatives ac ON ac.campaign_id = c.id
WHERE c.name LIKE '%test%' -- adjust this to match your campaign name
GROUP BY c.id, c.name, c.status
ORDER BY c.created_at DESC
LIMIT 5;

