'use client';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import type { AgentCost } from '@/lib/types';

const AGENT_ORDER = ['scope', 'assess', 'discover', 'optimize'];

export function CostSparkline({ costs }: { costs: AgentCost[] }) {
  // Build cumulative cost data from agent costs in pipeline order
  let cumulative = 0;
  const data = [{ agent: 'start', cumCost: 0 }];
  for (const agentName of AGENT_ORDER) {
    const c = costs.find(item => item.agent === agentName);
    if (c) {
      cumulative += c.cost;
      data.push({ agent: agentName, cumCost: cumulative });
    }
  }
  // Add any agents not in standard order
  for (const c of costs) {
    if (!AGENT_ORDER.includes(c.agent)) {
      cumulative += c.cost;
      data.push({ agent: c.agent, cumCost: cumulative });
    }
  }

  if (data.length <= 1) return null;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data}>
        <XAxis dataKey="agent" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#334155" />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} stroke="#334155" tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
        <Tooltip
          formatter={(value) => `$${Number(value).toFixed(4)}`}
          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
          itemStyle={{ color: '#e2e8f0' }}
        />
        <Line type="monotone" dataKey="cumCost" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
