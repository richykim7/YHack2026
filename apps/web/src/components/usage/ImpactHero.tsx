'use client';
import { Clock, Users, Package, DollarSign } from 'lucide-react';

interface ImpactHeroProps {
  pipelineDurationMs?: number;
  peopleServed?: number;
  suppliersIdentified?: number;
  categoriesCovered?: number;
  totalCost: number;
}

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

export function ImpactHero({
  pipelineDurationMs,
  peopleServed,
  suppliersIdentified,
  categoriesCovered,
  totalCost,
}: ImpactHeroProps) {
  const durationSec = pipelineDurationMs ? (pipelineDurationMs / 1000).toFixed(1) : '--';
  const formattedCost = totalCost < 0.01 && totalCost > 0
    ? `$${totalCost.toFixed(4)}`
    : `$${totalCost.toFixed(2)}`;

  return (
    <div
      className="rounded-xl border border-slate-700/50 p-5"
      style={{ background: 'linear-gradient(135deg, #141e2e 0%, #0f172a 60%, #1a1528 100%)' }}
    >
      <div className="flex items-center gap-8 flex-wrap">
        <StatCard
          icon={<Clock size={16} className="text-blue-400" />}
          label="Analysis Time"
          value={`${durationSec}s`}
          sub="vs 4+ hours manually"
          accent="text-blue-300"
        />

        <div className="w-px h-10 bg-slate-700/50" />

        <StatCard
          icon={<Users size={16} className="text-emerald-400" />}
          label="People Served"
          value={peopleServed ? peopleServed.toLocaleString() : '--'}
          sub="potential beneficiaries"
          accent="text-emerald-300"
        />

        <div className="w-px h-10 bg-slate-700/50" />

        <StatCard
          icon={<Package size={16} className="text-violet-400" />}
          label="Suppliers Found"
          value={suppliersIdentified?.toString() ?? '--'}
          sub={`across ${categoriesCovered ?? 0} food categories`}
          accent="text-violet-300"
        />

        <div className="w-px h-10 bg-slate-700/50" />

        <StatCard
          icon={<DollarSign size={16} className="text-amber-400" />}
          label="AI Cost"
          value={formattedCost}
          sub="total pipeline cost"
          accent="text-amber-300"
        />
      </div>
    </div>
  );
}
