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
    <div className={`action-rail-safe flex flex-col items-center gap-3 sm:gap-4 ${className}`}>
      {items.map((it, i) => (
        <button
          key={i}
          onClick={it.onClick}
          className="flex flex-col items-center gap-1 transition-transform active:scale-95 min-h-[48px] min-w-[48px] p-2 touch-manipulation"
        >
          <div
            className={`p-3 rounded-full transition-all ${
              it.active
                ? "bg-red-500 shadow-lg shadow-red-500/30 scale-110"
                : "bg-black/40 backdrop-blur-sm border border-white/20 hover:bg-white/20"
            }`}
          >
            {it.icon}
          </div>
          {it.label !== undefined && (
            <span className="text-xs font-medium text-white drop-shadow-lg">{it.label}</span>
          )}
        </button>
      ))}
    </div>
  );
}
