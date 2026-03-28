'use client';
import { useState } from 'react';
import { InventoryGauges } from './InventoryGauges';
import { ChatSidebar } from './ChatSidebar';
import { useSites } from '@/hooks/useSites';
import type { Site } from '@/lib/types';

interface DashboardTabProps {
  onLaunchPipeline?: (sessionId: string, crisisProfile: Record<string, unknown>) => void;
  isStreaming?: boolean;
}

export function DashboardTab({ onLaunchPipeline, isStreaming }: DashboardTabProps) {
  const { sites } = useSites();
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Site selector for inventory drill-down -- per D-13 */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-400">View inventory for:</label>
          <select
            className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
            value={selectedSite?.id ?? ''}
            onChange={(e) => {
              if (e.target.value === '') {
                setSelectedSite(null);
              } else {
                const site = sites.find((s) => s.id === e.target.value) ?? null;
                setSelectedSite(site);
              }
            }}
          >
            <option value="">All Sites (Network-wide)</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>

        {/* Inventory gauges */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <InventoryGauges
            selectedSiteId={selectedSite?.id ?? null}
            selectedSiteName={selectedSite?.name ?? null}
          />
        </div>

        {/* Activity feed placeholder */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            Activity Feed
          </h2>
          <div className="text-sm text-slate-500">
            <p>Agent activity will appear here during crisis response</p>
          </div>
        </div>

        {/* Cost dashboard placeholder */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
            AI Cost Dashboard
          </h2>
          <div className="text-sm text-slate-500">
            <p>Per-agent cost breakdown will appear after pipeline runs</p>
          </div>
        </div>
      </div>

      {/* Chat sidebar -- per D-04 */}
      <ChatSidebar
        onLaunchPipeline={onLaunchPipeline}
        pipelineStreaming={isStreaming}
      />
    </div>
  );
}
