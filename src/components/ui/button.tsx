import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Base: tap-friendly target, subtle transform, crisp focus
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold ring-offset-background " +
    "transition-all duration-300 ease-[var(--ease-out)] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "disabled:pointer-events-none disabled:opacity-50 " +
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 " +
    "active:scale-[0.97] will-change-transform select-none",
  {
    variants: {
      variant: {
        default:
          "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 " +
          "shadow-lg hover:shadow-xl border border-primary/20 " +
          "hover:-translate-y-0.5 hover:scale-[1.02]",
        premium:
          "rounded-full brand-gradient text-white shadow-lg hover:shadow-xl border border-primary/30 " +
          "golden-glow hover:-translate-y-0.5 hover:scale-[1.02]",
        destructive:
          "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 " +
          "shadow-lg hover:shadow-xl border border-destructive/20 hover:-translate-y-0.5",
        outline:
          "rounded-full border-2 border-accent bg-transparent text-accent hover:bg-accent/10 " +
          "backdrop-blur-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 hover:border-strong",
        secondary:
          "rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 " +
          "shadow-lg hover:shadow-xl border border-secondary/20 hover:-translate-y-0.5",
        ghost:
          "rounded-full hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm " +
          "border border-transparent hover:border-accent",
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
        glass:
          "rounded-full glass-effect text-white hover:bg-white/20 shadow-lg backdrop-blur-lg border border-white/20",
        pill: "pill-button hover:pill-button-active",
        tiktok:
          "rounded-full bg-gradient-to-r from-primary to-accent text-white font-bold shadow-xl " +
          "hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.03] border border-primary/30",
        tiktokSecondary:
          "rounded-full bg-white/15 text-white border border-white/30 backdrop-blur-md shadow-lg " +
          "hover:bg-white/25 hover:border-white/40 hover:-translate-y-0.5 hover:scale-[1.02]",
      },
      size: {
        default: "min-h-[44px] h-12 px-6 py-3 text-sm",
        sm: "min-h-[44px] h-10 px-4 py-2 text-sm",
        lg: "min-h-[48px] h-14 px-8 py-4 text-base",
        icon: "min-h-[44px] h-12 w-12",
        pill: "min-h-[40px] h-10 px-5 py-2 text-sm",
        tiktok: "min-h-[48px] h-14 px-8 py-4 text-base",
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
