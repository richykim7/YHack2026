'use client';
import { useState, useCallback } from 'react';
import { MapView } from './MapView';
import { SiteDetailCard } from './SiteDetailCard';
import { useSites } from '@/hooks/useSites';
import { useSiteInventory } from '@/hooks/useSiteInventory';
import type { Site, ResponsePlan } from '@/lib/types';

export function MapTab({ selectedPlan }: { selectedPlan?: ResponsePlan | null }) {
  const { sites, loading, error } = useSites();
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const { categoryTotals, loading: inventoryLoading } = useSiteInventory(
    selectedSite?.id ?? null,
  );

  const clearSelection = useCallback(() => setSelectedSite(null), []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <p>Loading sites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400">
        <p>Error loading sites: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapView
        sites={sites}
        selectedSiteId={selectedSite?.id ?? null}
        onSiteClick={setSelectedSite}
        onBackgroundClick={clearSelection}
        selectedPlan={selectedPlan ?? null}
      />
      {/* Vignette edge overlay */}
      <div className="map-vignette" />
      {selectedSite && (
        <SiteDetailCard
          site={selectedSite}
          inventoryTotals={categoryTotals}
          inventoryLoading={inventoryLoading}
          onClose={clearSelection}
          className="absolute top-4 right-4 w-80 z-10 animate-slide-in-right"
        />
      )}
    </div>
  );
}
