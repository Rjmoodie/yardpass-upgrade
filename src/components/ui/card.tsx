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
    default: "bg-card/50 backdrop-blur-sm border border-border/20 shadow-sm",
    elevated: "bg-card/70 backdrop-blur-md border border-border/30 shadow-md",
    outlined: "bg-card/30 backdrop-blur-sm border border-border/20",
  };

  return (
    <div
      className={cn(
        "rounded-xl p-4 transition-all duration-200",
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
  <p className={cn("text-sm text-foreground/60", className)} {...props}>
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