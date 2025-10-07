import { useEffect } from "react";
import { hlsUrl, posterUrl, extractMuxPlaybackId } from "@/lib/video/muxClient";

type Post = { media_urls?: string[] };

export function PreloadCriticalAssets({
  posts,
  posterLimit = 3,
}: {
  posts: Post[];
  posterLimit?: number;
}) {
  useEffect(() => {
    const head = document.head;
    const tags: HTMLLinkElement[] = [];

    const add = (init: Partial<HTMLLinkElement>) => {
      const link = document.createElement("link");
      Object.assign(link, init);
      head.appendChild(link);
      tags.push(link);
    };

    // Preconnect + DNS hints to Mux (both hosts: stream + image)
    add({ rel: "preconnect", href: "https://stream.mux.com", crossOrigin: "" as any });
    add({ rel: "dns-prefetch", href: "https://stream.mux.com" });
    add({ rel: "preconnect", href: "https://image.mux.com", crossOrigin: "" as any });
    add({ rel: "dns-prefetch", href: "https://image.mux.com" });

    // Preload first manifest (bigger win than just posters)
    const firstMux = extractMuxPlaybackId(posts?.[0]?.media_urls?.[0] ?? "");
    if (firstMux) {
      add({
        rel: "preload",
        as: "fetch",
        href: hlsUrl({ playbackId: firstMux }),
        crossOrigin: "anonymous" as any,
      });
    }

    // Preload first few posters
    let count = 0;
    for (const post of posts) {
      if (count >= posterLimit) break;
      for (const url of post.media_urls ?? []) {
        const id = extractMuxPlaybackId(url);
        if (!id) continue;
        add({
          rel: "preload",
          as: "image",
          href: posterUrl({ playbackId: id }, { time: 1, width: 800, fitMode: "smartcrop" }),
          fetchPriority: "high" as any,
        });
        count++;
        if (count >= posterLimit) break;
      }
    }

    return () => {
      for (const l of tags) {
        try { head.removeChild(l); } catch {}
      }
    };
  }, [posts, posterLimit]);

  return null;
}
