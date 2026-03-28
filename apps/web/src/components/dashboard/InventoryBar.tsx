interface InventoryBarProps {
  category: string;
  currentLbs: number;
  targetLbs: number;
}

export function InventoryBar({ category, currentLbs, targetLbs }: InventoryBarProps) {
  const pct = targetLbs > 0 ? Math.min(100, (currentLbs / targetLbs) * 100) : 0;
  const color = pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300 capitalize">{category}</span>
        <span className="text-slate-400 tabular-nums">
          {currentLbs.toLocaleString()} / {targetLbs.toLocaleString()} lbs
        </span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
