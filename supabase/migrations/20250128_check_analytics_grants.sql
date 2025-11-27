-- ============================================================================
-- CHECK ANALYTICS PARTITIONED TABLES GRANTS
-- ============================================================================
-- Run this to verify if analytics partitioned tables are accessible to clients
-- If they're service-role only, no RLS needed (service_role bypasses RLS)
-- ============================================================================

-- Check grants on analytics partitioned tables
SELECT 
    grantee,
    table_schema,
    table_name,
    string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) as privileges
FROM information_schema.table_privileges
WHERE table_schema = 'analytics'
    AND (
        table_name LIKE 'analytics_events_%'
        OR table_name LIKE 'event_impressions_p%'
        OR table_name LIKE 'ticket_analytics_p%'
        OR table_name LIKE 'event_impressions_default'
        OR table_name LIKE 'ticket_analytics_default'
        OR table_name IN ('post_video_counters', 'ai_recommendation_events')
    )
    AND grantee IN ('anon', 'authenticated')
GROUP BY grantee, table_schema, table_name
ORDER BY table_name, grantee;

-- Summary: Count of partitioned tables accessible to clients
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '⚠️ PARTITIONED TABLES ACCESSIBLE TO CLIENTS - NEEDS RLS OR REVOKE'
        ELSE '✅ Partitioned tables are service-role only (no RLS needed)'
    END as assessment,
    COUNT(DISTINCT table_name) as tables_accessible_to_clients,
    COUNT(DISTINCT grantee) as client_roles_with_access
FROM information_schema.table_privileges
WHERE table_schema = 'analytics'
    AND (
        table_name LIKE 'analytics_events_%'
        OR table_name LIKE 'event_impressions_p%'
        OR table_name LIKE 'ticket_analytics_p%'
        OR table_name LIKE 'event_impressions_default'
        OR table_name LIKE 'ticket_analytics_default'
        OR table_name IN ('post_video_counters', 'ai_recommendation_events')
    )
    AND grantee IN ('anon', 'authenticated');


