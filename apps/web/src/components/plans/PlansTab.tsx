'use client';

import { useState } from 'react';
import type { ResponsePlan, GeneratedDocument } from '@/lib/types';
import { API_BASE } from '@/lib/api';
import { PlanCard } from '@/components/plans/PlanCard';
import { HexDashboard } from '@/components/hex/HexDashboard';
import { DocumentDrawer } from '@/components/plans/DocumentDrawer';
import { MOCK_PLANS } from '@/lib/mockData';

interface PlansTabProps {
  plans: ResponsePlan[];
  hexPlansUrl: string | null;
  isStreaming: boolean;
  isComplete: boolean;
  selectedPlanName: string | null;
  onSelectPlan: (plan: ResponsePlan) => void;
  acceptedPlanName?: string | null;
  onAcceptPlan?: (plan: ResponsePlan) => void;
  sessionId?: string | null;
}

export function PlansTab({
  plans,
  hexPlansUrl,
  isStreaming,
  isComplete,
  selectedPlanName,
  onSelectPlan,
  acceptedPlanName,
  onAcceptPlan,
  sessionId,
}: PlansTabProps) {

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);

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
        <div className="flex items-center gap-3">
          {acceptedPlanName && (
            <button
              onClick={async () => {
                if (sessionId) {
                  try {
                    const res = await fetch(`${API_BASE}/api/plans/${sessionId}/documents`);
                    if (res.ok) {
                      const data = await res.json();
                      setDocuments(data.documents || []);
                    }
                  } catch { /* graceful failure */ }
                }
                setDrawerOpen(true);
              }}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-display font-bold text-slate-200 uppercase tracking-widest transition-colors"
            >
              View Documents
            </button>
          )}
          {isMockData && (
            <span className="text-[10px] text-amber-500/50 font-mono">
              MOCK DATA
            </span>
          )}
        </div>
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
              isAccepted={acceptedPlanName === plan.name}
              isAnyAccepted={!!acceptedPlanName}
              onSelect={onSelectPlan}
              onAccept={onAcceptPlan ?? onSelectPlan}
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

      {/* Document drawer */}
      <DocumentDrawer documents={documents} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
