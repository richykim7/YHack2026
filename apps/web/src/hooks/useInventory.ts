'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { FoodCategory } from '@/lib/types';
import { FOOD_CATEGORIES } from '@/lib/types';

export interface CategoryTotal {
  category: FoodCategory;
  currentLbs: number;
  targetLbs: number;
}

// 2-week supply targets per category (rough estimates for demo)
const NETWORK_TARGET_LBS: Record<FoodCategory, number> = {
  protein: 8000,
  grains: 10000,
  dairy: 6000,
  produce: 7000,
  canned: 9000,
  beverages: 5000,
};

export function useInventory(siteId?: string | null) {
  const [totals, setTotals] = useState<CategoryTotal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    async function fetchInventory() {
      // Build query -- filter by site_id if provided, otherwise network-wide
      let query = supabase
        .from('inventory')
        .select('food_category, quantity_lbs')
        .eq('status', 'available');

      if (siteId) {
        query = query.eq('site_id', siteId);
      }

      const { data, error: err } = await query;

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      // Aggregate by category
      const sums: Record<string, number> = {};
      for (const row of data ?? []) {
        sums[row.food_category] = (sums[row.food_category] || 0) + row.quantity_lbs;
      }

      // When filtering by site, use 1/8th of network target (8 sites)
      const targetScale = siteId ? 1 / 8 : 1;

      const result: CategoryTotal[] = FOOD_CATEGORIES.map((cat) => ({
        category: cat,
        currentLbs: sums[cat] || 0,
        targetLbs: Math.round(NETWORK_TARGET_LBS[cat] * targetScale),
      }));

      setTotals(result);
      setLoading(false);
    }
    fetchInventory();
  }, [siteId]);

  return { totals, loading, error };
}
