'use client';
import { useState, useEffect, useCallback } from 'react';
import type { TabId, ResponsePlan, SelectedPlanState, AcceptPlanResponse } from '@/lib/types';
import { postJSON } from '@/lib/api';
import { DashboardHeader } from './DashboardHeader';
import { TabNavigation } from './TabNavigation';
import { DashboardTab } from '@/components/dashboard/DashboardTab';
import { MapTab } from '@/components/map/MapTab';
import { AssessmentTab } from '@/components/assessment/AssessmentTab';
import { PlansTab } from '@/components/plans/PlansTab';
import { FollowUpTab } from '@/components/placeholders/FollowUpTab';
import { UsageTab } from '@/components/usage/UsageTab';
import { useCrisisStream } from '@/hooks/useCrisisStream';
import { useLavaCosts } from '@/hooks/useLavaCosts';
import { HARDCODED_GAP_ANALYSIS } from '@/lib/mockData';

const CACHED_HEX_ASSESS_URL = process.env.NEXT_PUBLIC_HEX_ASSESS_CACHED_URL || null;

export function DashboardShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [tabKey, setTabKey] = useState(0);
  const {
    events, isStreaming, isComplete, launchAndStream, plans, sources, hexPlansUrl, hexAssessUrl, gapAnalysis,
    sessionId,
    pipelineDurationMs,
    monitorPosts, classifications, crisisDetected, monitorMode, startMonitorAndStream,
  } = useCrisisStream();
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlanState>(null);
  const [acceptedPlanName, setAcceptedPlanName] = useState<string | null>(null);
  const [orchestratorSteps, setOrchestratorSteps] = useState<{ step: string; model: string; message: string }[]>([]);
  const { refetch: refetchCosts } = useLavaCosts();

  const effectiveHexUrl = hexAssessUrl || CACHED_HEX_ASSESS_URL;

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setTabKey(k => k + 1);
  }, []);

  const handleLaunch = useCallback(
    async (sessionId: string, crisisProfile: Record<string, unknown>) => {
      await launchAndStream(sessionId, crisisProfile);
    },
    [launchAndStream],
  );

  const handleSelectPlan = useCallback((plan: ResponsePlan) => {
    setSelectedPlan(plan);
    setActiveTab('map');
    setTabKey(k => k + 1);
  }, []);

  const handleAcceptPlan = useCallback(async (plan: ResponsePlan) => {
    try {
      await postJSON<AcceptPlanResponse>('/api/plans/accept', {
        crisis_event_id: sessionId,
        plan,
        target_site_id: '',
      });
      setAcceptedPlanName(plan.name);
      setSelectedPlan(plan);
      setActiveTab('map');
      setTabKey(k => k + 1);
    } catch (err) {
      // Backend may not exist yet -- do frontend-only state change
      console.warn('Plan accept API not available, applying frontend-only state:', err);
      setAcceptedPlanName(plan.name);
      setSelectedPlan(plan);
      setActiveTab('map');
      setTabKey(k => k + 1);
    }
  }, [sessionId]);

  // Refetch Lava costs after pipeline completes
  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => refetchCosts(), 2000);
      return () => clearTimeout(timer);
    }
  }, [isComplete, refetchCosts]);

  // Extract orchestrator steps from activity events for MonitorFeed
  useEffect(() => {
    const steps = events
      .filter(e => e.agent === 'orchestrator' && e.status === 'running')
      .map(e => {
        const msg = e.message || '';
        return { step: msg, model: '', message: msg };
      });
    setOrchestratorSteps(steps);
  }, [events]);

  const handleStartMonitor = useCallback(async () => {
    await startMonitorAndStream();
  }, [startMonitorAndStream]);

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <DashboardHeader selectedPlan={selectedPlan} />
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
            pipelineComplete={isComplete}
            onStartMonitor={handleStartMonitor}
            monitorPosts={monitorPosts}
            classifications={classifications}
            crisisDetected={crisisDetected}
            monitorMode={monitorMode}
            orchestratorSteps={orchestratorSteps}
          />
        </div>
        <div key={activeTab === 'map' ? `map-${tabKey}` : 'map'} className={activeTab === 'map' ? 'h-full animate-tab-in' : 'hidden'}>
          <MapTab selectedPlan={selectedPlan} />
        </div>
        <div key={activeTab === 'assessment' ? `assessment-${tabKey}` : 'assessment'} className={activeTab === 'assessment' ? 'h-full animate-tab-in' : 'hidden'}>
          <AssessmentTab
            gapAnalysis={gapAnalysis ?? HARDCODED_GAP_ANALYSIS}
            hexRunUrl={effectiveHexUrl}
            events={events}
            isStreaming={isStreaming}
            isComplete={isComplete}
          />
        </div>
        <div key={activeTab === 'plans' ? `plans-${tabKey}` : 'plans'} className={activeTab === 'plans' ? 'h-full animate-tab-in' : 'hidden'}>
          <PlansTab
            plans={plans}
            hexPlansUrl={hexPlansUrl}
            isStreaming={isStreaming}
            isComplete={isComplete}
            selectedPlanName={selectedPlan?.name ?? null}
            onSelectPlan={handleSelectPlan}
            acceptedPlanName={acceptedPlanName}
            onAcceptPlan={handleAcceptPlan}
            sessionId={sessionId}
          />
        </div>
        <div key={activeTab === 'followup' ? `followup-${tabKey}` : 'followup'} className={activeTab === 'followup' ? 'h-full animate-tab-in' : 'hidden'}>
          <FollowUpTab pipelineComplete={isComplete} />
        </div>
        <div key={activeTab === 'usage' ? `usage-${tabKey}` : 'usage'} className={activeTab === 'usage' ? 'h-full animate-tab-in' : 'hidden'}>
          <UsageTab pipelineComplete={isComplete} plans={plans} sources={sources} pipelineDurationMs={pipelineDurationMs} />
        </div>
      </main>
    </div>
  );
}
