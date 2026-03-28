export const PHILADELPHIA_BOUNDS: [[number, number], [number, number]] = [
  [-75.40, 39.84],
  [-74.95, 40.13],
];

export const HEALTH_THRESHOLDS = {
  good: 0.7,
  warning: 0.5,
} as const;

export const HEALTH_COLORS = {
  good: '#4ade80',
  warning: '#fbbf24',
  critical: '#f87171',
} as const;

export const NETWORK_NAME = 'Greater Philadelphia Food Bank Network';
