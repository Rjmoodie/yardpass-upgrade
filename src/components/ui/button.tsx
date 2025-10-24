import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: generous hit target, smooth transitions, refined focus ring
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-lg ring-offset-background " +
    "transition-colors duration-200 ease-[var(--ease-out)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-subtle border border-transparent hover:bg-primary/90 hover:shadow-md",
        premium:
          "brand-gradient text-white shadow-lg hover:shadow-xl border border-transparent focus-visible:ring-primary/40",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-subtle border border-transparent",
        outline:
          "border border-border bg-background text-foreground shadow-none hover:bg-muted/60",
        secondary:
          "bg-secondary text-secondary-foreground shadow-subtle border border-transparent hover:bg-secondary/80",
        ghost:
          "text-foreground hover:text-foreground hover:bg-muted/60 border border-transparent shadow-none",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
        glass:
          "bg-white/10 text-white border border-white/25 backdrop-blur-xl shadow-subtle hover:bg-white/15",
        pill: "rounded-full bg-primary/10 text-primary hover:bg-primary/15 border border-transparent",
        tiktok:
          "rounded-full bg-gradient-to-r from-brand-600 to-brand-400 text-white font-semibold shadow-lg hover:shadow-xl border border-transparent",
        tiktokSecondary:
          "rounded-full bg-white/12 text-white border border-white/25 backdrop-blur-md shadow-subtle hover:bg-white/18",
      },
      size: {
        default: "min-h-[44px] h-11 px-5 text-sm",
        sm: "min-h-[40px] h-10 px-4 text-sm",
        lg: "min-h-[48px] h-12 px-6 text-base",
        icon: "min-h-[44px] h-11 w-11",
        pill: "min-h-[40px] h-10 px-5 text-sm",
        tiktok: "min-h-[48px] h-12 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onFocus, onBlur, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onFocus={(event) => {
          event.currentTarget.classList.add('focus-visible')
          onFocus?.(event)
        }}
        onBlur={(event) => {
          event.currentTarget.classList.remove('focus-visible')
          onBlur?.(event)
        }}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
