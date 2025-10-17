import { useEffect, useRef } from "react";

type Opts = {
  /** % of a card that must be visible to play */
  threshold?: number;
  /** How far outside the viewport to start lazy-loading (CSS length) */
  rootMargin?: string;
  /** Selector for each full-screen card */
  selector?: string;
  /** Selector for the media inside a card (default: video) */
  mediaSelector?: string;
};

export function useAutoPlayOnScroll({
  threshold = 0.6,
  rootMargin = "200% 0px",         // load 2 screen-heights above/below
  selector = ".feed-card",
  mediaSelector = "video",
}: Opts = {}) {
  const playObserverRef = useRef<IntersectionObserver | null>(null);
  const loadObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(selector));

    // Helper: swap data-* to real src/poster once near viewport
    const hydrateMedia = (el: HTMLElement) => {
      const media = el.querySelector(mediaSelector) as HTMLVideoElement | HTMLImageElement | null;
      if (!media) return;

      // @ts-ignore data- attrs
      const dataSrc: string | undefined = media.dataset.src;
      // @ts-ignore
      const dataPoster: string | undefined = (media as HTMLVideoElement).dataset?.poster;

      // Only hydrate once
      const hasSrc = (media as HTMLVideoElement).src || (media as HTMLImageElement).src;
      if (!hasSrc && dataSrc) {
        (media as any).src = dataSrc;
      }
      if ("poster" in (media as HTMLVideoElement) && dataPoster && !(media as HTMLVideoElement).poster) {
        (media as HTMLVideoElement).poster = dataPoster;
      }

      // For videos, nudge the browser to fetch metadata but not full file
      if (media instanceof HTMLVideoElement) {
        // prefer metadata to get duration/first frame, but keep bandwidth low
        media.preload = "metadata";
      }
    };

    // 1) LOAD observer: near-viewport -> hydrate src/poster
    const loadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          hydrateMedia(entry.target as HTMLElement);
        });
      },
      { rootMargin, threshold: 0.01 }
    );
    cards.forEach((c) => loadObserver.observe(c));
    loadObserverRef.current = loadObserver;

    // 2) PLAY observer: visible -> play; not visible -> pause
    const playObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const card = entry.target as HTMLElement;
          const media = card.querySelector(mediaSelector) as HTMLVideoElement | null;
          if (!media) return;

          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            // Ensure hydrated before play (in case load observer hasn't fired yet)
            hydrateMedia(card);
            media
              .play()
              .catch(() => { /* ignore autoplay blocks; user gesture will resolve */});
          } else {
            media.pause();
          }
        });
      },
      { threshold }
    );
    cards.forEach((c) => playObserver.observe(c));
    playObserverRef.current = playObserver;

    // 3) Global pause on tab blur; resume the most visible on focus
    const handleVisibility = () => {
      const videos = Array.from(document.querySelectorAll<HTMLVideoElement>(`${selector} ${mediaSelector}`));
      if (document.hidden) {
        videos.forEach((v) => v.pause());
        return;
      }
      // Find the most visible card and resume it
      const mostVisible = cards
        .map((card) => {
          const r = card.getBoundingClientRect();
          const visibleH = Math.min(window.innerHeight, r.bottom) - Math.max(0, r.top);
          const ratio = Math.max(0, visibleH) / Math.max(1, r.height);
          return { card, ratio };
        })
        .sort((a, b) => b.ratio - a.ratio)[0];

      const media = mostVisible?.card.querySelector(mediaSelector) as HTMLVideoElement | null;
      if (media && mostVisible!.ratio >= threshold) {
        media.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      playObserver.disconnect();
      loadObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [threshold, rootMargin, selector, mediaSelector]);
}

