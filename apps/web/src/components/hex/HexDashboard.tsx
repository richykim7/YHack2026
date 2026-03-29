'use client';
import type { ReactNode } from 'react';
import { HexSkeleton } from './HexSkeleton';

interface HexDashboardProps {
  title: string;
  runUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  fallback?: ReactNode;
  height?: number;
}

export function HexDashboard({
  title,
  runUrl,
  isLoading,
  isError,
  fallback,
  height = 800,
}: HexDashboardProps) {
  // Loading state: show skeleton
  if (isLoading && !runUrl) {
    return <HexSkeleton label={`${title}...`} height={height} />;
  }

  // Error or no URL after loading: show fallback
  if (isError || (!isLoading && !runUrl)) {
    return (
      <>
        {fallback ?? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-5 text-sm text-slate-400">
            Hex visualization unavailable — showing local analysis.
          </div>
        )}
      </>
    );
  }

  // Ready state: show iframe
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between border-b border-slate-700">
        <span className="text-sm font-medium text-slate-100">{title}</span>
        <span className="text-xs text-slate-400">Powered by Hex</span>
      </div>
      <iframe
        src={runUrl!}
        width="100%"
        height={height}
        sandbox="allow-scripts allow-same-origin"
        style={{ border: 'none' }}
        title={title}
      />
    </div>
  );
}
