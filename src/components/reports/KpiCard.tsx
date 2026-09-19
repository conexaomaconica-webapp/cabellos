'use client';

import { LucideIcon, TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  comparison?: {
    percent: number | null;
    label: string;
    type: 'neutral' | 'positive' | 'negative' | 'new';
  };
  tooltip?: string;
  variant?: 'default' | 'highlight' | 'warning' | 'danger' | 'success';
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  comparison,
  tooltip,
  variant = 'default',
}: KpiCardProps) {
  const getBadgeStyle = () => {
    if (!comparison) return null;
    switch (comparison.type) {
      case 'positive':
        return {
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          icon: TrendingUp,
        };
      case 'negative':
        return {
          bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          icon: TrendingDown,
        };
      case 'new':
        return {
          bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          icon: Sparkles,
        };
      case 'neutral':
      default:
        return {
          bg: 'bg-slate-800 text-slate-400 border-slate-700',
          icon: Minus,
        };
    }
  };

  const badge = getBadgeStyle();
  const BadgeIcon = badge?.icon;

  const borderStyles: Record<string, string> = {
    default: 'border-slate-800 bg-slate-900/60',
    highlight: 'border-amber-500/30 bg-amber-500/5',
    success: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/40 bg-amber-500/10',
    danger: 'border-rose-500/30 bg-rose-500/5',
  };

  return (
    <div
      className={`relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 hover:border-slate-700 ${
        borderStyles[variant] || borderStyles.default
      }`}
      title={tooltip}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800/80 text-amber-400 shrink-0">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-2xl font-extrabold text-white tracking-tight">{value}</span>

        {comparison && badge && BadgeIcon && (
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold border ${badge.bg}`}
          >
            <BadgeIcon className="h-3 w-3" />
            <span>{comparison.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
