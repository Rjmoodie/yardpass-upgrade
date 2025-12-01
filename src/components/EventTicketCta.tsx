import { Button } from "@/components/ui/button";
import { Ticket } from "lucide-react";

interface EventTicketCtaProps {
  lowestPriceCents: number;
  onClick: () => void;
}

export function EventTicketCta({ lowestPriceCents, onClick }: EventTicketCtaProps) {
  const price = (lowestPriceCents / 100).toFixed(2);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div
        className="
          mx-auto max-w-xl px-4
          mb-[calc(var(--bottom-nav-safe,4.5rem)+0.75rem)]
          md:mb-6
          pointer-events-auto
        "
      >
        <div
          className="
            flex items-center justify-between gap-3
            rounded-full
            bg-card/95 dark:bg-card/90
            border border-border/70 dark:border-white/15
            shadow-[0_18px_45px_rgba(15,23,42,0.35)]
            px-4 py-2.5
            backdrop-blur-xl
          "
        >
          {/* Left: label + price */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden xs:flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-[11px] text-muted-foreground/80">
                  Tickets from
                </span>
                <span className="text-base font-semibold tabular-nums">
                  ${price}
                </span>
              </div>
            </div>
          </div>

          {/* Right: CTA button */}
          <Button
            size="sm"
            className="
              rounded-full px-4 sm:px-5 py-2
              text-sm font-semibold
              shadow-sm
            "
            onClick={onClick}
          >
            Get Tickets
          </Button>
        </div>
      </div>
    </div>
  );
}

