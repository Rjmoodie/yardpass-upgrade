import { ReactNode } from "react";

type RailButton = {
  icon: ReactNode;
  label?: ReactNode;
  active?: boolean;
  onClick?: () => void;
};

type RailProps = {
  items: RailButton[];
  className?: string;
};

/**
 * Sits ABOVE the caption & bottom nav using CSS vars:
 * bottom = calc(var(--bottom-nav-safe) + var(--caption-h) + var(--rail-gap))
 */
export function FeedActionRail({ items, className = "" }: RailProps) {
  return (
    <div className={`action-rail-safe flex flex-col items-center ${className}`}>
      {items.map((it, i) => (
        <button
          key={i}
          onClick={it.onClick}
          className="flex flex-col items-center gap-0 transition-transform active:scale-95 touch-manipulation"
        >
          <div
            className={`rounded-full transition-all ${
              it.active
                ? "bg-red-500 shadow-lg shadow-red-500/30 scale-110"
                : "bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20"
            }`}
          >
            {it.icon}
          </div>
          {it.label !== undefined && (
            <span className="text-[9px] font-medium text-white drop-shadow-lg leading-none">{it.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}
