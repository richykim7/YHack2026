'use client';

interface FoodChainLogoProps {
  size?: number;
}

export function FoodChainLogo({ size = 28 }: FoodChainLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left chain link */}
      <rect
        x="2"
        y="8"
        width="16"
        height="16"
        rx="5"
        stroke="#60a5fa"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Right chain link */}
      <rect
        x="14"
        y="8"
        width="16"
        height="16"
        rx="5"
        stroke="#60a5fa"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Leaf/sprout inside left link */}
      <path
        d="M10 20 C10 15, 14 13, 14 13 C14 13, 10 15, 8 13 C6 11, 10 10, 10 10 C10 10, 6 14, 10 20Z"
        fill="#4ade80"
      />
      {/* Leaf stem */}
      <line
        x1="10"
        y1="20"
        x2="10"
        y2="22"
        stroke="#4ade80"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
