'use client';
import { useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { useLavaCosts } from '@/hooks/useLavaCosts';
import { CostByModelChart } from './CostSparkline';
import { ImpactHero } from './ImpactHero';
import { ModelBadge } from './ModelBadge';
import type { ResponsePlan, SourceOption } from '@/lib/types';

const AGENT_MODEL_MAP: Record<string, string> = {
  monitor: 'Gemini 2.5 Flash',
  scope: 'Gemini 2.5 Flash',
  assess: 'Gemini 2.5 Pro',
  researcher: 'Gemini 2.5 Pro',
  profiler: 'GPT-4.1-mini',
  optimize: 'Deterministic',
};

interface UsageTabProps {
  pipelineComplete?: boolean;
  plans?: ResponsePlan[];
  sources?: SourceOption[];
  pipelineDurationMs?: number;
}

export function UsageTab({ pipelineComplete = false, plans = [], sources = [], pipelineDurationMs }: UsageTabProps) {
  const { costs, totalCost, gateway, loading, error, refetch } = useLavaCosts();

  // Refetch costs when pipeline completes (3s delay for Lava API processing)
  useEffect(() => {
    if (pipelineComplete) {
      const timer = setTimeout(() => refetch(), 3000);
      return () => clearTimeout(timer);
    }
  }, [pipelineComplete, refetch]);

  const totalRequests = costs.reduce((sum, c) => sum + c.requests, 0);

  // Compute impact metrics from plans and sources
  const effectiveDurationMs = pipelineDurationMs ?? 45000; // Use actual duration, fallback to estimate
  const suppliersIdentified = new Set(
    plans.flatMap(p => p.line_items.map(li => li.supplier_name))
  ).size || sources.length;
  const categoriesCovered = new Set(
    plans.flatMap(p => p.line_items.map(li => li.food_category))
  ).size;

  // Before-pipeline state: no cost data yet
  if (!pipelineComplete && costs.length === 0 && !loading && gateway === 'lava') {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <DollarSign className="mx-auto mb-4 text-slate-600" size={48} />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">No Cost Data Yet</h2>
          <p className="text-sm text-slate-500">Run a crisis analysis from the Dashboard tab to see AI pipeline costs and impact metrics.</p>
        </div>
      </div>
    );
  }

  // No Lava gateway -- show message per D-11
  if (!loading && gateway !== 'lava' && costs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <DollarSign className="mx-auto mb-4 text-slate-500" size={48} />
          <h2 className="text-lg font-semibold text-slate-300 mb-2">
            Cost tracking available with Lava gateway
          </h2>
          <p className="text-sm text-slate-500">
            Connect Lava as your AI gateway to see per-agent cost breakdown
            and pipeline cost transparency.
          </p>
        </div>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center animate-pulse">
          <div className="h-3 w-32 bg-slate-700 rounded mx-auto mb-4" />
          <div className="h-10 w-24 bg-slate-700 rounded mx-auto mb-2" />
          <div className="h-3 w-40 bg-slate-700 rounded mx-auto" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 h-64 animate-pulse" />
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-sm text-red-400">Failed to load cost data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-4">
      {/* 1. Impact Hero Strip */}
      <ImpactHero
        pipelineDurationMs={effectiveDurationMs}
        suppliersIdentified={suppliersIdentified}
        categoriesCovered={categoriesCovered}
        totalCost={totalCost}
      />

      {/* 2. AI Models Used */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
          AI Models Used
        </h2>
        <div className="flex flex-wrap gap-2">
          <ModelBadge model="Gemini 2.5 Flash" />
          <ModelBadge model="Gemini 2.5 Pro" />
          <ModelBadge model="GPT-4.1-mini" />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Multi-provider pipeline via Lava Gateway for cost optimization and redundancy
        </p>
      </div>

      {/* 3. Cost per Model bar chart */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
          Cost per Model
        </h2>
        <CostByModelChart costs={costs} />
      </div>

      {/* 4. Agent Details Table with Model column */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
        <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
          Agent Details
        </h2>
        {costs.length === 0 ? (
          <p className="text-sm text-slate-500">No cost data available yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-xs text-slate-400 uppercase text-left py-2 pr-4">Agent</th>
                <th className="text-xs text-slate-400 uppercase text-left py-2 px-4">Model</th>
                <th className="text-xs text-slate-400 uppercase text-right py-2 px-4">Cost</th>
                <th className="text-xs text-slate-400 uppercase text-right py-2 px-4">Tokens</th>
                <th className="text-xs text-slate-400 uppercase text-right py-2 pl-4">Requests</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.agent} className="border-b border-slate-700/50">
                  <td className="text-sm text-slate-200 py-2 pr-4 capitalize">{c.agent}</td>
                  <td className="text-sm text-slate-300 py-2 px-4">
                    {c.model || AGENT_MODEL_MAP[c.agent] || 'Unknown'}
                  </td>
                  <td className="text-sm text-slate-200 tabular-nums text-right py-2 px-4">
                    ${c.cost.toFixed(4)}
                  </td>
                  <td className="text-sm text-slate-500 tabular-nums text-right py-2 px-4">
                    {c.tokens.toLocaleString()}
                  </td>
                  <td className="text-sm text-slate-200 tabular-nums text-right py-2 pl-4">
                    {c.requests}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-600 mt-3">
          {totalRequests} total request{totalRequests !== 1 ? 's' : ''} across all agents
        </p>
      </div>
    </div>
  );
}
