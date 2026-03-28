'use client';

import type { ResponsePlan } from '@/lib/types';
import { cn } from '@/components/ui/cn';
import { Clock, DollarSign, Users, ShieldCheck } from 'lucide-react';

interface PlanCardProps {
  plan: ResponsePlan;
  isSelected: boolean;
  onSelect: (plan: ResponsePlan) => void;
}

const PLAN_DISPLAY: Record<
  ResponsePlan['name'],
  { label: string; accent: string }
> = {
  fastest: { label: 'Fastest', accent: 'border-l-emerald-400' },
  cheapest: { label: 'Cheapest', accent: 'border-l-amber-400' },
  best_nutrition: { label: 'Best Nutrition', accent: 'border-l-blue-400' },
};

export function PlanCard({ plan, isSelected, onSelect }: PlanCardProps) {
  const display = PLAN_DISPLAY[plan.name];

  return (
    <div
      className={cn(
        'bg-slate-800 rounded-lg border border-slate-700 p-5 border-l-[3px] transition-all duration-200',
        display.accent,
        isSelected && 'ring-2 ring-blue-500 border-blue-500',
      )}
    >
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
            </span>
          </div>
          <span className="font-mono font-bold tabular-nums text-lg text-slate-100">
            {Math.round(plan.coverage_pct * 100)}%
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

      {/* Select button */}
      <button
        type="button"
        onClick={() => onSelect(plan)}
        className={cn(
          'w-full rounded-lg py-2 font-display font-bold uppercase tracking-widest text-sm transition-colors',
          isSelected
            ? 'bg-blue-500 text-white'
            : 'bg-blue-600 hover:bg-blue-500 text-white',
        )}
      >
        {isSelected ? 'Selected' : 'Select Plan'}
      </button>
    </div>
  );
}
