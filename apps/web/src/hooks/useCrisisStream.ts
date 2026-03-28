'use client';
import { useState, useCallback, useRef } from 'react';
import type { SSEEvent, AgentActivity } from '@/lib/types';
import { API_BASE, postJSON } from '@/lib/api';

function eventToActivity(event: SSEEvent): AgentActivity {
  return {
    id: crypto.randomUUID(),
    agent: event.agent || 'pipeline',
    status:
      event.type === 'agent_start'
        ? 'running'
        : event.type === 'agent_end'
          ? 'complete'
          : event.type === 'error'
            ? 'error'
            : event.type === 'complete'
              ? 'complete'
              : 'pending',
    message: event.message,
    timestamp: event.timestamp * 1000, // Python sends seconds, JS expects ms
  };
}

export function useCrisisStream() {
  const [events, setEvents] = useState<AgentActivity[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

              if (event.type === 'complete' || event.type === 'error') {
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

  return { events, isStreaming, isComplete, launchAndStream, stopStream };
}
