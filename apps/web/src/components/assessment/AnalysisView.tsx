'use client';
import type { GapAnalysis } from '@/lib/types';
import { GapAnalysisChart } from './GapAnalysisChart';
import { HexDashboard } from '@/components/hex/HexDashboard';

interface AnalysisViewProps {
  gapAnalysis: GapAnalysis | null;
  hexRunUrl: string | null;
  hexLoading: boolean;
  hexError: boolean;
}

function FallbackMessage() {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 text-sm text-slate-400">
      Hex visualization unavailable — showing local analysis.
    </div>
  );
}

export function AnalysisView({ gapAnalysis, hexRunUrl, hexLoading, hexError }: AnalysisViewProps) {
  if (!gapAnalysis) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p className="text-sm">Run ASSESS pipeline to see gap analysis</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-4 space-y-4 h-full">
      {/* Local gap analysis renders immediately */}
      <GapAnalysisChart gaps={gapAnalysis.gaps_by_category} aiSummary={gapAnalysis.ai_summary} />

      {/* Summary stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400">Total Supply</div>
          <div className="text-lg font-semibold text-slate-100 tabular-nums">
            {gapAnalysis.total_supply_lbs.toLocaleString()} lbs
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400">Total Demand</div>
          <div className="text-lg font-semibold text-slate-100 tabular-nums">
            {gapAnalysis.total_demand_lbs.toLocaleString()} lbs
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400">Total Gap</div>
          <div className="text-lg font-semibold text-slate-100 tabular-nums">
            {gapAnalysis.total_gap_lbs.toLocaleString()} lbs
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-3">
          <div className="text-xs text-slate-400">Expiration Risk</div>
          <div className="text-lg font-semibold text-slate-100 tabular-nums">
            {gapAnalysis.expiration_risk_lbs.toLocaleString()} lbs
          </div>
        </div>
      </div>

      {/* Hex ASSESS visualization */}
      <HexDashboard
        title="ASSESS Visualization"
        runUrl={hexRunUrl}
        isLoading={hexLoading}
        isError={hexError}
        fallback={<FallbackMessage />}
      />
    </div>
  );
}
