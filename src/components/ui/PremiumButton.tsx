// components/ui/PremiumButton.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface PremiumButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const PremiumButton: React.FC<PremiumButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}) => {
  const variants = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 shadow-subtle",
    secondary: "bg-white text-neutral-700 border border-neutral-200 hover:bg-neutral-50 hover:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 shadow-subtle",
    ghost: "bg-transparent text-neutral-700 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2",
    outline: "bg-transparent border border-neutral-200 text-neutral-700 hover:bg-neutral-50 hover:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2 shadow-subtle",
  };

  const sizes = {
    sm: "h-10 px-3 text-sm",
    md: "h-11 px-4 text-base",
    lg: "h-12 px-6 text-lg",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all duration-200",
        "disabled:opacity-50 disabled:pointer-events-none",
        "active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

// Icon button variant
export const PremiumIconButton: React.FC<PremiumButtonProps & { icon: React.ReactNode }> = ({
  icon,
  children,
  className,
  ...props
}) => (
  <PremiumButton
    className={cn("p-2", className)}
    {...props}
  >
    {icon}
    {children}
  </PremiumButton>
);
