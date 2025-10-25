// Edge Function: search-events
// Provides intelligent search with full-text search, ranking, and filtering

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface SearchFilters {
  categories?: string[];
  dateFilters?: string[];
  priceRange?: string;
  searchRadius?: number;
}

interface SearchRequest {
  searchText: string;
  filters?: SearchFilters;
  limit?: number;
  userLat?: number;
  userLng?: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    
    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      }
    );

    // Get user if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    // Parse request body
    const body: SearchRequest = await req.json();
    const {
      searchText = '',
      filters = {},
      limit = 50,
      userLat,
      userLng,
    } = body;

    console.log('🔍 Search request:', {
      searchText,
      filters,
      userId,
      hasLocation: !!(userLat && userLng),
    });

    // Build RPC parameters
    const rpcParams: Record<string, any> = {
      p_search_text: searchText || null,
      p_user_id: userId,
      p_limit: Math.min(limit, 100), // Cap at 100
    };

    // Add filter parameters
    if (filters.categories && filters.categories.length > 0) {
      rpcParams.p_categories = filters.categories;
    }

    if (filters.dateFilters && filters.dateFilters.length > 0) {
      rpcParams.p_date_filters = filters.dateFilters;
    }

    if (filters.priceRange && filters.priceRange !== 'all') {
      rpcParams.p_price_range = filters.priceRange;
    }

    // Add location parameters for "Near Me" filtering
    if (userLat && userLng && filters.searchRadius) {
      rpcParams.p_user_lat = userLat;
      rpcParams.p_user_lng = userLng;
      rpcParams.p_max_distance_miles = filters.searchRadius;
    }

    console.log('🔧 RPC params:', rpcParams);

    // Call the search function
    const { data: results, error: searchError } = await supabase
      .rpc('search_events_ranked', rpcParams);

    if (searchError) {
      console.error('❌ Search error:', searchError);
      throw searchError;
    }

    console.log('✅ Search results:', results?.length || 0, 'events found');

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        results: results || [],
        count: results?.length || 0,
        searchText,
        filters,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('💥 Search function error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Search failed',
        results: [],
        count: 0,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

