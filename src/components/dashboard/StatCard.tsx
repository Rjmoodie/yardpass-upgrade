import type { LucideIcon } from 'lucide-react';
import { DecorativeGradient } from './DecorativeGradient';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper?: string;
  color?: 'primary' | 'emerald' | 'amber' | 'sky' | 'purple' | 'rose' | 'slate';
}

export function StatCard({ icon: Icon, label, value, helper, color = 'primary' }: StatCardProps) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    sky: 'bg-sky-500/10 text-sky-500',
    purple: 'bg-purple-500/10 text-purple-500',
    rose: 'bg-rose-500/10 text-rose-500',
    slate: 'bg-slate-500/10 text-slate-500 dark:text-slate-300',
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/20 bg-gradient-to-br from-card/60 to-card/40 backdrop-blur-sm p-4 shadow-sm">
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="block text-xs font-medium uppercase tracking-wide text-foreground/50">
            {label}
          </span>
          <div className="mt-2 text-3xl font-bold text-foreground tabular-nums tracking-tight">
            {value}
          </div>
          {helper && (
            <div className="mt-1 text-xs text-foreground/60 truncate font-medium" title={helper}>
              {helper}
            </div>
          )}
        </div>
        <div className={`flex-shrink-0 rounded-full p-2.5 ${colorMap[color]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

