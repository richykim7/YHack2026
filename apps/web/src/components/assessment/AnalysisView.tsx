'use client';
import { Package, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import type { GapAnalysis } from '@/lib/types';
import { GapAnalysisChart } from './GapAnalysisChart';
import { HexDashboard } from '@/components/hex/HexDashboard';

interface AnalysisViewProps {
  gapAnalysis: GapAnalysis | null;
  hexRunUrl: string | null;
  hexLoading: boolean;
  hexError: boolean;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  borderColor: string;
  valueColor?: string;
  alert?: boolean;
}

function StatCard({ icon, label, value, borderColor, valueColor = 'text-slate-100', alert }: StatCardProps) {
  return (
    <div className={`bg-slate-800 rounded-lg border border-slate-700 p-3 border-l-[3px] ${
      alert ? 'bg-red-500/5' : ''
    }`} style={{ borderLeftColor: borderColor }}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-lg font-mono font-bold tabular-nums ${valueColor}`}>
        {value}
      </div>
    </div>
  );
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

  const hasGap = gapAnalysis.total_gap_lbs < 0;
  const hasExpirationRisk = gapAnalysis.expiration_risk_lbs > 0;

  return (
    <div className="overflow-y-auto p-4 space-y-4 h-full">
      {/* Local gap analysis renders immediately */}
      <GapAnalysisChart gaps={gapAnalysis.gaps_by_category} aiSummary={gapAnalysis.ai_summary} />

      {/* Summary stats row */}
      <div className="grid grid-cols-4 gap-3 animate-stagger-in">
        <StatCard
          icon={<Package size={12} className="text-emerald-400" />}
          label="Total Supply"
          value={`${gapAnalysis.total_supply_lbs.toLocaleString()} lbs`}
          borderColor="#4ade80"
        />
        <StatCard
          icon={<TrendingUp size={12} className="text-blue-400" />}
          label="Total Demand"
          value={`${gapAnalysis.total_demand_lbs.toLocaleString()} lbs`}
          borderColor="#3b82f6"
        />
        <StatCard
          icon={<AlertTriangle size={12} className={hasGap ? 'text-red-400' : 'text-slate-400'} />}
          label="Total Gap"
          value={`${gapAnalysis.total_gap_lbs.toLocaleString()} lbs`}
          borderColor={hasGap ? '#f87171' : '#64748b'}
          valueColor={hasGap ? 'text-red-400' : 'text-slate-100'}
          alert={hasGap}
        />
        <StatCard
          icon={<Clock size={12} className={hasExpirationRisk ? 'text-amber-400' : 'text-slate-400'} />}
          label="Expiration Risk"
          value={`${gapAnalysis.expiration_risk_lbs.toLocaleString()} lbs`}
          borderColor={hasExpirationRisk ? '#fbbf24' : '#64748b'}
          valueColor={hasExpirationRisk ? 'text-amber-400' : 'text-slate-100'}
          alert={hasExpirationRisk}
        />
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
