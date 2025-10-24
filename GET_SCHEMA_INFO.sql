-- ═══════════════════════════════════════════════════════════════
-- 📊 COMPLETE SCHEMA INFORMATION SCRIPT
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor to get complete schema info

-- ───────────────────────────────────────────────────────────────
-- 1️⃣ LIST ALL SCHEMAS
-- ───────────────────────────────────────────────────────────────
SELECT 
    '1️⃣ ALL SCHEMAS' as section,
    schema_name,
    CASE 
        WHEN schema_name IN ('users', 'organizations', 'events', 'ticketing', 
                            'sponsorship', 'campaigns', 'analytics', 'messaging', 
                            'payments', 'ml', 'ref')
        THEN '✅ Custom Domain Schema'
        WHEN schema_name = 'public'
        THEN '🔵 Default Public Schema'
        ELSE '⚙️ System Schema'
    END as schema_type
FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 
                          'pg_temp_1', 'pg_toast_temp_1')
ORDER BY 
    CASE 
        WHEN schema_name IN ('users', 'organizations', 'events', 'ticketing', 
                            'sponsorship', 'campaigns', 'analytics', 'messaging', 
                            'payments', 'ml', 'ref')
        THEN 1
        WHEN schema_name = 'public' THEN 2
        ELSE 3
    END,
    schema_name;

-- ───────────────────────────────────────────────────────────────
-- 2️⃣ TABLE COUNT BY SCHEMA
-- ───────────────────────────────────────────────────────────────
SELECT 
    '2️⃣ TABLES PER SCHEMA' as section,
    table_schema,
    COUNT(CASE WHEN table_type = 'BASE TABLE' THEN 1 END) as table_count,
    COUNT(CASE WHEN table_type = 'VIEW' THEN 1 END) as view_count,
    COUNT(*) as total_objects
FROM information_schema.tables
WHERE table_schema IN ('users', 'organizations', 'events', 'ticketing', 
                       'sponsorship', 'campaigns', 'analytics', 'messaging', 
                       'payments', 'ml', 'ref', 'public')
GROUP BY table_schema
ORDER BY 
    CASE table_schema
        WHEN 'users' THEN 1
        WHEN 'organizations' THEN 2
        WHEN 'events' THEN 3
        WHEN 'ticketing' THEN 4
        WHEN 'sponsorship' THEN 5
        WHEN 'campaigns' THEN 6
        WHEN 'analytics' THEN 7
        WHEN 'messaging' THEN 8
        WHEN 'payments' THEN 9
        WHEN 'ml' THEN 10
        WHEN 'ref' THEN 11
        WHEN 'public' THEN 12
        ELSE 99
    END;

-- ───────────────────────────────────────────────────────────────
-- 3️⃣ ALL TABLES IN EACH SCHEMA
-- ───────────────────────────────────────────────────────────────
SELECT 
    '3️⃣ ALL TABLES' as section,
    table_schema,
    table_name,
    table_type,
    CASE 
        WHEN table_type = 'BASE TABLE' THEN '📋 Table'
        WHEN table_type = 'VIEW' THEN '👁️ View'
        ELSE table_type
    END as object_type
FROM information_schema.tables
WHERE table_schema IN ('users', 'organizations', 'events', 'ticketing', 
                       'sponsorship', 'campaigns', 'analytics', 'messaging', 
                       'payments', 'ml', 'ref', 'public')
ORDER BY 
    CASE table_schema
        WHEN 'users' THEN 1
        WHEN 'organizations' THEN 2
        WHEN 'events' THEN 3
        WHEN 'ticketing' THEN 4
        WHEN 'sponsorship' THEN 5
        WHEN 'campaigns' THEN 6
        WHEN 'analytics' THEN 7
        WHEN 'messaging' THEN 8
        WHEN 'payments' THEN 9
        WHEN 'ml' THEN 10
        WHEN 'ref' THEN 11
        WHEN 'public' THEN 12
    END,
    table_type DESC,
    table_name;

-- ───────────────────────────────────────────────────────────────
-- 4️⃣ ROW COUNTS (Approximate, may be slow on large tables)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '4️⃣ ROW COUNTS' as section,
    schemaname as table_schema,
    relname as table_name,
    n_live_tup as approximate_row_count
FROM pg_stat_user_tables
WHERE schemaname IN ('users', 'organizations', 'events', 'ticketing', 
                     'sponsorship', 'campaigns', 'analytics', 'messaging', 
                     'payments', 'ml', 'ref', 'public')
ORDER BY 
    CASE schemaname
        WHEN 'users' THEN 1
        WHEN 'organizations' THEN 2
        WHEN 'events' THEN 3
        WHEN 'ticketing' THEN 4
        WHEN 'sponsorship' THEN 5
        WHEN 'campaigns' THEN 6
        WHEN 'analytics' THEN 7
        WHEN 'messaging' THEN 8
        WHEN 'payments' THEN 9
        WHEN 'ml' THEN 10
        WHEN 'ref' THEN 11
        WHEN 'public' THEN 12
    END,
    n_live_tup DESC;

-- ───────────────────────────────────────────────────────────────
-- 5️⃣ FOREIGN KEY RELATIONSHIPS (Cross-Schema Connections)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '5️⃣ FOREIGN KEYS' as section,
    tc.table_schema || '.' || tc.table_name as from_table,
    kcu.column_name as from_column,
    ccu.table_schema || '.' || ccu.table_name as to_table,
    ccu.column_name as to_column,
    tc.constraint_name,
    CASE 
        WHEN tc.table_schema != ccu.table_schema 
        THEN '🔗 Cross-Schema'
        ELSE '📎 Same Schema'
    END as relationship_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema IN ('users', 'organizations', 'events', 'ticketing', 
                           'sponsorship', 'campaigns', 'analytics', 'messaging', 
                           'payments', 'ml', 'ref')
ORDER BY tc.table_schema, tc.table_name;

-- ───────────────────────────────────────────────────────────────
-- 6️⃣ INDEXES BY SCHEMA
-- ───────────────────────────────────────────────────────────────
SELECT 
    '6️⃣ INDEXES' as section,
    schemaname as table_schema,
    tablename as table_name,
    indexname as index_name,
    indexdef as index_definition
FROM pg_indexes
WHERE schemaname IN ('users', 'organizations', 'events', 'ticketing', 
                     'sponsorship', 'campaigns', 'analytics', 'messaging', 
                     'payments', 'ml', 'ref')
ORDER BY schemaname, tablename, indexname;

-- ───────────────────────────────────────────────────────────────
-- 7️⃣ VIEWS IN PUBLIC SCHEMA (Backward Compatibility)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '7️⃣ COMPATIBILITY VIEWS' as section,
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ───────────────────────────────────────────────────────────────
-- 8️⃣ FUNCTIONS BY SCHEMA
-- ───────────────────────────────────────────────────────────────
SELECT 
    '8️⃣ FUNCTIONS' as section,
    routine_schema as schema_name,
    routine_name as function_name,
    routine_type as function_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema IN ('users', 'organizations', 'events', 'ticketing', 
                         'sponsorship', 'campaigns', 'analytics', 'messaging', 
                         'payments', 'ml', 'ref', 'public')
ORDER BY routine_schema, routine_name;

-- ───────────────────────────────────────────────────────────────
-- 9️⃣ RLS POLICIES (Row Level Security)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '9️⃣ RLS POLICIES' as section,
    schemaname as table_schema,
    tablename as table_name,
    policyname as policy_name,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname IN ('users', 'organizations', 'events', 'ticketing', 
                     'sponsorship', 'campaigns', 'analytics', 'messaging', 
                     'payments', 'ml', 'ref')
ORDER BY schemaname, tablename, policyname;

-- ───────────────────────────────────────────────────────────────
-- 🔟 SCHEMA SIZE (Storage Usage)
-- ───────────────────────────────────────────────────────────────
SELECT 
    '🔟 SCHEMA SIZES' as section,
    schemaname as schema_name,
    pg_size_pretty(sum(pg_total_relation_size(schemaname||'.'||tablename))::bigint) as total_size
FROM pg_tables
WHERE schemaname IN ('users', 'organizations', 'events', 'ticketing', 
                     'sponsorship', 'campaigns', 'analytics', 'messaging', 
                     'payments', 'ml', 'ref', 'public')
GROUP BY schemaname
ORDER BY sum(pg_total_relation_size(schemaname||'.'||tablename)) DESC;

-- ───────────────────────────────────────────────────────────────
-- 1️⃣1️⃣ SUMMARY STATISTICS
-- ───────────────────────────────────────────────────────────────
SELECT 
    '1️⃣1️⃣ SUMMARY' as section,
    (SELECT COUNT(*) FROM information_schema.schemata 
     WHERE schema_name IN ('users', 'organizations', 'events', 'ticketing', 
                          'sponsorship', 'campaigns', 'analytics', 'messaging', 
                          'payments', 'ml', 'ref')) as custom_schemas,
    (SELECT COUNT(*) FROM information_schema.tables 
     WHERE table_schema IN ('users', 'organizations', 'events', 'ticketing', 
                           'sponsorship', 'campaigns', 'analytics', 'messaging', 
                           'payments', 'ml', 'ref')
     AND table_type = 'BASE TABLE') as total_tables,
    (SELECT COUNT(*) FROM information_schema.views 
     WHERE table_schema = 'public') as compatibility_views,
    (SELECT COUNT(*) FROM information_schema.table_constraints 
     WHERE constraint_type = 'FOREIGN KEY'
     AND table_schema IN ('users', 'organizations', 'events', 'ticketing', 
                         'sponsorship', 'campaigns', 'analytics', 'messaging', 
                         'payments', 'ml', 'ref')) as foreign_keys,
    (SELECT COUNT(*) FROM pg_policies 
     WHERE schemaname IN ('users', 'organizations', 'events', 'ticketing', 
                         'sponsorship', 'campaigns', 'analytics', 'messaging', 
                         'payments', 'ml', 'ref')) as rls_policies;

