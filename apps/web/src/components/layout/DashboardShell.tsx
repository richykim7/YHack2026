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
  const [tabKey, setTabKey] = useState(0);
  const { events, isStreaming, isComplete, launchAndStream } =
    useCrisisStream();
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [hexRunUrl, setHexRunUrl] = useState<string | null>(null);
  const crisisProfileRef = useRef<Record<string, unknown> | null>(null);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setTabKey(k => k + 1);
  }, []);

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
        onTabChange={handleTabChange}
        isStreaming={isStreaming}
      />
      <main className="flex-1 overflow-hidden">
        <div key={activeTab === 'dashboard' ? `dashboard-${tabKey}` : 'dashboard'} className={activeTab === 'dashboard' ? 'h-full animate-tab-in' : 'hidden'}>
          <DashboardTab
            onLaunchPipeline={handleLaunch}
            isStreaming={isStreaming}
          />
        </div>
        <div key={activeTab === 'map' ? `map-${tabKey}` : 'map'} className={activeTab === 'map' ? 'h-full animate-tab-in' : 'hidden'}>
          <MapTab />
        </div>
        <div key={activeTab === 'assessment' ? `assessment-${tabKey}` : 'assessment'} className={activeTab === 'assessment' ? 'h-full animate-tab-in' : 'hidden'}>
          <AssessmentTab
            gapAnalysis={gapAnalysis}
            hexRunUrl={hexRunUrl}
            events={events}
            isStreaming={isStreaming}
            isComplete={isComplete}
          />
        </div>
        <div key={activeTab === 'plans' ? `plans-${tabKey}` : 'plans'} className={activeTab === 'plans' ? 'h-full animate-tab-in' : 'hidden'}>
          <PlansTab />
        </div>
        <div key={activeTab === 'followup' ? `followup-${tabKey}` : 'followup'} className={activeTab === 'followup' ? 'h-full animate-tab-in' : 'hidden'}>
          <FollowUpTab />
        </div>
        <div key={activeTab === 'usage' ? `usage-${tabKey}` : 'usage'} className={activeTab === 'usage' ? 'h-full animate-tab-in' : 'hidden'}>
          <UsageTab />
        </div>
      </main>
    </div>
  );
}
