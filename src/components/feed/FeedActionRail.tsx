// components/feed/FeedActionRail.tsx
import { CSSProperties, ReactNode } from "react";

type RailButton = {
  icon: ReactNode;
  label?: ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
};

type RailProps = {
  items: RailButton[];
  className?: string;
};

/**
 * Safe-area aware, caption-aware action rail.
 * Positions itself above the bottom nav + caption using CSS vars:
 * --bottom-nav-safe and --caption-h (already in your codebase).
 */
export function FeedActionRail({ items, className = "" }: RailProps) {
  const railStyle: CSSProperties = {
    // Expose item count to CSS so the rail can adapt spacing responsively.
    "--rail-count": items.length
  } as CSSProperties;

  return (
    <div
      className={`feed-rail pointer-events-auto ${className}`}
      style={railStyle}
      data-rail-count={items.length}
      data-viewport-width={typeof window !== 'undefined' ? window.innerWidth : 0}
      data-viewport-height={typeof window !== 'undefined' ? window.innerHeight : 0}
      data-compact-mode={typeof window !== 'undefined' && window.innerWidth <= 375 && window.innerHeight <= 700 ? 'true' : 'false'}
    >
      {items.map((it, i) => {
        const labelVariant =
          typeof it.label === "number" ||
          (typeof it.label === "string" && /[\d\s.,]+/.test(it.label.trim()))
            ? "count"
            : it.label !== undefined
            ? "text"
            : undefined;

        const ariaLabel =
          typeof it.title === "string"
            ? it.title
            : typeof it.label === "string"
            ? it.label
            : undefined;

        return (
          <button
            key={i}
            type="button"
            title={typeof it.label === "string" ? it.label : it.title}
            onClick={it.onClick}
            className="feed-rail__btn"
            data-has-label={it.label !== undefined ? "true" : "false"}
            data-label-variant={labelVariant}
            aria-label={ariaLabel}
          >
            <div
              className={[
                "feed-rail__icon",
                it.active ? "feed-rail__icon--active" : "feed-rail__icon--idle"
              ].join(" ")}
            >
              {it.icon}
            </div>

            {/* Auto-hides on short screens via CSS, or when label === undefined */}
            {it.label !== undefined && (
              <span className="feed-rail__label">{it.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
