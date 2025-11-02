// components/ui/Card.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "outlined";
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className, 
  variant = "default",
  ...props 
}) => {
  const variants = {
    default: "bg-card/95 border border-border/60 shadow-[var(--shadow-sm)]",
    elevated: "bg-card border border-border/45 shadow-[var(--shadow-md)]",
    outlined: "bg-card/75 border border-border/50 shadow-none",
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-5 transition-all duration-200",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<CardProps> = ({ children, className, ...props }) => (
  <h3 className={cn("text-lg font-semibold text-foreground tracking-tight", className)} {...props}>
    {children}
  </h3>
);

export const CardDescription: React.FC<CardProps> = ({ children, className, ...props }) => (
  <p className={cn("text-sm text-foreground/85", className)} {...props}>
    {children}
  </p>
);

export const CardContent: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("pt-0", className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<CardProps> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center pt-4", className)} {...props}>
    {children}
  </div>
);