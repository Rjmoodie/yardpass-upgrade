import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as tus from "tus-js-client";

type Kind = "story_video" | "link_video";

interface UploadProgress {
  progress: number;
  status: "idle" | "creating" | "uploading" | "processing" | "done" | "error";
  playbackId: string | null;
  error: string | null;
}

export function useMuxStoryUpload() {
  const [state, setState] = useState<UploadProgress>({
    progress: 0,
    status: "idle",
    playbackId: null,
    error: null
  });

  const upload = useCallback(async (file: File, eventId: string, kind: Kind = "story_video") => {
    try {
      setState(prev => ({ ...prev, status: "creating", error: null, progress: 0 }));
      
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      // Create Mux direct upload
      const res = await supabase.functions.invoke("mux-create-direct-upload", {
        body: { event_id: eventId, kind }
      });

      if (res.error) {
        throw new Error(res.error.message || "Failed to create upload");
      }

      const { upload_url, asset_row_id } = res.data;

      // Upload file to Mux with tus
      setState(prev => ({ ...prev, status: "uploading" }));
      
      await new Promise<void>((resolve, reject) => {
        const uploader = new tus.Upload(file, {
          endpoint: upload_url,
          chunkSize: 5 * 1024 * 1024, // 5MB chunks
          metadata: { 
            filename: file.name, 
            filetype: file.type 
          },
          onError: (error) => {
            console.error("Upload error:", error);
            reject(error);
          },
          onProgress: (sent, total) => {
            const progress = Math.round((sent / total) * 100);
            setState(prev => ({ ...prev, progress }));
          },
          onSuccess: () => {
            console.log("Upload completed");
            resolve();
          },
        });
        uploader.start();
      });

      // Wait for webhook to process and get playback ID
      setState(prev => ({ ...prev, status: "processing", progress: 100 }));
      
      let attempts = 0;
      while (attempts++ < 20) {
        const { data, error } = await supabase
          .from("event_share_assets")
          .select("mux_playback_id, poster_url")
          .eq("id", asset_row_id)
          .maybeSingle();
        
        if (!error && data?.mux_playback_id) {
          setState(prev => ({ 
            ...prev, 
            status: "done", 
            playbackId: data.mux_playback_id 
          }));
          return data.mux_playback_id;
        }
        
        // Wait before retrying
        await new Promise(r => setTimeout(r, 1500));
      }
      
      throw new Error("Timeout waiting for video processing");

    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Unknown error";
      console.error("Mux upload error:", errorMessage);
      setState(prev => ({ 
        ...prev, 
        status: "error", 
        error: errorMessage 
      }));
      throw e;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      progress: 0,
      status: "idle",
      playbackId: null,
      error: null
    });
  }, []);

  return { 
    upload, 
    reset,
    ...state
  };
}