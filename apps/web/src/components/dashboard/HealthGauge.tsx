'use client';
import { HEALTH_COLORS } from '@/lib/constants';

interface HealthGaugeProps {
  score: number; // 0.0 to 1.0
  projectedScore?: number; // optional projected score shown as glow extension
  size?: number;
  strokeWidth?: number;
}

export function HealthGauge({ score, projectedScore, size = 120, strokeWidth = 8 }: HealthGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);

  const showProjection = projectedScore != null && projectedScore > score;
  const projectedOffset = showProjection ? circumference * (1 - projectedScore) : circumference;

  const color =
    score >= 0.7
      ? HEALTH_COLORS.good
      : score >= 0.5
        ? HEALTH_COLORS.warning
        : HEALTH_COLORS.critical;

  const projectedColor =
    projectedScore != null && projectedScore >= 0.7
      ? HEALTH_COLORS.good
      : projectedScore != null && projectedScore >= 0.5
        ? HEALTH_COLORS.warning
        : HEALTH_COLORS.critical;

  const filterId = `gauge-glow-${size}`;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {showProjection && (
          <defs>
            <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#334155"
          strokeWidth={strokeWidth}
        />
        {/* Projected arc — glowing extension beyond current score */}
        {showProjection && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={projectedColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={projectedOffset}
            strokeLinecap="round"
            opacity={0.3}
            filter={`url(#${filterId})`}
            className="transition-all duration-1000"
          />
        )}
        {/* Current score arc (solid) */}
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
      {/* Score label — show delta when projected */}
      <div className="absolute flex flex-col items-center leading-none">
        <span
          className="font-mono text-lg font-semibold tabular-nums"
          style={{ color }}
        >
          {(score * 100).toFixed(0)}
        </span>
        {showProjection && (
          <span
            className="font-mono text-[9px] font-medium tabular-nums animate-pulse"
            style={{ color: projectedColor }}
          >
            +{((projectedScore - score) * 100).toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}
