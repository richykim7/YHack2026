'use client';
import { useState, useCallback, useRef } from 'react';
import type { SSEEvent, AgentActivity, AgentStatus, SourceOption, ResponsePlan, LavaCostBreakdown, GapAnalysis, MonitorPost, MonitorClassification } from '@/lib/types';
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
    // Monitor events (Phase 12)
    case 'monitor_post': return `Scanning: ${event.post?.author || 'feed'}`;
    case 'monitor_classification': return event.classification?.relevant ? 'Relevant post detected' : 'Post classified as irrelevant';
    case 'crisis_detected': return 'CRISIS DETECTED -- Launching response pipeline';
    case 'orchestrator_start': return event.message || 'Starting crisis analysis...';
    case 'orchestrator_step': return event.message || `Running ${event.step}...`;
    case 'crisis_profile_ready': return 'Crisis profile assembled. Launching pipeline.';
    case 'plan_accepted': return 'Response plan accepted.';
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
    // Monitor events (Phase 12)
    monitor_post: 'monitor',
    monitor_classification: 'monitor',
    crisis_detected: 'monitor',
    orchestrator_start: 'orchestrator',
    orchestrator_step: 'orchestrator',
    crisis_profile_ready: 'orchestrator',
    plan_accepted: 'pipeline',
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
    // Monitor events (Phase 12)
    monitor_post: 'running',
    monitor_classification: 'running',
    crisis_detected: 'complete',
    orchestrator_start: 'running',
    orchestrator_step: 'running',
    crisis_profile_ready: 'complete',
    plan_accepted: 'complete',
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
  const [hexAssessUrl, setHexAssessUrl] = useState<string | null>(null);
  const [lavaCosts, setLavaCosts] = useState<LavaCostBreakdown | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);

  // Session ID (Phase 14)
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Pipeline duration (actual measured time from backend)
  const [pipelineDurationMs, setPipelineDurationMs] = useState<number | undefined>(undefined);

  // Monitor state (Phase 12)
  const [monitorPosts, setMonitorPosts] = useState<MonitorPost[]>([]);
  const [classifications, setClassifications] = useState<Map<string, MonitorClassification>>(new Map());
  const [crisisDetected, setCrisisDetected] = useState(false);
  const [monitorMode, setMonitorMode] = useState<'idle' | 'monitoring' | 'pipeline'>('idle');

  const launchAndStream = useCallback(
    async (sid: string, crisisProfile: Record<string, unknown>) => {
      setSessionId(sid);
      const sessionId = sid;
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
      setHexAssessUrl(null);
      setLavaCosts(null);
      setGapAnalysis(null);
      setPipelineDurationMs(undefined);

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
              if (event.type === 'hex_assess_ready' && event.run_url) {
                setHexAssessUrl(event.run_url);
              }
              if (event.type === 'hex_plans_ready' && event.run_url) {
                setHexPlansUrl(event.run_url);
              }
              if (event.type === 'assess_complete' && event.gap_analysis) {
                setGapAnalysis(event.gap_analysis);
              }
              if (event.type === 'lava_usage' && event.costs) {
                setLavaCosts(event.costs);
              }

              if (event.type === 'pipeline_complete' && event.pipeline_duration_ms) {
                setPipelineDurationMs(event.pipeline_duration_ms);
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

  const startMonitorAndStream = useCallback(async () => {
    // Generate session ID
    const sessionId = crypto.randomUUID();
    setSessionId(sessionId);

    // Reset all state
    setMonitorMode('monitoring');
    setMonitorPosts([]);
    setClassifications(new Map());
    setCrisisDetected(false);
    setEvents([]);
    setSources([]);
    setPlans([]);
    setHexPlansUrl(null);
    setHexAssessUrl(null);
    setLavaCosts(null);
    setGapAnalysis(null);
    setPipelineDurationMs(undefined);
    setIsStreaming(true);
    setIsComplete(false);

    // Step 1: POST to start monitor
    await postJSON('/api/monitor/start', { session_id: sessionId });

    // Step 2: Connect to monitor SSE stream (same ReadableStream pattern as launchAndStream)
    abortRef.current = new AbortController();

    try {
      const response = await fetch(
        `${API_BASE}/api/monitor/stream/${sessionId}`,
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

            // Monitor-specific event handling
            if (event.type === 'monitor_post' && event.post) {
              setMonitorPosts(prev => [...prev, event.post!]);
            }
            if (event.type === 'monitor_classification' && event.post_id && event.classification) {
              setClassifications(prev => {
                const next = new Map(prev);
                next.set(event.post_id!, event.classification!);
                return next;
              });
            }
            if (event.type === 'crisis_detected') {
              setCrisisDetected(true);
            }
            if (event.type === 'crisis_profile_ready') {
              setMonitorMode('pipeline');
            }

            // Extract rich data from pipeline events (same as launchAndStream)
            if (event.type === 'source_found' && event.source) {
              setSources(prev => [...prev, event.source!]);
            }
            if (event.type === 'discover_complete' && event.sources) {
              setSources(event.sources);
            }
            if (event.type === 'plans_ready' && event.plans) {
              setPlans(event.plans);
            }
            if (event.type === 'hex_assess_ready' && event.run_url) {
              setHexAssessUrl(event.run_url);
            }
            if (event.type === 'hex_plans_ready' && event.run_url) {
              setHexPlansUrl(event.run_url);
            }
            if (event.type === 'assess_complete' && event.gap_analysis) {
              setGapAnalysis(event.gap_analysis);
            }
            if (event.type === 'lava_usage' && event.costs) {
              setLavaCosts(event.costs);
            }

            // Add to activity feed
            setEvents(prev => [...prev, eventToActivity(event)]);

            if (event.type === 'pipeline_complete' && event.pipeline_duration_ms) {
              setPipelineDurationMs(event.pipeline_duration_ms);
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
        setEvents(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            agent: 'monitor',
            status: 'error',
            message: 'Connection to monitor lost.',
            timestamp: Date.now(),
          },
        ]);
        setIsComplete(true);
        setIsStreaming(false);
      }
    }
  }, []);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    events, isStreaming, isComplete, launchAndStream, stopStream,
    sources, plans, hexPlansUrl, hexAssessUrl, lavaCosts, gapAnalysis,
    // Session ID (Phase 14)
    sessionId,
    // Pipeline duration (actual measured time from backend)
    pipelineDurationMs,
    // Monitor state (Phase 12)
    monitorPosts, classifications, crisisDetected, monitorMode,
    startMonitorAndStream,
  };
}
