'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { TabId, GapAnalysis, AssessResponse } from '@/lib/types';
import { DashboardHeader } from './DashboardHeader';
import { TabNavigation } from './TabNavigation';
import { DashboardTab } from '@/components/dashboard/DashboardTab';
import { MapTab } from '@/components/map/MapTab';
import { AssessmentTab } from '@/components/assessment/AssessmentTab';
import { PlansTab } from '@/components/placeholders/PlansTab';
import { FollowUpTab } from '@/components/placeholders/FollowUpTab';
import { UsageTab } from '@/components/usage/UsageTab';
import { useCrisisStream } from '@/hooks/useCrisisStream';
import { API_BASE } from '@/lib/api';

export function DashboardShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { events, isStreaming, isComplete, launchAndStream, stopStream } =
    useCrisisStream();
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [hexRunUrl, setHexRunUrl] = useState<string | null>(null);
  const crisisProfileRef = useRef<Record<string, unknown> | null>(null);

  const handleLaunch = useCallback(
    async (sessionId: string, crisisProfile: Record<string, unknown>) => {
      crisisProfileRef.current = crisisProfile;
      await launchAndStream(sessionId, crisisProfile);
    },
    [launchAndStream],
  );

  useEffect(() => {
    if (!isComplete || !crisisProfileRef.current) return;
    const profile = crisisProfileRef.current;
    fetch(`${API_BASE}/api/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
      .then((r) => r.json())
      .then((data: AssessResponse) => {
        setGapAnalysis(data.gap_analysis);
        if (data.hex_run?.run_url) setHexRunUrl(data.hex_run.run_url);
      })
      .catch(() => {
        /* assess endpoint unavailable, tab stays empty */
      });
  }, [isComplete]);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <DashboardHeader />
      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isStreaming={isStreaming}
      />
      <main className="flex-1 overflow-hidden">
        <div className={activeTab === 'dashboard' ? 'h-full' : 'hidden'}>
          <DashboardTab
            onLaunchPipeline={handleLaunch}
            isStreaming={isStreaming}
          />
        </div>
        <div className={activeTab === 'map' ? 'h-full' : 'hidden'}>
          <MapTab />
        </div>
        <div className={activeTab === 'assessment' ? 'h-full' : 'hidden'}>
          <AssessmentTab
            gapAnalysis={gapAnalysis}
            hexRunUrl={hexRunUrl}
            events={events}
            isStreaming={isStreaming}
            isComplete={isComplete}
          />
        </div>
        <div className={activeTab === 'plans' ? 'h-full' : 'hidden'}>
          <PlansTab />
        </div>
        <div className={activeTab === 'followup' ? 'h-full' : 'hidden'}>
          <FollowUpTab />
        </div>
        <div className={activeTab === 'usage' ? 'h-full' : 'hidden'}>
          <UsageTab />
        </div>
      </main>
    </div>
  );
}
