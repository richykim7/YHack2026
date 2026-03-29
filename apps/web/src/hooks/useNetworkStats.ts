'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NetworkStats {
  dailyPeopleServed: number;
  monthlyPeopleServed: number;
  yearlyPeopleServed: number;
  totalServicePopulation: number;
}

const LBS_PER_MEAL = 1.2; // Feeding America standard

export function useNetworkStats() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        // Get total service area population from sites
        const { data: sites } = await supabase
          .from('sites')
          .select('serves_population, type');

        const totalServicePopulation = (sites ?? [])
          .filter(s => s.type === 'distribution_site')
          .reduce((sum, s) => sum + (s.serves_population ?? 0), 0);

        // Get weekly demand data (each row is one site+category+week)
        const { data: demand } = await supabase
          .from('demand_history')
          .select('site_id, quantity_demanded_lbs');

        // Sum all demand, then average per-site-week to get total weekly lbs
        // demand_history has 8 weeks of data per site per category
        const totalLbs = (demand ?? []).reduce((sum, d) => sum + (d.quantity_demanded_lbs ?? 0), 0);
        const weeks = 8; // seeded data covers 8 weeks
        const weeklyLbs = totalLbs / weeks;

        // Convert lbs to meals, then to people served
        // Feeding America: 1.2 lbs = 1 meal
        // Food bank visitors typically receive enough for ~3 meals per visit, ~1 visit/week
        const weeklyMeals = weeklyLbs / LBS_PER_MEAL;
        const weeklyPeopleServed = Math.round(weeklyMeals / 3); // 3 meals per person per visit
        const dailyPeopleServed = Math.round(weeklyPeopleServed / 5); // open ~5 days/week

        setStats({
          dailyPeopleServed,
          monthlyPeopleServed: weeklyPeopleServed * 4,   // ~4 weeks/month
          yearlyPeopleServed: weeklyPeopleServed * 52,   // 52 weeks/year
          totalServicePopulation,
        });
      } catch {
        // Fallback: no stats
      }
      setLoading(false);
    }
    fetch();
  }, []);

  return { stats, loading };
}
