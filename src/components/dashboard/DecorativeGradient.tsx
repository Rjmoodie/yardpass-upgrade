// Lightweight decorative gradient component (no blur for performance)
interface DecorativeGradientProps {
  color?: 'primary' | 'emerald' | 'amber' | 'sky' | 'purple' | 'rose' | 'slate';
  side?: 'right' | 'left' | 'top' | 'bottom';
}

export function DecorativeGradient({ color = 'primary', side = 'right' }: DecorativeGradientProps) {
  const colorMap = {
    primary: 'from-primary/10',
    emerald: 'from-emerald-500/10',
    amber: 'from-amber-500/10',
    sky: 'from-sky-500/10',
    purple: 'from-purple-500/10',
    rose: 'from-rose-500/10',
    slate: 'from-slate-500/10',
  };

  const positionMap = {
    right: 'inset-y-0 right-0 w-1/3 bg-gradient-to-l',
    left: 'inset-y-0 left-0 w-1/3 bg-gradient-to-r',
    top: 'inset-x-0 top-0 h-1/3 bg-gradient-to-b',
    bottom: 'inset-x-0 bottom-0 h-1/3 bg-gradient-to-t',
  };

  return (
    <span 
      className={`pointer-events-none absolute ${positionMap[side]} ${colorMap[color]} to-transparent`}
      aria-hidden="true"
    />
  );
}

