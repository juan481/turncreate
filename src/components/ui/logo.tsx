export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 40"
      fill="none"
      className={className}
      role="img"
      aria-label="TurnCreate"
    >
      <g transform="translate(4, 4)">
        <rect width="32" height="32" rx="10" fill="#121217" />
        <circle
          cx="16"
          cy="16"
          r="6"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeDasharray="4 2"
        />
        <circle cx="16" cy="16" r="2.5" fill="#C4B5FD" />
        <path
          d="M16 6V10M16 22V26M6 16H10M22 16H26"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <text
        x="44"
        y="26"
        fontFamily="'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize="20"
        fontWeight="700"
        fill="#121217"
        letterSpacing="-0.5"
      >
        Turn
        <tspan fill="#7C3AED">Create</tspan>
      </text>
    </svg>
  );
}
