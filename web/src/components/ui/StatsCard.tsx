import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, formatNumber, formatDelta } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: number | string;
  delta?: number;        // positive = increase, negative = decrease (percentage)
  deltaLabel?: string;   // e.g., "so với hôm qua"
  icon: LucideIcon;
  iconClassName?: string;
  loading?: boolean;
  className?: string;
}

export function StatsCard({
  label,
  value,
  delta,
  deltaLabel = 'so với hôm qua',
  icon: Icon,
  iconClassName,
  loading = false,
  className,
}: StatsCardProps): JSX.Element {
  if (loading) {
    return (
      <div className={cn('card p-6', className)} aria-busy="true">
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton h-4 w-24 rounded" />
          <div className="skeleton h-9 w-9 rounded-lg" />
        </div>
        <div className="skeleton h-8 w-16 rounded mb-2" />
        <div className="skeleton h-4 w-32 rounded" />
      </div>
    );
  }

  const displayValue =
    typeof value === 'number' ? formatNumber(value) : value;

  const hasDelta = delta !== undefined && delta !== null;
  const isPositive = (delta ?? 0) > 0;
  const isNeutral = (delta ?? 0) === 0;

  return (
    <div
      className={cn(
        'card p-6 hover:shadow-md hover:border-neutral-300 transition-all duration-fast',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-caption text-neutral-500 uppercase tracking-wide">
          {label}
        </span>
        <span
          className={cn(
            'p-2 rounded-lg bg-primary-50 text-primary-600',
            iconClassName,
          )}
          aria-hidden="true"
        >
          <Icon className="w-5 h-5" />
        </span>
      </div>

      <p className="text-display font-bold text-neutral-950 tabular-nums">
        {displayValue}
      </p>

      {hasDelta && (
        <div className="flex items-center gap-1.5 mt-2">
          {isNeutral ? (
            <Minus className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
          ) : isPositive ? (
            <TrendingUp
              className="w-3.5 h-3.5 text-success-base"
              aria-hidden="true"
            />
          ) : (
            <TrendingDown
              className="w-3.5 h-3.5 text-danger-base"
              aria-hidden="true"
            />
          )}
          <span
            className={cn('text-xs font-medium', {
              'text-success-text': isPositive && !isNeutral,
              'text-danger-text': !isPositive && !isNeutral,
              'text-neutral-500': isNeutral,
            })}
          >
            {isNeutral ? 'Không thảy đổi' : formatDelta(delta!)}
          </span>
          {deltaLabel && (
            <span className="text-xs text-neutral-400">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
