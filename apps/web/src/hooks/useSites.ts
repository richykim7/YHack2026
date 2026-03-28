'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Site } from '@/lib/types';

export function useSites() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSites() {
      const { data, error: err } = await supabase
        .from('sites')
        .select('*')
        .order('name');
      if (err) {
        setError(err.message);
      } else {
        setSites(data ?? []);
      }
      setLoading(false);
    }
    fetchSites();
  }, []);

  return { sites, loading, error };
}
