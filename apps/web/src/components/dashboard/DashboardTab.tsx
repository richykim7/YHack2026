'use client';
import { useState } from 'react';
import { NetworkHero } from './NetworkHero';
import { InventoryGauges } from './InventoryGauges';
import { ChatSidebar } from './ChatSidebar';
import { HexDashboard } from '@/components/hex/HexDashboard';
import { SiteSelector } from '@/components/ui/SiteSelector';
import { useSites } from '@/hooks/useSites';
import type { Site } from '@/lib/types';

interface DashboardTabProps {
  onLaunchPipeline?: (sessionId: string, crisisProfile: Record<string, unknown>) => void;
  isStreaming?: boolean;
  pipelineComplete?: boolean;
}

export function DashboardTab({ onLaunchPipeline, isStreaming, pipelineComplete }: DashboardTabProps) {
  const { sites } = useSites();
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Hero summary strip */}
        <NetworkHero />

        {/* Site selector + Inventory */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest">
              Inventory Breakdown
            </h2>
            <SiteSelector
              sites={sites}
              selectedSite={selectedSite}
              onSelect={setSelectedSite}
            />
          </div>
          <InventoryGauges
            selectedSiteId={selectedSite?.id ?? null}
          />
        </div>

        {/* Network Analytics (History) -- per D-04 */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
            Network Analytics
          </h2>
          <HexDashboard
            title="CrisisGrid History"
            runUrl={null}
            isLoading={false}
            isError={false}
            height={350}
            fallback={
              <div className="text-sm text-slate-500 py-8 text-center">
                <p>Historical analytics will appear here when Hex is configured.</p>
                <p className="text-xs mt-1">Set HEX_HISTORY_PROJECT_ID to enable.</p>
              </div>
            }
          />
        </div>
      </div>

      {/* Chat sidebar -- per D-04 */}
      <ChatSidebar
        onLaunchPipeline={onLaunchPipeline}
        pipelineStreaming={isStreaming}
        pipelineComplete={pipelineComplete}
      />
    </div>
  );
}
