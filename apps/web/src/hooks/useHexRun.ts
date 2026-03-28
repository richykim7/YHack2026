'use client';
import { useState, useCallback } from 'react';
import type { HexRunStatus } from '@/lib/types';

interface UseHexRunReturn {
  hexRun: HexRunStatus | null;
  isLoading: boolean;
  isError: boolean;
  setHexRun: (run: HexRunStatus | null) => void;
  markCompleted: (runUrl: string) => void;
  markError: () => void;
}

export function useHexRun(): UseHexRunReturn {
  const [hexRun, setHexRun] = useState<HexRunStatus | null>(null);
  const isLoading = hexRun !== null && (hexRun.status === 'PENDING' || hexRun.status === 'RUNNING');
  const isError = hexRun !== null && ['ERRORED', 'KILLED', 'TIMEOUT'].includes(hexRun.status);

  const markCompleted = useCallback((runUrl: string) => {
    setHexRun(prev => prev ? { ...prev, status: 'COMPLETED', run_url: runUrl } : null);
  }, []);

  const markError = useCallback(() => {
    setHexRun(prev => prev ? { ...prev, status: 'ERRORED' } : null);
  }, []);

  return { hexRun, isLoading, isError, setHexRun, markCompleted, markError };
}
