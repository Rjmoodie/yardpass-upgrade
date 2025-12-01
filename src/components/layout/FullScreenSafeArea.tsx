import { ReactNode, ElementType } from "react";
import { cn } from "@/lib/utils";

type FullScreenSafeAreaProps = {
  children: ReactNode;
  className?: string;
  /**
   * If true, this container will handle vertical scrolling.
   * If false, it just sets up the safe-area padded viewport and
   * lets children manage their own scrolling.
   *
   * Default: true
   */
  scroll?: boolean;
  /**
   * If true, bottom padding will also include the bottom nav height
   * using CSS var `--bottom-nav-safe` (fallback ~4.5rem).
   *
   * Default: true
   */
  includeBottomNav?: boolean;
  /**
   * Optional element type to render (div, main, etc).
   * Default: 'div'
   */
  as?: ElementType;
};

/**
 * Full-screen container that respects iOS safe areas (notch, Dynamic Island, home indicator)
 *
 * Design goals:
 * - No fixed safe-area "spacers" that can clip content
 * - No overflow: hidden on the root
 * - No resize hacks; relies on env(safe-area-*) which update automatically
 * - Works on web, iOS (Capacitor), Android without special cases
 *
 * Usage:
 *   <FullScreenSafeArea className="bg-background">
 *     ...page content...
 *   </FullScreenSafeArea>
 *
 *   <FullScreenSafeArea scroll={false}>
 *     ...child component with its own scroll container...
 *   </FullScreenSafeArea>
 */
export function FullScreenSafeArea({
  children,
  className,
  scroll = true,
  includeBottomNav = true,
  as: Component = "div",
}: FullScreenSafeAreaProps) {
  const safeAreaTop = "env(safe-area-inset-top, 0px)";
  const safeAreaBottom = "env(safe-area-inset-bottom, 0px)";
  
  // Base top padding for consistent spacing even when safe area is 0 (e.g., desktop browsers)
  // This ensures content doesn't get cut off when using negative margins (like avatar overlap)
  const baseTopPadding = "16px";
  
  // Combine safe area with base padding
  const topPadding = `calc(${safeAreaTop} + ${baseTopPadding})`;

  // If we have a bottom nav, add its height on top of the safe area
  const bottomPadding = includeBottomNav
    ? `calc(${safeAreaBottom} + var(--bottom-nav-safe, 4.5rem))`
    : safeAreaBottom;

  return (
    <Component
      className={cn(
        "flex flex-col min-h-[100dvh]",
        scroll && "overflow-y-auto",
        className
      )}
      style={{
        // Fill the dynamic viewport; -webkit-fill-available helps older iOS Safari
        height: "100dvh",
        minHeight: "-webkit-fill-available",
        paddingTop: topPadding,
        paddingBottom: bottomPadding,
        // Let the page background bleed into safe areas
        background: "hsl(var(--background))",
      }}
    >
      {children}
    </Component>
  );
}
