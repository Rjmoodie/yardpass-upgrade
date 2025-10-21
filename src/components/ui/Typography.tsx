// components/ui/Typography.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

export const Title: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <h1 
    className={cn("text-2xl font-semibold text-neutral-800", className)} 
    {...props}
  >
    {children}
  </h1>
);

export const Subtitle: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <h2 
    className={cn("text-lg font-medium text-neutral-700", className)} 
    {...props}
  >
    {children}
  </h2>
);

export const Body: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <p 
    className={cn("text-base text-neutral-600 leading-relaxed", className)} 
    {...props}
  >
    {children}
  </p>
);

export const Caption: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <p 
    className={cn("text-sm text-neutral-500", className)} 
    {...props}
  >
    {children}
  </p>
);

export const Label: React.FC<TypographyProps> = ({ children, className, ...props }) => (
  <span 
    className={cn("text-sm font-medium text-neutral-700", className)} 
    {...props}
  >
    {children}
  </span>
);
