'use client';
import { InventoryBar } from './InventoryBar';
import { useInventory } from '@/hooks/useInventory';

interface InventoryGaugesProps {
  selectedSiteId?: string | null;
}

export function InventoryGauges({ selectedSiteId }: InventoryGaugesProps) {
  const { totals, loading, error } = useInventory(selectedSiteId);

  if (loading) return <div className="text-slate-500 text-sm">Loading inventory...</div>;
  if (error) return <div className="text-red-400 text-sm">Error: {error}</div>;

  return (
    <div className="space-y-3">
      <div className="space-y-3 animate-stagger-in">
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
