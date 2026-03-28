'use client';
import { useState, useCallback, useRef } from 'react';
import type { SSEEvent, AgentActivity, AgentStatus, SourceOption, ResponsePlan, LavaCostBreakdown } from '@/lib/types';
import { API_BASE, postJSON } from '@/lib/api';

function getDefaultMessage(event: SSEEvent): string {
  switch (event.type) {
    case 'scope_message': return event.content || '';
    case 'scope_complete': return 'Crisis profile confirmed.';
    case 'assess_start': return 'Starting gap analysis...';
    case 'assess_complete': return 'Gap analysis complete.';
    case 'hex_assess_ready': return 'Assessment dashboard ready.';
    case 'discover_start': return 'Searching for sourcing options...';
    case 'source_found': return `Found source: ${event.source?.supplier_name || 'unknown'}`;
    case 'discover_complete': return `Discovery complete. ${event.total_count || 0} sources found.`;
    case 'optimize_start': return 'Generating response plans...';
    case 'plans_ready': return `${event.plans?.length || 3} response plans ready.`;
    case 'hex_plans_ready': return 'Hex Plans dashboard ready.';
    case 'pipeline_complete': return 'Pipeline complete. Results ready.';
    case 'lava_usage': return `Pipeline cost: $${event.costs?.total_cost?.toFixed(4) || '0.00'}`;
    default: return '';
  }
}

function eventToActivity(event: SSEEvent): AgentActivity {
  // Map event types to agent names
  const agentMap: Record<string, string> = {
    agent_start: event.agent || 'pipeline',
    agent_end: event.agent || 'pipeline',
    scope_message: 'scope',
    scope_complete: 'scope',
    assess_start: 'assess',
    assess_complete: 'assess',
    hex_assess_ready: 'assess',
    discover_start: 'discover',
    source_found: 'discover',
    discover_complete: 'discover',
    optimize_start: 'optimize',
    plans_ready: 'optimize',
    hex_plans_ready: 'optimize',
    hex_run_started: event.agent || 'hex',
    hex_run_completed: event.agent || 'hex',
    pipeline_complete: 'pipeline',
    lava_usage: 'pipeline',
    complete: 'pipeline',
    error: event.agent || 'pipeline',
  };

  const statusMap: Record<string, AgentStatus> = {
    agent_start: 'running',
    agent_end: 'complete',
    scope_message: 'running',
    scope_complete: 'complete',
    assess_start: 'running',
    assess_complete: 'complete',
    hex_assess_ready: 'complete',
    discover_start: 'running',
    source_found: 'running',
    discover_complete: 'complete',
    optimize_start: 'running',
    plans_ready: 'complete',
    hex_plans_ready: 'complete',
    hex_run_started: 'running',
    hex_run_completed: 'complete',
    pipeline_complete: 'complete',
    lava_usage: 'complete',
    complete: 'complete',
    error: 'error',
  };

  return {
    id: crypto.randomUUID(),
    agent: agentMap[event.type] || 'pipeline',
    status: statusMap[event.type] || 'pending',
    message: event.message || getDefaultMessage(event),
    timestamp: event.timestamp * 1000, // Python sends seconds, JS expects ms
  };
}

export function useCrisisStream() {
  const [events, setEvents] = useState<AgentActivity[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Rich data state for Phase 6 consumption
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [plans, setPlans] = useState<ResponsePlan[]>([]);
  const [hexPlansUrl, setHexPlansUrl] = useState<string | null>(null);
  const [lavaCosts, setLavaCosts] = useState<LavaCostBreakdown | null>(null);

  const launchAndStream = useCallback(
    async (sessionId: string, crisisProfile: Record<string, unknown>) => {
      // Step 1: Launch pipeline via POST
      await postJSON('/api/crisis/launch', {
        session_id: sessionId,
        crisis_profile: crisisProfile,
      });

      // Step 2: Connect to SSE stream
      setIsStreaming(true);
      setIsComplete(false);
      setEvents([]);
      setSources([]);
      setPlans([]);
      setHexPlansUrl(null);
      setLavaCosts(null);

      abortRef.current = new AbortController();

      try {
        const response = await fetch(
          `${API_BASE}/api/crisis/stream/${sessionId}`,
          { signal: abortRef.current.signal },
        );

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              setEvents((prev) => [...prev, eventToActivity(event)]);

              // Extract rich data from specific event types
              if (event.type === 'source_found' && event.source) {
                setSources((prev) => [...prev, event.source!]);
              }
              if (event.type === 'discover_complete' && event.sources) {
                setSources(event.sources);
              }
              if (event.type === 'plans_ready' && event.plans) {
                setPlans(event.plans);
              }
              if (event.type === 'hex_plans_ready' && event.run_url) {
                setHexPlansUrl(event.run_url);
              }
              if (event.type === 'lava_usage' && event.costs) {
                setLavaCosts(event.costs);
              }

              if (event.type === 'complete' || event.type === 'pipeline_complete' || event.type === 'error') {
                setIsComplete(true);
                setIsStreaming(false);
              }
            } catch {
              /* skip malformed lines */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setEvents((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              agent: 'pipeline',
              status: 'error',
              message: 'Connection to pipeline lost.',
              timestamp: Date.now(),
            },
          ]);
          setIsComplete(true);
          setIsStreaming(false);
        }
      }
    },
    [],
  );

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { events, isStreaming, isComplete, launchAndStream, stopStream, sources, plans, hexPlansUrl, lavaCosts };
}
