'use client';
import { Package, Warehouse, TrendingUp, Activity } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/Tooltip';
import { useSites } from '@/hooks/useSites';
import { useInventory } from '@/hooks/useInventory';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  tooltip?: string;
}

function StatCard({ icon, label, value, sub, accent = 'text-slate-100', tooltip }: StatCardProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest">
          {label}
          {tooltip && <InfoTooltip text={tooltip} />}
        </p>
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

  // Network Health: weighted average by serves_population
  const totalWeight = sites.reduce((sum, s) => sum + (s.serves_population ?? 1), 0);
  const avgHealth = totalWeight > 0
    ? sites.reduce((sum, s) => sum + s.health_score * (s.serves_population ?? 1), 0) / totalWeight
    : 0;
  const healthPct = Math.round(avgHealth * 100);
  const healthColor = healthPct >= 75 ? 'text-emerald-400' : healthPct >= 50 ? 'text-amber-400' : 'text-red-400';

  // Population: distribution sites only
  const distSites = sites.filter(s => s.type === 'distribution_site');
  const distPop = distSites.reduce((sum, s) => sum + (s.serves_population ?? 0), 0);

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
          icon={<Warehouse size={16} className={criticalSites > 0 ? 'text-amber-400' : 'text-emerald-400'} />}
          label="Site Status"
          value={`${healthySites} Healthy`}
          sub={criticalSites > 0 ? `${criticalSites} Critical` : 'All Stable'}
          accent={criticalSites > 0 ? 'text-amber-400' : 'text-emerald-400'}
        />

        <div className="w-px h-10 bg-slate-700/50" />

        <StatCard
          icon={<TrendingUp size={16} className="text-violet-400" />}
          label="Population Served"
          value={distPop > 0 ? `${Math.round(distPop / 1000)}K` : '--'}
          sub="People in Service Area"
          accent="text-slate-100"
        />

        <div className="w-px h-10 bg-slate-700/50" />

        <StatCard
          icon={<Activity size={16} className={healthColor} />}
          label="Network Health"
          value={`${healthPct}%`}
          accent={healthColor}
          tooltip="Average health score across all monitored sites, weighted by population served"
        />
      </div>
    </div>
  );
}
