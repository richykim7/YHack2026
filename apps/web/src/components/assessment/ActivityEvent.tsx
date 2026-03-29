'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, Globe } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLES[activity.status];
  const hasLlm = !!activity.llmDetail;
  const hasApi = !!activity.apiDetail;
  const hasDetail = hasLlm || hasApi;

  // Color scheme: amber for LLM, cyan for API calls
  const accentColor = hasLlm ? 'amber' : hasApi ? 'cyan' : null;

  return (
    <div className={`rounded-lg ${hasDetail ? `bg-slate-800/70 border border-slate-700/50` : 'bg-slate-800/50'}`}>
      {/* Header row */}
      <div
        className={`flex items-center gap-3 py-2 px-3 ${hasDetail ? 'cursor-pointer hover:bg-slate-700/30 rounded-lg transition-colors' : ''}`}
        onClick={hasDetail ? () => setExpanded(!expanded) : undefined}
      >
        {/* Expand indicator for auditable calls */}
        {hasDetail ? (
          <span className={`${accentColor === 'amber' ? 'text-amber-400' : 'text-cyan-400'} shrink-0`}>
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${style.dot}`} />
        )}

        {/* Icon: CPU for LLM, Globe for API */}
        {hasLlm && <Cpu size={14} className="text-amber-400 shrink-0" />}
        {hasApi && <Globe size={14} className="text-cyan-400 shrink-0" />}

        {/* Agent name */}
        <span className={`text-sm font-medium uppercase ${
          hasLlm ? 'text-amber-300' : hasApi ? 'text-cyan-300' : 'text-slate-200'
        }`}>
          {activity.agent}
        </span>

        {/* Service/model badge */}
        {hasLlm && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono">
            {activity.llmDetail!.model}
          </span>
        )}
        {hasApi && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-mono">
            {activity.apiDetail!.service}
          </span>
        )}

        {/* Duration pill */}
        {hasLlm && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            {activity.llmDetail!.durationMs}ms
          </span>
        )}
        {hasApi && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400">
            {activity.apiDetail!.resultCount} results / {activity.apiDetail!.durationMs}ms
          </span>
        )}

        {/* Status pill for non-detail events */}
        {!hasDetail && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${style.pill}`}>
            {style.label}
          </span>
        )}

        {/* Message for non-detail events */}
        {activity.message && !hasDetail && (
          <span className="text-xs text-slate-400 truncate">
            {activity.message}
          </span>
        )}

        {/* Timestamp */}
        <span className="text-xs text-slate-500 ml-auto shrink-0">
          {formatTime(activity.timestamp)}
        </span>
      </div>

      {/* Expanded LLM detail panel */}
      {expanded && hasLlm && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 mt-1 pt-3">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prompt</span>
            <pre className="mt-1 text-xs text-slate-300 bg-slate-900/80 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono leading-relaxed">
              {activity.llmDetail!.promptText || '(no prompt captured)'}
            </pre>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response</span>
            <pre className="mt-1 text-xs text-emerald-300 bg-slate-900/80 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
              {activity.llmDetail!.responseText || '(no response captured)'}
            </pre>
          </div>
          {activity.llmDetail!.toolArgs && (
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tool Call Args</span>
              <pre className="mt-1 text-xs text-blue-300 bg-slate-900/80 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto font-mono leading-relaxed">
                {JSON.stringify(activity.llmDetail!.toolArgs, null, 2)}
              </pre>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-700/30">
            <span>Model: <span className="text-slate-300 font-mono">{activity.llmDetail!.model}</span></span>
            <span>Duration: <span className="text-slate-300">{activity.llmDetail!.durationMs}ms</span></span>
            {(activity.llmDetail!.inputTokens > 0 || activity.llmDetail!.outputTokens > 0) && (
              <span>Tokens: <span className="text-slate-300">{activity.llmDetail!.inputTokens} in / {activity.llmDetail!.outputTokens} out</span></span>
            )}
          </div>
        </div>
      )}

      {/* Expanded API call detail panel */}
      {expanded && hasApi && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-700/50 mt-1 pt-3">
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Request</span>
            <pre className="mt-1 text-xs text-slate-300 bg-slate-900/80 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto font-mono leading-relaxed">
              {activity.apiDetail!.requestSummary || '(no request captured)'}
            </pre>
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response ({activity.apiDetail!.resultCount} results)</span>
            <pre className="mt-1 text-xs text-cyan-300 bg-slate-900/80 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
              {activity.apiDetail!.responseSummary || '(no response captured)'}
            </pre>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-700/30">
            <span>Service: <span className="text-slate-300 font-mono">{activity.apiDetail!.service}</span></span>
            <span>Duration: <span className="text-slate-300">{activity.apiDetail!.durationMs}ms</span></span>
            <span>Results: <span className="text-slate-300">{activity.apiDetail!.resultCount}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
