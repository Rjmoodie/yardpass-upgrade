-- Create execute_sql function for analytics queries
CREATE OR REPLACE FUNCTION public.execute_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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