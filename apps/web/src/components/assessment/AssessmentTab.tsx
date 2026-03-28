'use client';
import { useState } from 'react';
import { AnalysisView } from './AnalysisView';
import { ActivityFeed } from './ActivityFeed';
import { CheckCircle } from 'lucide-react';
import type { GapAnalysis, AgentActivity } from '@/lib/types';

type SubTab = 'analysis' | 'activity';

interface AssessmentTabProps {
  gapAnalysis?: GapAnalysis | null;
  hexRunUrl?: string | null;
  hexLoading?: boolean;
  hexError?: boolean;
  // Activity props (wired from DashboardShell)
  events?: AgentActivity[];
  isStreaming?: boolean;
  isComplete?: boolean;
}

export function AssessmentTab({
  gapAnalysis = null,
  hexRunUrl = null,
  hexLoading = false,
  hexError = false,
  events = [],
  isStreaming = false,
  isComplete = false,
}: AssessmentTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('analysis'); // D-06: Analysis is default

  return (
    <div className="h-full flex flex-col">
      {/* Sub-tab navigation */}
      <div className="flex gap-1 px-4 py-2 border-b border-slate-700 bg-slate-800/30">
        <button
          onClick={() => setSubTab('analysis')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'analysis'
              ? 'bg-slate-700 text-blue-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          Analysis
        </button>
        <button
          onClick={() => setSubTab('activity')}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            subTab === 'activity'
              ? 'bg-slate-700 text-blue-400'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
          }`}
        >
          Activity
        </button>
      </div>
      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {subTab === 'analysis' ? (
          <AnalysisView
            gapAnalysis={gapAnalysis}
            hexRunUrl={hexRunUrl}
            hexLoading={hexLoading}
            hexError={hexError}
          />
        ) : (
          <div className="h-full overflow-y-auto p-4">
            {events.length === 0 && !isStreaming ? (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <p className="text-lg font-medium">Activity Feed</p>
                  <p className="text-sm mt-1">Agent activity will appear here during pipeline runs</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
                  Agent Activity
                </h2>
                <ActivityFeed events={events} />
                {isComplete && (
                  <div className="flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <CheckCircle size={16} className="text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">
                      Pipeline complete
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
