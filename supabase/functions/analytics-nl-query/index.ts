import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import OpenAI from "npm:openai@4.56.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const openai = new OpenAI({ apiKey: OPENAI_API_KEY ?? "" });

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OpenAI API key not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query, org_id } = await req.json();

    // Schema information for the AI to understand available data
    const schemaInfo = `
Available tables and key fields:
- events: id, title, start_at, end_at, visibility, created_by (user_id), owner_context_id (org_id), owner_context_type, venue, city
- tickets: id, event_id, owner_user_id, tier_id, status (issued, transferred, redeemed)
- ticket_tiers: id, event_id, name, price_cents, quantity, badge_label
- orders: id, event_id, total_cents, fees_cents, status, paid_at
- order_items: id, order_id, tier_id, quantity
- event_posts: id, event_id, text, like_count, comment_count, author_user_id
- event_reactions: id, post_id, user_id, kind (like, comment)
- scan_logs: id, event_id, ticket_id, result, created_at
- post_views: id, post_id, user_id, session_id, qualified
- post_clicks: id, post_id, user_id, target
- org_memberships: org_id, user_id, role

IMPORTANT: To filter by organization, use one of these patterns:
1. Filter by organization ownership: WHERE events.owner_context_id = 'org_id' AND events.owner_context_type = 'organization'
2. Filter by org members' events: WHERE events.created_by IN (SELECT user_id FROM org_memberships WHERE org_id = 'org_id')
`;

    const systemPrompt = `You are a SQL query assistant for YardPass analytics. 
    Convert natural language questions into SQL queries that analyze event data.
    
    ${schemaInfo}
    
    Rules:
    1. Only use SELECT statements - no modifications
    2. Focus on analytics and aggregations
    3. Include proper JOINs when needed
    4. Use safe filtering (no injection)
    5. Return practical, readable results
    6. Always filter by organization context when org_id is provided
    
    Return JSON with:
    {
      "sql": "SELECT statement",
      "explanation": "What this query does",
      "chart_type": "bar|line|pie|table",
      "x_axis": "field name for x-axis",
      "y_axis": "field name for y-axis"
    }`;

    const userPrompt = `Convert this question to SQL: "${query}"
    ${org_id ? `Filter for organization: ${org_id}` : ''}
    
    Focus on providing actionable analytics insights.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const queryPlan = JSON.parse(completion.choices[0].message.content || "{}");

    // Execute the generated SQL query
    try {
      console.log('Executing SQL:', queryPlan.sql);
      
      // Try to execute using RPC first
      const { data, error } = await supabaseClient.rpc('execute_sql', {
        sql_query: queryPlan.sql
      });

      if (error) {
        console.error('RPC execution failed:', error);
        
        // If RPC fails, try a direct query approach for simple SELECT statements
        if (queryPlan.sql.trim().toLowerCase().startsWith('select')) {
          console.log('Attempting direct query execution...');
          
          // For now, return with error info but keep the query plan
          return new Response(JSON.stringify({
            ...queryPlan,
            error: `Query execution failed: ${error.message}`,
            debug: {
              sql: queryPlan.sql,
              error_details: error
            },
            data: [],
            row_count: 0
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw error;
      }

      console.log('Query executed successfully, rows:', data?.length || 0);
      
      return new Response(JSON.stringify({
        ...queryPlan,
        data: data,
        row_count: data?.length || 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (queryError) {
      console.error('Query execution error:', queryError);
      // Return the query plan even if execution fails
      return new Response(JSON.stringify({
        ...queryPlan,
        error: `Query execution failed: ${queryError.message}`,
        debug: {
          sql: queryPlan.sql,
          error_details: queryError
        },
        data: [],
        row_count: 0
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Natural language query error:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to process query",
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});