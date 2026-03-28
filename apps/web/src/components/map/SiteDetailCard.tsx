'use client';
import { X } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { HEALTH_THRESHOLDS } from '@/lib/constants';
import type { Site } from '@/lib/types';
import type { SiteCategoryTotal } from '@/hooks/useSiteInventory';

interface SiteDetailCardProps {
  site: Site;
  inventoryTotals: SiteCategoryTotal[];
  inventoryLoading: boolean;
  onClose: () => void;
  className?: string;
}

export function SiteDetailCard({
  site,
  inventoryTotals,
  inventoryLoading,
  onClose,
  className,
}: SiteDetailCardProps) {
  const scoreColor =
    site.health_score >= HEALTH_THRESHOLDS.good
      ? 'text-green-400'
      : site.health_score >= HEALTH_THRESHOLDS.warning
        ? 'text-amber-400'
        : 'text-red-400';

  return (
    <div
      className={cn(
        'bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">{site.name}</h3>
          <p className="text-xs text-slate-400 capitalize">
            {site.type.replace('_', ' ')}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Health Score</span>
          <span className={cn('text-lg font-bold tabular-nums', scoreColor)}>
            {(site.health_score * 100).toFixed(0)}%
          </span>
        </div>
        {site.region && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Region</span>
            <span className="text-xs text-slate-300">{site.region}</span>
          </div>
        )}
        {site.serves_population != null && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Serves</span>
            <span className="text-xs text-slate-300">
              {site.serves_population.toLocaleString()} people
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Capacity</span>
          <span className="text-xs text-slate-300">
            {site.capacity_total_lbs.toLocaleString()} lbs
          </span>
        </div>
      </div>

      {/* Per-site inventory summary -- per MAP-03 */}
      <div className="mt-3 pt-3 border-t border-slate-700">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Inventory (Available)
        </h4>
        {inventoryLoading ? (
          <p className="text-xs text-slate-500">Loading...</p>
        ) : inventoryTotals.length === 0 ? (
          <p className="text-xs text-slate-500">No available inventory</p>
        ) : (
          <div className="space-y-1">
            {inventoryTotals.map((t) => (
              <div
                key={t.category}
                className="flex items-center justify-between"
              >
                <span className="text-xs text-slate-400 capitalize">
                  {t.category}
                </span>
                <span className="text-xs text-slate-300 tabular-nums">
                  {t.totalLbs.toLocaleString()} lbs
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 mt-3">{site.address}</p>
    </div>
  );
}
