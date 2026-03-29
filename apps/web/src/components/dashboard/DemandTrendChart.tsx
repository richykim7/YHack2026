'use client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useDemandHistory } from '@/hooks/useDemandHistory';

const CATEGORY_COLORS: Record<string, string> = {
  protein: '#f87171',
  grains: '#fbbf24',
  dairy: '#60a5fa',
  produce: '#4ade80',
  canned: '#a78bfa',
  beverages: '#f472b6',
};

export function DemandTrendChart() {
  const { chartData, loading } = useDemandHistory();

  if (loading) {
    return (
      <div className="h-[250px] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[250px] flex items-center justify-center text-sm text-slate-500">
        No demand history data available.
      </div>
    );
  }

  // Extract category keys from data (exclude 'week')
  const categories = Object.keys(chartData[0]).filter(k => k !== 'week');

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <XAxis
          dataKey="week"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
          width={45}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
          }}
          itemStyle={{ color: '#e2e8f0' }}
          labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${(Number(value) / 1000).toFixed(1)}k lbs`]}
        />
        <Legend
          formatter={(value: string) => (
            <span style={{ color: '#cbd5e1', fontSize: '12px', textTransform: 'capitalize' }}>{value}</span>
          )}
        />
        {categories.map(cat => (
          <Line
            key={cat}
            type="monotone"
            dataKey={cat}
            stroke={CATEGORY_COLORS[cat] || '#64748b'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CATEGORY_COLORS[cat] || '#64748b' }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
