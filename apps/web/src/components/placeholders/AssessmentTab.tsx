import type { AgentActivity } from '@/lib/types';
import { ActivityFeed } from '@/components/assessment/ActivityFeed';
import { CheckCircle } from 'lucide-react';

interface AssessmentTabProps {
  events: AgentActivity[];
  isStreaming: boolean;
  isComplete: boolean;
}

export function AssessmentTab({ events, isStreaming, isComplete }: AssessmentTabProps) {
  if (events.length === 0 && !isStreaming) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <div className="text-center">
          <p className="text-lg font-medium">Assessment</p>
          <p className="text-sm mt-1">Available after ASSESS pipeline runs</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
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
    </div>
  );
}
