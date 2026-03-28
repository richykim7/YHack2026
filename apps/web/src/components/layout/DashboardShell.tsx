'use client';
import { useState } from 'react';
import type { TabId } from '@/lib/types';
import { DashboardHeader } from './DashboardHeader';
import { TabNavigation } from './TabNavigation';
import { AssessmentTab } from '@/components/placeholders/AssessmentTab';
import { PlansTab } from '@/components/placeholders/PlansTab';
import { FollowUpTab } from '@/components/placeholders/FollowUpTab';

export function DashboardShell() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100">
      <DashboardHeader />
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        <div className={activeTab === 'dashboard' ? 'h-full' : 'hidden'}>
          <div className="flex items-center justify-center h-full text-slate-500">
            <p>Dashboard content — Plan 03</p>
          </div>
        </div>
        <div className={activeTab === 'map' ? 'h-full' : 'hidden'}>
          <div className="flex items-center justify-center h-full text-slate-500">
            <p>Map content — Plan 02</p>
          </div>
        </div>
        <div className={activeTab === 'assessment' ? 'h-full' : 'hidden'}>
          <AssessmentTab />
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
