'use client';
import { useState, useEffect } from 'react';

interface HexSkeletonProps {
  label?: string;
  height?: number;
}

export function HexSkeleton({ label = 'ASSESS running...', height = 400 }: HexSkeletonProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden" style={{ height }}>
      <div className="h-full animate-pulse bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>
        <div className="text-xs text-slate-500 tabular-nums">{elapsed}s elapsed</div>
        <div className="w-48 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500/50 rounded-full animate-[shimmer_2s_ease-in-out_infinite]"
               style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
