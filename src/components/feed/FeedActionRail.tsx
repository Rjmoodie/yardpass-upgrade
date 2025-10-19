// components/feed/FeedActionRail.tsx
import { ReactNode } from "react";

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
  return (
    <div className={`feed-rail pointer-events-auto ${className}`}>
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
