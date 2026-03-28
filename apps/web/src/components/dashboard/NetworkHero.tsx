'use client';
import { Package, Warehouse, AlertTriangle, TrendingUp } from 'lucide-react';
import { useSites } from '@/hooks/useSites';
import { useInventory } from '@/hooks/useInventory';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}

function StatCard({ icon, label, value, sub, accent = 'text-slate-100' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
        <p className={`text-xl font-mono font-bold tabular-nums ${accent}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
      </div>
    </div>
  );
}

export function NetworkHero() {
  const { sites, loading: sitesLoading } = useSites();
  const { totals, loading: invLoading } = useInventory(null);

  const loading = sitesLoading || invLoading;

  const totalInventoryLbs = totals.reduce((sum, t) => sum + t.currentLbs, 0);
  const totalTargetLbs = totals.reduce((sum, t) => sum + t.targetLbs, 0);
  const fillPct = totalTargetLbs > 0 ? (totalInventoryLbs / totalTargetLbs) * 100 : 0;
  const healthySites = sites.filter(s => s.health_score >= 0.7).length;
  const criticalSites = sites.filter(s => s.health_score < 0.5).length;
  const totalPop = sites.reduce((sum, s) => sum + (s.serves_population ?? 0), 0);

  if (loading) {
    return (
      <div className="rounded-xl p-5 animate-pulse" style={{ background: 'linear-gradient(135deg, #1a2332 0%, #0f172a 100%)' }}>
        <div className="flex gap-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-700/40" />
              <div>
                <div className="w-16 h-2.5 bg-slate-700/40 rounded mb-2" />
                <div className="w-20 h-5 bg-slate-700/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-slate-700/50 p-5"
      style={{ background: 'linear-gradient(135deg, #141e2e 0%, #0f172a 60%, #1a1528 100%)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-8">
          <StatCard
            icon={<Package size={16} className="text-blue-400" />}
            label="Total Inventory"
            value={`${(totalInventoryLbs / 1000).toFixed(1)}k`}
            sub={`${fillPct.toFixed(0)}% of target`}
            accent="text-slate-100"
          />

          <div className="w-px h-10 bg-slate-700/50" />

          <StatCard
            icon={<Warehouse size={16} className="text-emerald-400" />}
            label="Sites Online"
            value={`${healthySites}/${sites.length}`}
            sub={criticalSites > 0 ? `${criticalSites} critical` : 'All operational'}
            accent={criticalSites > 0 ? 'text-amber-400' : 'text-emerald-400'}
          />

          <div className="w-px h-10 bg-slate-700/50" />

          <StatCard
            icon={<TrendingUp size={16} className="text-violet-400" />}
            label="Population Served"
            value={totalPop > 0 ? `${(totalPop / 1000).toFixed(0)}k` : '--'}
            accent="text-slate-100"
          />

          {criticalSites > 0 && (
            <>
              <div className="w-px h-10 bg-slate-700/50" />
              <StatCard
                icon={<AlertTriangle size={16} className="text-red-400" />}
                label="Needs Attention"
                value={`${criticalSites}`}
                sub={`site${criticalSites > 1 ? 's' : ''} below 50%`}
                accent="text-red-400"
              />
            </>
          )}
        </div>

        {/* Mini fill bar */}
        <div className="flex flex-col items-end gap-1 min-w-[120px]">
          <span className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest">Network Fill</span>
          <div className="w-full h-2 bg-slate-700/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                fillPct >= 70 ? 'bg-emerald-400' : fillPct >= 40 ? 'bg-amber-400' : 'bg-red-400'
              }`}
              style={{ width: `${Math.min(100, fillPct)}%` }}
            />
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">{fillPct.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
}
