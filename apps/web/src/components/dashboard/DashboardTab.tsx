'use client';
import { useState, useEffect } from 'react';
import { NetworkHero } from './NetworkHero';
import { InventoryGauges } from './InventoryGauges';
import { ChatSidebar } from './ChatSidebar';
import { MonitorFeed } from './MonitorFeed';
import { HexDashboard } from '@/components/hex/HexDashboard';
import { SiteSelector } from '@/components/ui/SiteSelector';
import { Radio } from 'lucide-react';
import { useSites } from '@/hooks/useSites';
import type { Site, MonitorPost, MonitorClassification } from '@/lib/types';

interface DashboardTabProps {
  onLaunchPipeline?: (sessionId: string, crisisProfile: Record<string, unknown>) => void;
  isStreaming?: boolean;
  pipelineComplete?: boolean;
  // Monitor props (Phase 12)
  onStartMonitor?: () => void;
  monitorPosts?: MonitorPost[];
  classifications?: Map<string, MonitorClassification>;
  crisisDetected?: boolean;
  monitorMode?: 'idle' | 'monitoring' | 'pipeline';
  orchestratorSteps?: { step: string; model: string; message: string }[];
}

export function DashboardTab({
  onLaunchPipeline, isStreaming, pipelineComplete,
  onStartMonitor, monitorPosts, classifications, crisisDetected, monitorMode, orchestratorSteps,
}: DashboardTabProps) {
  const { sites } = useSites();
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);
  const [dashboardMode, setDashboardMode] = useState<'chat' | 'monitor'>('chat');

  // Auto-switch to monitor mode when monitor starts
  useEffect(() => {
    if (monitorMode === 'monitoring' || monitorMode === 'pipeline') {
      setDashboardMode('monitor');
    }
  }, [monitorMode]);

  return (
    <div className="flex h-full">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Hero summary strip */}
        <NetworkHero />

        {/* Monitor launch CTA */}
        {dashboardMode === 'chat' && !isStreaming && !pipelineComplete && (
          <button
            onClick={() => {
              setDashboardMode('monitor');
              onStartMonitor?.();
            }}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-500/40 transition-all group"
          >
            <Radio size={18} className="text-emerald-400 group-hover:animate-pulse" />
            <span className="text-sm font-display font-bold tracking-wide uppercase">
              Start Autonomous Monitor
            </span>
          </button>
        )}

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

      {/* Sidebar: Chat or Monitor Feed */}
      {dashboardMode === 'monitor' ? (
        <MonitorFeed
          posts={monitorPosts ?? []}
          classifications={classifications ?? new Map()}
          crisisDetected={crisisDetected ?? false}
          monitorMode={monitorMode ?? 'idle'}
          orchestratorSteps={orchestratorSteps}
        />
      ) : (
        <ChatSidebar
          onLaunchPipeline={onLaunchPipeline}
          pipelineStreaming={isStreaming}
          pipelineComplete={pipelineComplete}
        />
      )}
    </div>
  );
}
