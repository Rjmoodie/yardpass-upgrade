import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  onClear: () => void;
}

export function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 h-8 text-sm">
      {label}
      <button onClick={onClear} className="p-1 rounded hover:bg-muted">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}