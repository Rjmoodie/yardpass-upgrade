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
    // SSR guard
    if (typeof document === "undefined") return;

    const head = document.head;
    const created: HTMLLinkElement[] = [];
    const existingKey = new Set<string>(); // rel|href dedupe

    // Prime dedupe set with any existing <link> tags in <head>
    head.querySelectorAll<HTMLLinkElement>("link[rel][href]").forEach((l) => {
      existingKey.add(`${l.rel}|${l.href}`);
    });

    const add = (init: Partial<HTMLLinkElement>) => {
      // minimal dedupe to avoid duplicate preconnects/preloads
      const rel = (init.rel ?? "") as string;
      const href = (init.href ?? "") as string;
      if (!rel || !href) return;

      const key = `${rel}|${href}`;
      if (existingKey.has(key)) return;

      const link = document.createElement("link");
      Object.assign(link, init);
      head.appendChild(link);
      created.push(link);
      existingKey.add(key);
    };

    // Network-awareness (be polite on constrained connections)
    const saveData = (navigator as any)?.connection?.saveData === true;
    const effectivePosterLimit =
      saveData ? Math.min(1, posterLimit) : posterLimit;

    // ---- 1) Preconnect / DNS (lightweight, do right away) ----
    add({ rel: "preconnect", href: "https://stream.mux.com", crossOrigin: "" as any });
    add({ rel: "dns-prefetch", href: "https://stream.mux.com" });
    add({ rel: "preconnect", href: "https://image.mux.com", crossOrigin: "" as any });
    add({ rel: "dns-prefetch", href: "https://image.mux.com" });

    // Helper to schedule non-critical work without blocking first paint
    const runIdle = (fn: () => void) => {
      // @ts-ignore
      if (typeof window.requestIdleCallback === "function") {
        // @ts-ignore
        const id = window.requestIdleCallback(fn, { timeout: 1500 });
        return () => window.cancelIdleCallback?.(id);
      } else {
        const t = window.setTimeout(fn, 300);
        return () => window.clearTimeout(t);
      }
    };

    // ---- 2) Preload the FIRST manifest (biggest "instant play" win) ----
    const cancelIdleManifest = runIdle(() => {
      const firstMux = extractMuxPlaybackId(posts?.[0]?.media_urls?.[0] ?? "");
      if (firstMux) {
        add({
          rel: "preload",
          as: "fetch",
          href: hlsUrl({ playbackId: firstMux }),
          crossOrigin: "anonymous" as any,
          // Some browsers consider type for prioritization; harmless elsewhere
          // @ts-ignore
          type: "application/vnd.apple.mpegurl",
        });
      }
    });

    // ---- 3) Preload a few posters (cheap visuals; keep count tight) ----
    const cancelIdlePosters = runIdle(() => {
      if (!Array.isArray(posts) || effectivePosterLimit <= 0) return;

      let count = 0;
      outer: for (const post of posts) {
        if (count >= effectivePosterLimit) break;
        for (const url of post.media_urls ?? []) {
          const id = extractMuxPlaybackId(url);
          if (!id) continue;

          add({
            rel: "preload",
            as: "image",
            href: posterUrl(
              { playbackId: id },
              { time: 1, width: 800, fitMode: "smartcrop" }
            ),
            // Priority hint (ignored by some browsers; safe to include)
            fetchPriority: "high" as any,
          });

          count++;
          if (count >= effectivePosterLimit) break outer;
        }
      }
    });

    // Cleanup: remove only what we added + cancel idle tasks
    return () => {
      cancelIdleManifest?.();
      cancelIdlePosters?.();
      for (const l of created) {
        try {
          head.removeChild(l);
        } catch {}
      }
    };
  }, [posts, posterLimit]);

  return null;
}