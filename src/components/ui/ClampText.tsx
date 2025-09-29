import { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

type Props = {
  children: React.ReactNode;
  lines?: number;
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
  gradient?: boolean;
};

export default function ClampText({
  children,
  lines = 3,
  className,
  moreLabel = "More",
  lessLabel = "Less",
  gradient = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={cn("relative", className)} aria-expanded={open} aria-controls={id}>
      <div id={id} className={cn(open ? "" : `line-clamp-${lines}`, "text-white/95")}>
        {children}
      </div>

      {!open && gradient && (
        <div
          className="pointer-events-none absolute inset-x-0 -bottom-1 h-8 bg-gradient-to-t from-black/70 to-transparent rounded-b-xl"
          aria-hidden
        />
      )}

      <button
        type="button"
        className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold bg-white/10 text-white/95 border border-white/15 hover:bg-white/15 focus:ring-2 focus:ring-white/25"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {open ? lessLabel : moreLabel}
      </button>
    </div>
  );
}