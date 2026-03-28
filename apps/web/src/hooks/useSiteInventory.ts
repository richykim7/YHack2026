'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { FoodCategory } from '@/lib/types';

export interface SiteCategoryTotal {
  category: FoodCategory;
  totalLbs: number;
}

export function useSiteInventory(siteId: string | null) {
  const [categoryTotals, setCategoryTotals] = useState<SiteCategoryTotal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setCategoryTotals([]);
      return;
    }

    setLoading(true);
    async function fetchInventory() {
      const { data, error: err } = await supabase
        .from('inventory')
        .select('food_category, quantity_lbs')
        .eq('site_id', siteId)
        .eq('status', 'available');

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      // Group by food_category and sum quantity_lbs
      const sums: Record<string, number> = {};
      for (const row of data ?? []) {
        sums[row.food_category] = (sums[row.food_category] || 0) + row.quantity_lbs;
      }

      const result: SiteCategoryTotal[] = Object.entries(sums).map(([cat, total]) => ({
        category: cat as FoodCategory,
        totalLbs: total,
      }));

      setCategoryTotals(result);
      setLoading(false);
    }
    fetchInventory();
  }, [siteId]);

  return { categoryTotals, loading, error };
}
