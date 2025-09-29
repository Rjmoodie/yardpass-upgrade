import { cn } from "@/lib/utils";

export function OverlayPanel({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      className={cn(
        // full-width but breathable; safe-areas respected; sits above media
        "mx-4 mb-4 mt-auto max-w-[min(720px,100%)] rounded-3xl border border-white/12 bg-black/55 backdrop-blur-xl text-white",
        "shadow-[0_6px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/5",
        "p-4 sm:p-5 md:p-6 safe-bottom",
        className
      )}
    >
      {children}
    </div>
  );
}