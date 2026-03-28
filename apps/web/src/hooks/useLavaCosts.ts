'use client';
import { useState, useEffect, useCallback } from 'react';
import type { AgentCost } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface UseLavaCostsReturn {
  costs: AgentCost[];
  totalCost: number;
  gateway: string;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useLavaCosts(): UseLavaCostsReturn {
  const [costs, setCosts] = useState<AgentCost[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [gateway, setGateway] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/api/lava/costs`);
      const data = await resp.json();
      setCosts(data.costs || []);
      setTotalCost(data.total_cost || 0);
      setGateway(data.gateway || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch costs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  return { costs, totalCost, gateway, loading, error, refetch: fetchCosts };
}
