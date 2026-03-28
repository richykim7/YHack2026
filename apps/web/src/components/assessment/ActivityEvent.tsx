import type { AgentActivity } from '@/lib/types';

const STATUS_STYLES = {
  running: {
    dot: 'bg-blue-400',
    pill: 'bg-blue-500/20 text-blue-400 animate-pulse',
    label: 'Running',
  },
  complete: {
    dot: 'bg-emerald-400',
    pill: 'bg-emerald-500/20 text-emerald-400',
    label: 'Complete',
  },
  error: {
    dot: 'bg-red-400',
    pill: 'bg-red-500/20 text-red-400',
    label: 'Error',
  },
  pending: {
    dot: 'bg-slate-600',
    pill: 'bg-slate-600 text-slate-300',
    label: 'Pending',
  },
} as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface ActivityEventProps {
  activity: AgentActivity;
}

export function ActivityEvent({ activity }: ActivityEventProps) {
  const style = STATUS_STYLES[activity.status];

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-800/50">
      {/* Status dot */}
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />

      {/* Agent name */}
      <span className="text-sm text-slate-200 font-medium uppercase">
        {activity.agent}
      </span>

      {/* Status pill */}
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${style.pill}`}
      >
        {style.label}
      </span>

      {/* Message */}
      {activity.message && (
        <span className="text-xs text-slate-400 truncate">
          {activity.message}
        </span>
      )}

      {/* Timestamp */}
      <span className="text-xs text-slate-500 ml-auto shrink-0">
        {formatTime(activity.timestamp)}
      </span>
    </div>
  );
}
