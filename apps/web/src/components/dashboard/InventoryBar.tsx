import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface InventoryBarProps {
  category: string;
  currentLbs: number;
  targetLbs: number;
}

export function InventoryBar({ category, currentLbs, targetLbs }: InventoryBarProps) {
  const pct = targetLbs > 0 ? Math.min(100, (currentLbs / targetLbs) * 100) : 0;
  const isFull = pct >= 100;
  const isCritical = pct < 40;
  const isWarning = pct >= 40 && pct < 70;

  const barColor = isCritical
    ? 'bg-red-400'
    : isWarning
      ? 'bg-amber-400'
      : 'bg-green-400';

  const barGlow = isCritical
    ? 'shadow-[0_0_8px_rgba(248,113,113,0.3)]'
    : '';

  return (
    <div className={`rounded-lg px-3 py-2.5 transition-colors ${
      isCritical ? 'bg-red-500/5 border border-red-500/15' : 'bg-transparent'
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertTriangle size={13} className="text-red-400 shrink-0" />
          ) : isFull ? (
            <ShieldCheck size={13} className="text-emerald-400 shrink-0" />
          ) : pct >= 70 ? (
            <CheckCircle2 size={13} className="text-green-400/60 shrink-0" />
          ) : null}
          <span className="text-sm text-slate-200 capitalize font-display font-semibold tracking-wide">
            {category}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Percentage badge */}
          <span className={`text-[11px] font-mono font-medium px-1.5 py-0.5 rounded ${
            isFull
              ? 'bg-emerald-500/15 text-emerald-400'
              : isCritical
                ? 'bg-red-500/15 text-red-400'
                : isWarning
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-green-500/10 text-green-400/80'
          }`}>
            {pct.toFixed(0)}%
          </span>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {currentLbs.toLocaleString()} / {targetLbs.toLocaleString()} lbs
          </span>
        </div>
      </div>
      <div className={`${isCritical ? 'h-3.5' : 'h-2.5'} bg-slate-700/60 rounded-full overflow-hidden transition-all`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor} ${barGlow}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
