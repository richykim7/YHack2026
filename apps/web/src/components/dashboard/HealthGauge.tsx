'use client';
import { HEALTH_COLORS } from '@/lib/constants';

interface HealthGaugeProps {
  score: number; // 0.0 to 1.0
  size?: number;
  strokeWidth?: number;
}

export function HealthGauge({ score, size = 120, strokeWidth = 8 }: HealthGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);

  const color =
    score >= 0.7
      ? HEALTH_COLORS.good
      : score >= 0.5
        ? HEALTH_COLORS.warning
        : HEALTH_COLORS.critical;

  return (
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
        {/* Progress arc */}
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
          className="transition-all duration-700"
        />
      </svg>
      <span
        className="absolute font-mono text-lg font-semibold tabular-nums"
        style={{ color }}
      >
        {(score * 100).toFixed(0)}
      </span>
    </div>
  );
}
