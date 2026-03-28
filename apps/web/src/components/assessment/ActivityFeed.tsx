import type { AgentActivity } from '@/lib/types';
import { ActivityEvent } from './ActivityEvent';

interface ActivityFeedProps {
  events: AgentActivity[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <p className="text-sm">Waiting for pipeline...</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="border-l-2 border-slate-700 ml-[7px] space-y-1 pl-4">
        {events.map((event) => (
          <ActivityEvent key={event.id} activity={event} />
        ))}
      </div>
    </div>
  );
}
