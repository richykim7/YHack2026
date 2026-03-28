'use client';
import { useState } from 'react';
import type { TabId } from '@/lib/types';
import { DashboardHeader } from './DashboardHeader';
import { TabNavigation } from './TabNavigation';
import { DashboardTab } from '@/components/dashboard/DashboardTab';
import { MapTab } from '@/components/map/MapTab';
import { AssessmentTab } from '@/components/placeholders/AssessmentTab';
import { PlansTab } from '@/components/placeholders/PlansTab';
import { FollowUpTab } from '@/components/placeholders/FollowUpTab';
import { useCrisisStream } from '@/hooks/useCrisisStream';

export function DashboardShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const { events, isStreaming, isComplete, launchAndStream, stopStream } =
    useCrisisStream();

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
            onLaunchPipeline={launchAndStream}
            isStreaming={isStreaming}
          />
        </div>
        <div className={activeTab === 'map' ? 'h-full' : 'hidden'}>
          <MapTab />
        </div>
        <div className={activeTab === 'assessment' ? 'h-full' : 'hidden'}>
          <AssessmentTab
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
      </main>
    </div>
  );
}
