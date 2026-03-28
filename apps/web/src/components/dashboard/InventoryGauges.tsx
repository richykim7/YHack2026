'use client';
import { InventoryBar } from './InventoryBar';
import { useInventory } from '@/hooks/useInventory';

interface InventoryGaugesProps {
  selectedSiteId?: string | null;
  selectedSiteName?: string | null;
}

export function InventoryGauges({ selectedSiteId, selectedSiteName }: InventoryGaugesProps) {
  const { totals, loading, error } = useInventory(selectedSiteId);

  if (loading) return <div className="text-slate-500 text-sm">Loading inventory...</div>;
  if (error) return <div className="text-red-400 text-sm">Error: {error}</div>;

  const heading =
    selectedSiteId && selectedSiteName
      ? `${selectedSiteName} Inventory`
      : 'Network Inventory';

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
        {heading}
      </h2>
      <div className="space-y-3">
        {totals.map((t) => (
          <InventoryBar
            key={t.category}
            category={t.category}
            currentLbs={t.currentLbs}
            targetLbs={t.targetLbs}
          />
        ))}
      </div>
    </div>
  );
}
