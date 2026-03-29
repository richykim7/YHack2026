'use client';
import { useState, useEffect } from 'react';
import { HEALTH_COLORS } from '@/lib/constants';
import { TrendingUp } from 'lucide-react';

interface NetworkHealthGaugeProps {
  currentScore: number;
  projectedScore: number;
}

export function NetworkHealthGauge({ currentScore, projectedScore }: NetworkHealthGaugeProps) {
  const [displayScore, setDisplayScore] = useState(currentScore);

  // Animate from current to projected after mount
  useEffect(() => {
    setDisplayScore(currentScore);
    const timer = setTimeout(() => {
      setDisplayScore(projectedScore);
    }, 300);
    return () => clearTimeout(timer);
  }, [currentScore, projectedScore]);

  const size = 100;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - displayScore);

  const color =
    displayScore >= 0.7
      ? HEALTH_COLORS.good
      : displayScore >= 0.5
        ? HEALTH_COLORS.warning
        : HEALTH_COLORS.critical;

  const delta = projectedScore - currentScore;
  const deltaText = delta > 0 ? `+${(delta * 100).toFixed(0)}%` : `${(delta * 100).toFixed(0)}%`;

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 rounded-xl p-4 flex flex-col items-center gap-2">
      <div className="text-[10px] font-display font-semibold text-slate-500 uppercase tracking-widest">
        Network Health
      </div>
      <div className="relative inline-flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#334155"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc with CSS transition */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s ease-in-out, stroke 0.5s ease' }}
          />
        </svg>
        <span
          className="absolute font-mono text-lg font-semibold tabular-nums"
          style={{ color, transition: 'color 0.5s ease' }}
        >
          {(displayScore * 100).toFixed(0)}
        </span>
      </div>
      {delta > 0 && (
        <div className="flex items-center gap-1 text-emerald-400">
          <TrendingUp size={12} />
          <span className="text-xs font-mono font-semibold tabular-nums">{deltaText}</span>
        </div>
      )}
      <div className="text-[10px] text-slate-500">
        Projected Improvement
      </div>
    </div>
  );
}
