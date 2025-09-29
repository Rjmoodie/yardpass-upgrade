import { useState, useId } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  maxHeight?: string;   // e.g. "80vh"
  minHeight?: string;   // e.g. "140px"
};

export default function PeekSheet({
  children,
  className,
  defaultOpen = false,
  maxHeight = "80vh",
  minHeight = "148px",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div
      className={cn(
        "pointer-events-auto mx-4 mb-4 mt-auto max-w-[min(760px,100%)]",
        "rounded-3xl border border-white/12 bg-black/60 backdrop-blur-xl text-white",
        "shadow-[0_6px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/5",
        "transition-[height,transform,box-shadow] duration-300 ease-[cubic-bezier(.2,.7,.2,1)]",
        className
      )}
      style={{
        height: open ? maxHeight : minHeight,
        overflow: "hidden",
      }}
      aria-expanded={open}
      aria-controls={id}
    >
      {/* Grabber */}
      <button
        type="button"
        className="mx-auto mt-2 mb-1 block h-1.5 w-10 rounded-full bg-white/25 hover:bg-white/35 transition"
        aria-label={open ? "Collapse" : "Expand"}
        onClick={() => setOpen((v) => !v)}
      />

      <div
        id={id}
        className={cn(
          "px-4 pb-4 sm:px-5 md:px-6",
          // When open: allow internal scroll; when closed we fade tail
          open ? "h-[calc(100%-22px)] overflow-y-auto" : "relative"
        )}
      >
        {!open && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/75 to-transparent rounded-b-3xl"
          />
        )}
        {children}
      </div>
    </div>
  );
}