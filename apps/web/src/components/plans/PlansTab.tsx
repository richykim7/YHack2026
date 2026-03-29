'use client';

import type { ResponsePlan } from '@/lib/types';
import { PlanCard } from '@/components/plans/PlanCard';
import { HexDashboard } from '@/components/hex/HexDashboard';
import { MOCK_PLANS } from '@/lib/mockData';

interface PlansTabProps {
  plans: ResponsePlan[];
  hexPlansUrl: string | null;
  isStreaming: boolean;
  isComplete: boolean;
  selectedPlanName: string | null;
  onSelectPlan: (plan: ResponsePlan) => void;
}

export function PlansTab({
  plans,
  hexPlansUrl,
  isStreaming,
  isComplete,
  selectedPlanName,
  onSelectPlan,
}: PlansTabProps) {

  // TODO: Remove mock fallback when backend is ready
  const displayPlans = plans.length > 0 ? plans : MOCK_PLANS;
  const isMockData = plans.length === 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest">
          Response Plans
        </h2>
        {isMockData && (
          <span className="text-[10px] text-amber-500/50 font-mono">
            MOCK DATA
          </span>
        )}
      </div>

      {/* Empty state */}
      {displayPlans.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <div className="text-center">
            {isStreaming ? (
              <p className="text-sm animate-pulse">
                Generating response plans...
              </p>
            ) : isComplete ? (
              <p className="text-sm">No plans generated</p>
            ) : (
              <p className="text-sm">
                Plans available after OPTIMIZE pipeline runs
              </p>
            )}
          </div>
        </div>
      ) : (
        /* Plan cards grid */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-stagger-in">
          {displayPlans.map((plan) => (
            <PlanCard
              key={plan.name}
              plan={plan}
              isSelected={selectedPlanName === plan.name}
              onSelect={onSelectPlan}
            />
          ))}
        </div>
      )}

      {/* Hex Plans Dashboard */}
      <HexDashboard
        title="Plans Comparison"
        runUrl={hexPlansUrl}
        isLoading={isStreaming && !hexPlansUrl}
        isError={false}
        fallback={
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 text-sm text-slate-400">
            Plans visualization available after Hex notebook completes.
          </div>
        }
        height={500}
      />
    </div>
  );
}
