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
    const muxTokenId = Deno.env.get('MUX_TOKEN_ID');
    const muxTokenSecret = Deno.env.get('MUX_TOKEN_SECRET');

    if (!muxTokenId || !muxTokenSecret) {
      return new Response(JSON.stringify({ error: 'Mux credentials not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const formData = await req.formData();
    const videoFile = formData.get('video') as File;

    if (!videoFile) {
      return new Response(JSON.stringify({ error: 'No video file provided' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log('Uploading video to Mux:', videoFile.name, 'Size:', videoFile.size);

    // Create Basic Auth header for Mux API
    const auth = btoa(`${muxTokenId}:${muxTokenSecret}`);

    // Step 1: Create an upload URL from Mux
    const uploadResponse = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        new_asset_settings: {
          playback_policy: ['public'],
          mp4_support: 'standard'
        },
        cors_origin: '*'
      })
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Mux upload URL creation failed:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to create upload URL',
        details: errorText 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const uploadData = await uploadResponse.json();
    console.log('Mux upload URL created:', uploadData.data.url);

    // Step 2: Upload the video file to Mux's upload URL
    const videoUploadFormData = new FormData();
    videoUploadFormData.append('file', videoFile);

    const videoUploadResponse = await fetch(uploadData.data.url, {
      method: 'PUT',
      body: videoFile,
      headers: {
        'Content-Type': videoFile.type,
      }
    });

    if (!videoUploadResponse.ok) {
      const errorText = await videoUploadResponse.text();
      console.error('Mux video upload failed:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to upload video to Mux',
        details: errorText 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Video successfully uploaded to Mux');

    // Return the upload ID and asset info
    return new Response(JSON.stringify({
      upload_id: uploadData.data.id,
      asset_id: uploadData.data.asset_id,
      status: 'uploading',
      playback_url: uploadData.data.asset_id ? `https://stream.mux.com/${uploadData.data.asset_id}.m3u8` : null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Mux upload error:', error);
    return new Response(JSON.stringify({ error: (error as any).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});