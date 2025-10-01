import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📊 Mux analytics request received');
    
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxTokenSecret = Deno.env.get('MUX_TOKEN_SECRET');

    console.log('🔑 Mux credentials check:', {
      hasTokenId: !!muxTokenId,
      hasTokenSecret: !!muxTokenSecret
    });

    if (!muxTokenId || !muxTokenSecret) {
      console.error('❌ Mux credentials not configured');
      return new Response(JSON.stringify({ error: 'Mux credentials not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const { asset_ids, from_date, to_date } = await req.json();
    console.log('📹 Request params:', { 
      assetCount: asset_ids?.length || 0, 
      from_date, 
      to_date 
    });

    if (!asset_ids || asset_ids.length === 0) {
      console.log('⚠️ No asset IDs provided, returning empty metrics');
      return new Response(JSON.stringify({
        total_plays: 0,
        unique_viewers: 0,
        avg_watch_time: 0,
        completion_rate: 0,
        videos: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Basic Auth header for Mux API
    const auth = btoa(`${muxTokenId}:${muxTokenSecret}`);
    console.log('🔐 Auth header created, fetching from Mux API...');

    // Get video metrics from Mux Data API
    const metricsPromises = asset_ids.map(async (assetId: string) => {
      try {
        console.log(`📊 Fetching metrics for asset: ${assetId}`);
        const response = await fetch(`https://api.mux.com/data/v1/metrics/overall`, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Mux API error for asset ${assetId}:`, {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          return {
            asset_id: assetId,
            plays: 0,
            unique_viewers: 0,
            avg_watch_time: 0,
            completion_rate: 0
          };
        }

        const data = await response.json();
        console.log(`✅ Got metrics for ${assetId}:`, data);
        
        return {
          asset_id: assetId,
          plays: data.data?.[0]?.total_playing_time || 0,
          unique_viewers: data.data?.[0]?.unique_viewers || 0,
          avg_watch_time: data.data?.[0]?.average_viewing_session_duration || 0,
          completion_rate: data.data?.[0]?.video_completion_rate || 0
        };
      } catch (error) {
        console.error(`Error fetching Mux data for asset ${assetId}:`, error);
        return {
          asset_id: assetId,
          plays: 0,
          unique_viewers: 0,
          avg_watch_time: 0,
          completion_rate: 0
        };
      }
    });

    const videoMetrics = await Promise.all(metricsPromises);

    // Aggregate totals
    const totals = videoMetrics.reduce((acc, video) => ({
      total_plays: acc.total_plays + video.plays,
      unique_viewers: acc.unique_viewers + video.unique_viewers,
      total_watch_time: acc.total_watch_time + video.avg_watch_time,
      total_completion: acc.total_completion + video.completion_rate
    }), { total_plays: 0, unique_viewers: 0, total_watch_time: 0, total_completion: 0 });

    const avgWatchTime = videoMetrics.length > 0 ? totals.total_watch_time / videoMetrics.length : 0;
    const avgCompletionRate = videoMetrics.length > 0 ? totals.total_completion / videoMetrics.length : 0;

    console.log('📈 Aggregated metrics:', {
      total_plays: totals.total_plays,
      unique_viewers: totals.unique_viewers,
      avg_watch_time: Math.round(avgWatchTime),
      completion_rate: Math.round(avgCompletionRate * 100) / 100
    });

    return new Response(JSON.stringify({
      total_plays: totals.total_plays,
      unique_viewers: totals.unique_viewers,
      avg_watch_time: Math.round(avgWatchTime),
      completion_rate: Math.round(avgCompletionRate * 100) / 100,
      videos: videoMetrics
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Mux analytics error:', error);
    return new Response(JSON.stringify({ error: (error as any)?.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});