import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterChipProps {
  label: string;
  onClear: () => void;
  className?: string;
  leadingIcon?: React.ReactNode;
}

export function FilterChip({ label, onClear, className, leadingIcon }: FilterChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 h-8 text-sm bg-background/60',
        className
      )}
      title={label}
    >
      {leadingIcon}
      <span className="max-w-[22ch] truncate">{label}</span>
      <button
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="p-1 rounded hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
