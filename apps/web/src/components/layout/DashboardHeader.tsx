'use client';
import { NETWORK_NAME } from '@/lib/constants';

interface DashboardHeaderProps {
  healthScore?: number;
}

export function DashboardHeader({ healthScore }: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">CG</div>
        <div>
          <h1 className="text-lg font-semibold text-slate-100">CrisisGrid</h1>
          <p className="text-xs text-slate-400">{NETWORK_NAME}</p>
        </div>
      </div>
      <div id="health-gauge-slot">
        {/* HealthGauge component will be placed here by Plan 03 */}
      </div>
    </header>
  );
}
