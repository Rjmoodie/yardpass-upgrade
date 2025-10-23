import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    
    const { data: { user } } = await supabase.auth.getUser();
    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (action === 'preload-hints') {
      return await handlePreloadHints(req, supabase, user?.id);
    } else if (action === 'quality-recommendation') {
      return await handleQualityRecommendation(req, supabase, user?.id);
    } else if (action === 'connection-test') {
      return await handleConnectionTest(req, supabase, user?.id);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Video optimization error:', error);
    return new Response(
      JSON.stringify({ error: (error as any).message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handlePreloadHints(req: Request, supabase: any, userId: string | null) {
  const { postIds, connectionSpeed, deviceType } = await req.json();

  if (!postIds || !Array.isArray(postIds)) {
    return new Response(
      JSON.stringify({ error: 'postIds array required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get video metadata for the posts
  const { data: posts, error } = await supabase
    .from('events.event_posts_with_meta')
    .select('id, media_urls, created_at')
    .in('id', postIds)
    .limit(20); // Limit to prevent large responses

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch posts' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Generate preload hints based on connection speed and device
  const preloadHints = posts?.map(post => {
    const mediaUrls = post.media_urls || [];
    const videoUrls = mediaUrls.filter(url => 
      typeof url === 'string' && (url.includes('.m3u8') || url.includes('mux.com'))
    );

    if (videoUrls.length === 0) return null;

    return {
      post_id: post.id,
      preload_strategy: getPreloadStrategy(connectionSpeed, deviceType),
      quality_hints: getQualityHints(connectionSpeed, videoUrls),
      preload_priority: getPreloadPriority(post.created_at, connectionSpeed)
    };
  }).filter(Boolean) || [];

  return new Response(
    JSON.stringify({ preload_hints: preloadHints }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleQualityRecommendation(req: Request, supabase: any, userId: string | null) {
  const { connectionSpeed, deviceType, userAgent } = await req.json();

  // Analyze user's connection and device capabilities
  const recommendation = {
    recommended_quality: getRecommendedQuality(connectionSpeed, deviceType),
    adaptive_streaming: shouldUseAdaptiveStreaming(connectionSpeed, deviceType),
    preload_strategy: getPreloadStrategy(connectionSpeed, deviceType),
    buffer_size: getRecommendedBufferSize(connectionSpeed, deviceType),
    max_bitrate: getMaxBitrate(connectionSpeed, deviceType)
  };

  return new Response(
    JSON.stringify(recommendation),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleConnectionTest(req: Request, supabase: any, userId: string | null) {
  const { testUrl } = await req.json();

  if (!testUrl) {
    return new Response(
      JSON.stringify({ error: 'testUrl required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Perform connection speed test
  const startTime = performance.now();
  
  try {
    const response = await fetch(testUrl, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    // Calculate connection speed based on response time
    const connectionSpeed = responseTime < 1000 ? 'fast' : 
                           responseTime < 3000 ? 'medium' : 'slow';

    return new Response(
      JSON.stringify({
        connection_speed: connectionSpeed,
        response_time_ms: Math.round(responseTime),
        status: response.status,
        recommended_quality: getRecommendedQuality(connectionSpeed, 'unknown')
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        connection_speed: 'slow',
        error: 'Connection test failed',
        recommended_quality: 'low'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Helper functions for video optimization
function getPreloadStrategy(connectionSpeed: string, deviceType: string): string {
  if (connectionSpeed === 'slow' || deviceType === 'mobile') {
    return 'none';
  }
  if (connectionSpeed === 'fast' && deviceType === 'desktop') {
    return 'metadata';
  }
  return 'metadata';
}

function getQualityHints(connectionSpeed: string, videoUrls: string[]): any {
  const baseUrl = videoUrls[0] || '';
  
  if (connectionSpeed === 'slow') {
    return {
      low: baseUrl.replace('.m3u8', '_360p.m3u8'),
      medium: baseUrl.replace('.m3u8', '_480p.m3u8'),
      high: baseUrl
    };
  }
  
  if (connectionSpeed === 'fast') {
    return {
      low: baseUrl.replace('.m3u8', '_720p.m3u8'),
      medium: baseUrl.replace('.m3u8', '_1080p.m3u8'),
      high: baseUrl.replace('.m3u8', '_4k.m3u8')
    };
  }
  
  return {
    low: baseUrl.replace('.m3u8', '_480p.m3u8'),
    medium: baseUrl.replace('.m3u8', '_720p.m3u8'),
    high: baseUrl
  };
}

function getPreloadPriority(createdAt: string, connectionSpeed: string): number {
  const age = Date.now() - new Date(createdAt).getTime();
  const ageHours = age / (1000 * 60 * 60);
  
  // Recent posts get higher priority
  let priority = Math.max(0, 10 - ageHours);
  
  // Adjust for connection speed
  if (connectionSpeed === 'slow') {
    priority *= 0.5;
  } else if (connectionSpeed === 'fast') {
    priority *= 1.5;
  }
  
  return Math.min(10, Math.max(0, priority));
}

function getRecommendedQuality(connectionSpeed: string, deviceType: string): string {
  if (connectionSpeed === 'slow' || deviceType === 'mobile') {
    return 'low';
  }
  if (connectionSpeed === 'fast' && deviceType === 'desktop') {
    return 'high';
  }
  return 'medium';
}

function shouldUseAdaptiveStreaming(connectionSpeed: string, deviceType: string): boolean {
  return connectionSpeed !== 'slow' && deviceType !== 'mobile';
}

function getRecommendedBufferSize(connectionSpeed: string, deviceType: string): number {
  if (connectionSpeed === 'slow') return 5; // 5 seconds
  if (connectionSpeed === 'fast') return 15; // 15 seconds
  return 10; // 10 seconds
}

function getMaxBitrate(connectionSpeed: string, deviceType: string): number {
  if (connectionSpeed === 'slow') return 1000000; // 1 Mbps
  if (connectionSpeed === 'fast') return 8000000; // 8 Mbps
  return 3000000; // 3 Mbps
}
