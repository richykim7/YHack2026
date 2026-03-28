'use client';
import type { CategoryGap } from '@/lib/types';

interface GapAnalysisChartProps {
  gaps: CategoryGap[];
  aiSummary: string;
}

export function GapAnalysisChart({ gaps, aiSummary }: GapAnalysisChartProps) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
        Supply Gap Analysis
      </h3>

      {aiSummary && (
        <p className="text-sm text-slate-300 italic mb-4">{aiSummary}</p>
      )}

      <div className="space-y-3">
        {gaps.map((gap) => {
          const pct = gap.demand_lbs > 0
            ? Math.min(100, (gap.supply_lbs / gap.demand_lbs) * 100)
            : 0;
          const color =
            gap.coverage_ratio >= 0.8
              ? 'bg-green-400'
              : gap.coverage_ratio >= 0.5
                ? 'bg-amber-400'
                : 'bg-red-400';
          const hasDeficit = gap.gap_lbs < 0;

          return (
            <div key={gap.category} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-300 capitalize">{gap.category}</span>
                <span className={`tabular-nums ${hasDeficit ? 'text-red-400' : 'text-green-400'}`}>
                  {hasDeficit
                    ? `-${Math.abs(gap.gap_lbs).toLocaleString()} lbs deficit`
                    : 'Adequate'}
                </span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
