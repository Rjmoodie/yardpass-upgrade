// components/ui/TabNavigation.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface TabNavigationProps {
  items: string[];
  active: number;
  onChange: (index: number) => void;
  className?: string;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ items, active, onChange, className }) => (
  <div className={cn(
    "flex rounded-md border border-neutral-200 bg-neutral-50 p-1",
    className
  )}>
    {items.map((item, index) => {
      const isActive = index === active;
      return (
        <button
          key={item}
          onClick={() => onChange(index)}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2",
            isActive 
              ? "bg-brand-100 text-brand-600 border border-brand-200 shadow-subtle" 
              : "text-neutral-600 hover:bg-white hover:text-neutral-700"
          )}
        >
          {item}
        </button>
      );
    })}
  </div>
);
