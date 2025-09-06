import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";

// Instagram Stories sharing for native apps
export async function shareStoryFromMux(playbackId: string, contentUrl: string) {
  if (Capacitor.getPlatform() === "web") {
    throw new Error("Instagram Stories sharing is only available in native apps");
  }

  try {
    // Get MP4 URL from Mux
    const mp4Url = `https://stream.mux.com/${playbackId}/medium.mp4`;

    // Download video to device
    const response = await fetch(mp4Url);
    const blob = await response.blob();
    
    // Convert to base64
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]!);
      };
      reader.readAsDataURL(blob);
    });

    // Write to device cache
    const { uri } = await Filesystem.writeFile({
      path: `story-${playbackId}.mp4`,
      data: base64,
      directory: Directory.Cache
    });

    // Share to Instagram Stories (requires capacitor-instagram-stories plugin)
    // For now, we'll use a generic share approach that should work on most devices
    if ((window as any).plugins?.socialsharing) {
      await (window as any).plugins.socialsharing.shareViaInstagram(
        "Check out this event!",
        uri,
        contentUrl
      );
    } else {
      // Fallback: open Instagram app with system share
      const shareData = {
        title: "Check out this event!",
        url: contentUrl
      };
      
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error("Instagram sharing not available on this device");
      }
    }

    console.log("Shared to Instagram Stories:", playbackId);

  } catch (error) {
    console.error("Instagram Stories share error:", error);
    throw error;
  }
}

// Web fallback - download video and show instructions
export async function downloadStoryVideo(playbackId: string) {
  const mp4Url = `https://stream.mux.com/${playbackId}/medium.mp4`;
  
  // Create download link
  const link = document.createElement('a');
  link.href = mp4Url;
  link.download = `story-video-${playbackId}.mp4`;
  link.target = '_blank';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  return mp4Url;
}