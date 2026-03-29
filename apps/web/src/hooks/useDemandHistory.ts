'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useDemandHistory() {
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('demand_history')
        .select('week_start, food_category, quantity_demanded_lbs')
        .order('week_start');

      if (!data || data.length === 0) { setLoading(false); return; }

      const byWeek = new Map<string, Record<string, number>>();
      for (const row of data as { week_start: string; food_category: string; quantity_demanded_lbs: number }[]) {
        const w = row.week_start;
        const existing = byWeek.get(w) || {};
        existing[row.food_category] = (existing[row.food_category] || 0) + row.quantity_demanded_lbs;
        byWeek.set(w, existing);
      }

      setChartData(
        Array.from(byWeek.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([week, cats]) => ({ week: week.slice(5), ...cats }))
      );
      setLoading(false);
    }
    fetchData();
  }, []);

  return { chartData, loading };
}
