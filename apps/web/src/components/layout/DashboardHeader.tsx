'use client';
import { NETWORK_NAME } from '@/lib/constants';
import { HealthGauge } from '@/components/dashboard/HealthGauge';
import { useSites } from '@/hooks/useSites';

export function DashboardHeader() {
  const { sites, loading } = useSites();

  // Compute composite network health score: weighted average by serves_population
  const compositeScore = (() => {
    if (sites.length === 0) return 0;

    let totalWeight = 0;
    let weightedSum = 0;

    for (const site of sites) {
      const weight = site.serves_population ?? 1;
      weightedSum += site.health_score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  })();

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">CG</div>
        <div>
          <h1 className="text-lg font-semibold text-slate-100">CrisisGrid</h1>
          <p className="text-xs text-slate-400">{NETWORK_NAME}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="w-16 h-16 rounded-full bg-slate-700 animate-pulse" />
        ) : (
          <>
            <span className="text-xs text-slate-400 uppercase tracking-wider">Network Health</span>
            <HealthGauge score={compositeScore} size={64} strokeWidth={6} />
          </>
        )}
      </div>
    </header>
  );
}
