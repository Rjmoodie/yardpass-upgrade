import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

// Proxy for Mapbox token to avoid exposing it on client-side
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // This would typically get the token from environment variables
    // For now, we'll return the token that's already in the client code
    // In production, you'd store this as a Supabase secret
    const mapboxToken = Deno.env.get('MAPBOX_PUBLIC_TOKEN') || 
      'pk.eyJ1IjoiaG90cm9kMjUiLCJhIjoiY21lZm9sODBoMHdnaDJycHg5dmQyaGV3YSJ9.RoCyY_SXikylZK2sD35oMQ';

    if (!mapboxToken) {
      return createErrorResponse('Mapbox token not configured', 500);
    }

    return createResponse({
      token: mapboxToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
    });

  } catch (error) {
    console.error('Mapbox token error:', error);
    return createErrorResponse(error.message);
  }
});