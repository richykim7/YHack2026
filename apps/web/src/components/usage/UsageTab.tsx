'use client';
import { DollarSign } from 'lucide-react';
import { useLavaCosts } from '@/hooks/useLavaCosts';
import { CostDonut } from './CostDonut';
import { CostSparkline } from './CostSparkline';

export function UsageTab() {
  const { costs, totalCost, gateway, loading, error } = useLavaCosts();

  const totalRequests = costs.reduce((sum, c) => sum + c.requests, 0);

  // Format cost: use 4 decimal places for sub-penny, 2 otherwise
  const formattedCost = totalCost < 0.01 && totalCost > 0
    ? `$${totalCost.toFixed(4)}`
    : `$${totalCost.toFixed(2)}`;

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
      {/* Hero: Total Pipeline Cost */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
        <p className="text-xs font-display font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Total Pipeline Cost
        </p>
        <p className="text-4xl font-mono font-bold text-slate-100 tabular-nums">
          {formattedCost}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          across {totalRequests} agent request{totalRequests !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Charts: Donut + Sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
            Cost by Agent
          </h2>
          <CostDonut costs={costs} />
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h2 className="text-sm font-display font-bold text-slate-300 uppercase tracking-widest mb-3">
            Cumulative Cost
          </h2>
          <CostSparkline costs={costs} />
        </div>
      </div>

      {/* Agent Details Table */}
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
                <th className="text-xs text-slate-400 uppercase text-right py-2 px-4">Cost</th>
                <th className="text-xs text-slate-400 uppercase text-right py-2 px-4">Tokens</th>
                <th className="text-xs text-slate-400 uppercase text-right py-2 pl-4">Requests</th>
              </tr>
            </thead>
            <tbody>
              {costs.map((c) => (
                <tr key={c.agent} className="border-b border-slate-700/50">
                  <td className="text-sm text-slate-200 py-2 pr-4 capitalize">{c.agent}</td>
                  <td className="text-sm text-slate-200 tabular-nums text-right py-2 px-4">
                    ${c.cost.toFixed(4)}
                  </td>
                  <td className="text-sm text-slate-200 tabular-nums text-right py-2 px-4">
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
      </div>
    </div>
  );
}
