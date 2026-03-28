'use client';
import { NETWORK_NAME } from '@/lib/constants';
import { HealthGauge } from '@/components/dashboard/HealthGauge';
import { useSites } from '@/hooks/useSites';
import { Activity, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

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

  const healthySites = sites.filter(s => s.health_score >= 0.7).length;
  const warningSites = sites.filter(s => s.health_score >= 0.5 && s.health_score < 0.7).length;
  const criticalSites = sites.filter(s => s.health_score < 0.5).length;

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center text-white font-display font-bold text-sm tracking-wide">
          CG
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-slate-100 tracking-wide">CrisisGrid</h1>
          <p className="text-xs text-slate-400">{NETWORK_NAME}</p>
        </div>
      </div>

      {/* Network health with context breakdown */}
      <div className="flex items-center gap-5">
        {loading ? (
          <div className="flex items-center gap-4 animate-pulse">
            <div className="w-32 h-8 bg-slate-700 rounded" />
            <div className="w-16 h-16 rounded-full bg-slate-700" />
          </div>
        ) : (
          <>
            {/* Site breakdown */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-slate-500" />
                <span className="text-[11px] font-display font-semibold text-slate-400 uppercase tracking-widest">
                  Network Health
                </span>
              </div>
              <div className="flex items-center gap-3">
                {healthySites > 0 && (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-green-400" />
                    <span className="text-xs font-mono text-green-400">{healthySites}</span>
                  </div>
                )}
                {warningSites > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle size={12} className="text-amber-400" />
                    <span className="text-xs font-mono text-amber-400">{warningSites}</span>
                  </div>
                )}
                {criticalSites > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle size={12} className="text-red-400" />
                    <span className="text-xs font-mono text-red-400">{criticalSites}</span>
                  </div>
                )}
                <span className="text-[10px] text-slate-500">
                  of {sites.length} sites
                </span>
              </div>
            </div>

            {/* Gauge */}
            <HealthGauge score={compositeScore} size={56} strokeWidth={5} />
          </>
        )}
      </div>
    </header>
  );
}
