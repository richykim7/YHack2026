'use client';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { AgentCost } from '@/lib/types';

const AGENT_COLORS: Record<string, string> = {
  scope: '#3b82f6',
  assess: '#fbbf24',
  discover: '#4ade80',
  optimize: '#a78bfa',
  unknown: '#64748b',
};

export function CostDonut({ costs }: { costs: AgentCost[] }) {
  const data = costs.map(c => ({ name: c.agent, value: c.cost }));

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} innerRadius={55} outerRadius={85} dataKey="value" nameKey="name" paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={AGENT_COLORS[entry.name] || AGENT_COLORS.unknown} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => `$${Number(value).toFixed(4)}`}
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Legend
          formatter={(value: string) => <span className="text-sm text-slate-300 capitalize">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
