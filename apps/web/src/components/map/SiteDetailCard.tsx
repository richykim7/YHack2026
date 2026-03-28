'use client';
import { X, MapPin, Users, Package } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { HealthGauge } from '@/components/dashboard/HealthGauge';
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
  return (
    <div
      className={cn(
        'border border-slate-700/80 rounded-xl shadow-2xl shadow-black/40 overflow-hidden',
        className,
      )}
      style={{ background: 'linear-gradient(180deg, #1a2332 0%, #141c2b 100%)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3">
          <HealthGauge score={site.health_score} size={40} strokeWidth={4} />
          <div>
            <h3 className="text-sm font-display font-bold text-slate-100 tracking-wide">{site.name}</h3>
            <p className="text-[11px] text-slate-500 capitalize font-display tracking-wide">
              {site.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-slate-700/50 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Details grid */}
      <div className="px-4 pb-3 grid grid-cols-2 gap-2.5">
        {site.region && (
          <div className="flex items-center gap-1.5">
            <MapPin size={11} className="text-slate-600 shrink-0" />
            <span className="text-xs text-slate-400">{site.region}</span>
          </div>
        )}
        {site.serves_population != null && (
          <div className="flex items-center gap-1.5">
            <Users size={11} className="text-slate-600 shrink-0" />
            <span className="text-xs text-slate-400">
              {site.serves_population.toLocaleString()} served
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Package size={11} className="text-slate-600 shrink-0" />
          <span className="text-xs text-slate-400">
            {site.capacity_total_lbs.toLocaleString()} lbs cap.
          </span>
        </div>
      </div>

      {/* Inventory section */}
      <div className="border-t border-slate-700/60 px-4 py-3">
        <h4 className="text-[11px] font-display font-semibold text-slate-500 uppercase tracking-widest mb-2.5">
          Available Inventory
        </h4>
        {inventoryLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-3 bg-slate-700/30 rounded animate-pulse" />
            ))}
          </div>
        ) : inventoryTotals.length === 0 ? (
          <p className="text-xs text-slate-600">No available inventory</p>
        ) : (
          <div className="space-y-1.5">
            {inventoryTotals.map((t) => (
              <div key={t.category} className="flex items-center justify-between">
                <span className="text-xs text-slate-400 capitalize font-display tracking-wide">
                  {t.category}
                </span>
                <span className="text-xs font-mono text-slate-300 tabular-nums">
                  {t.totalLbs.toLocaleString()} lbs
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-slate-700/40 bg-slate-900/30">
        <p className="text-[10px] text-slate-600 flex items-center gap-1">
          <MapPin size={9} className="shrink-0" />
          {site.address}
        </p>
      </div>
    </div>
  );
}
