'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AgentCost } from '@/lib/types';

const COLORS = ['#3b82f6', '#fbbf24', '#4ade80', '#a78bfa', '#f87171', '#38bdf8'];

export function CostBarChart({ costs }: { costs: AgentCost[] }) {
  const data = costs.map(c => ({ agent: c.agent, cost: c.cost }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis
          dataKey="agent"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(3)}`}
        />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
          labelStyle={{ color: '#e2e8f0' }}
          formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost']}
        />
        <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Keep old name as alias for backward compatibility
export const CostSparkline = CostBarChart;
