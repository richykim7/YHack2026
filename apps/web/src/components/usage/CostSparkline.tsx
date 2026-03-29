'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { AgentCost } from '@/lib/types';

const MODEL_COLORS: Record<string, string> = {
  'gemini-2.5-flash': '#4ade80',
  'gemini-2.5-pro': '#3b82f6',
  'gpt-4.1-mini': '#a78bfa',
};
const FALLBACK_COLOR = '#64748b';

/** Aggregate agent costs into per-model totals */
function aggregateByModel(costs: AgentCost[]) {
  const byModel: Record<string, { model: string; cost: number; tokens: number; requests: number }> = {};
  for (const c of costs) {
    const model = c.model || 'unknown';
    if (!byModel[model]) {
      byModel[model] = { model, cost: 0, tokens: 0, requests: 0 };
    }
    byModel[model].cost += c.cost;
    byModel[model].tokens += c.tokens;
    byModel[model].requests += c.requests;
  }
  return Object.values(byModel).sort((a, b) => b.cost - a.cost);
}

export function CostByModelChart({ costs }: { costs: AgentCost[] }) {
  const data = aggregateByModel(costs);

  if (data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <XAxis
          dataKey="model"
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
          {data.map((d) => (
            <Cell key={d.model} fill={MODEL_COLORS[d.model] || FALLBACK_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Keep old names as aliases for backward compatibility
export const CostBarChart = CostByModelChart;
export const CostSparkline = CostByModelChart;
