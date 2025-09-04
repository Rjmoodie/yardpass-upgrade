import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-95",
  {
    variants: {
      variant: {
        default: "rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105",
        premium: "rounded-full brand-gradient text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 hover:scale-105 golden-glow",
        destructive:
          "rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg hover:shadow-xl transform hover:-translate-y-1",
        outline:
          "rounded-full border-2 border-primary/20 bg-transparent text-primary hover:bg-primary/10 backdrop-blur-sm shadow-lg hover:shadow-xl transform hover:-translate-y-1",
        secondary:
          "rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-lg hover:shadow-xl transform hover:-translate-y-1",
        ghost: "rounded-full hover:bg-accent/50 hover:text-accent-foreground backdrop-blur-sm",
        link: "text-primary underline-offset-4 hover:underline",
        glass: "rounded-full glass-effect text-white hover:bg-white/20 shadow-lg backdrop-blur-lg border border-white/20",
        pill: "pill-button hover:pill-button-active",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 px-4 py-2",
        lg: "h-14 px-8 py-4",
        icon: "h-12 w-12",
        pill: "h-10 px-5 py-2",
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
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
