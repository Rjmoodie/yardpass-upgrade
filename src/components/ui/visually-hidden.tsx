import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Visually hides content while keeping it accessible to screen readers.
 * This component follows the CSS technique for screen-reader-only content.
 */
export const VisuallyHidden = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => {
  return (
    <span
      ref={ref}
      className={cn(
        "absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0",
        className
      )}
      style={{
        clip: "rect(0, 0, 0, 0)",
        clipPath: "inset(50%)",
      }}
      {...props}
    />
  )
})

VisuallyHidden.displayName = "VisuallyHidden"

