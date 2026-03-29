'use client';
import { useState, useCallback } from 'react';
import { MapView } from './MapView';
import { SiteDetailCard } from './SiteDetailCard';
import { useSites } from '@/hooks/useSites';
import { useSiteInventory } from '@/hooks/useSiteInventory';
import { NetworkHealthGauge } from './NetworkHealthGauge';
import type { Site, ResponsePlan } from '@/lib/types';

export function MapTab({ selectedPlan }: { selectedPlan?: ResponsePlan | null }) {
  const { sites, loading, error } = useSites();
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const { categoryTotals, loading: inventoryLoading } = useSiteInventory(
    selectedSite?.id ?? null,
  );

  const clearSelection = useCallback(() => setSelectedSite(null), []);

  // Compute network health scores for gauge
  const currentScore = sites.length > 0
    ? sites.reduce((sum, s) => sum + s.health_score, 0) / sites.length
    : 0;

  const projectedScore = selectedPlan
    ? Math.min(
        currentScore + (1 - currentScore) * (selectedPlan.coverage_pct / 100) * 0.6,
        0.98
      )
    : currentScore;

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
      {selectedPlan && (
        <div className="absolute bottom-4 left-4 z-10">
          <NetworkHealthGauge
            currentScore={currentScore}
            projectedScore={projectedScore}
          />
        </div>
      )}
    </div>
  );
}
