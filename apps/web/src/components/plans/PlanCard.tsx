'use client';

import type { ResponsePlan } from '@/lib/types';
import { cn } from '@/components/ui/cn';
import { InfoTooltip } from '@/components/ui/Tooltip';
import { Clock, DollarSign, Users, ShieldCheck, Check } from 'lucide-react';

interface PlanCardProps {
  plan: ResponsePlan;
  isSelected: boolean;
  isAccepted: boolean;
  isAnyAccepted: boolean;
  onSelect: (plan: ResponsePlan) => void;
  onAccept: (plan: ResponsePlan) => void;
}

const PLAN_DISPLAY: Record<
  ResponsePlan['name'],
  { label: string; accent: string }
> = {
  fastest: { label: 'Fastest', accent: 'border-l-emerald-400' },
  cheapest: { label: 'Cheapest', accent: 'border-l-amber-400' },
  best_nutrition: { label: 'Best Nutrition', accent: 'border-l-blue-400' },
};

export function PlanCard({ plan, isSelected, isAccepted, isAnyAccepted, onSelect, onAccept }: PlanCardProps) {
  const display = PLAN_DISPLAY[plan.name];

  return (
    <div
      className={cn(
        'relative bg-slate-800 rounded-lg border border-slate-700 p-5 border-l-[3px] transition-all duration-200',
        display.accent,
        isSelected && 'ring-2 ring-blue-500 border-blue-500',
        isAnyAccepted && !isAccepted && 'opacity-50 pointer-events-none',
      )}
    >
      {/* Accepted badge */}
      {isAccepted && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40">
          <Check size={12} className="text-emerald-400" />
          <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">Accepted</span>
        </div>
      )}

      {/* Plan name */}
      <h3 className="font-display font-bold text-slate-100 uppercase tracking-widest text-sm">
        {display.label}
      </h3>

      {/* Strategy */}
      <p className="text-sm text-slate-400 mb-4 mt-1 line-clamp-2">
        {plan.strategy}
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <DollarSign className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">
              Total Cost
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-lg text-slate-100">
            ${plan.total_cost.toLocaleString()}
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">
              Coverage
              <InfoTooltip text="Percentage of projected demand gap that this plan can fill" />
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-lg text-slate-100">
            {Math.round(plan.coverage_pct)}%
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">
              Lead Time
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-lg text-slate-100">
            {plan.max_lead_time_days} days
          </span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">
              People Served
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-lg text-slate-100">
            {plan.estimated_people_served.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Line items count */}
      <p className="text-xs text-slate-500 mb-3">
        {plan.line_items.length} line items
      </p>

      {/* Action buttons */}
      {!isAccepted && !isAnyAccepted && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSelect(plan)}
            className={cn(
              'flex-1 rounded-lg py-2 font-display font-bold uppercase tracking-widest text-xs transition-colors',
              isSelected ? 'bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300',
            )}
          >
            {isSelected ? 'Viewing' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => onAccept(plan)}
            className="flex-1 rounded-lg py-2 font-display font-bold uppercase tracking-widest text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
          >
            Accept Plan
          </button>
        </div>
      )}
    </div>
  );
}
