/**
 * Bountyhood brand mark — Robin Hood's arrow through the bounty target.
 * Inlined SVG so it scales crisply at any size with no extra request.
 * Same artwork as app/icon.svg (favicon); keep the two in sync.
 */
export function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient
          id="bh-lime"
          gradientUnits="userSpaceOnUse"
          x1="40"
          y1="160"
          x2="220"
          y2="96"
        >
          <stop offset="0" stopColor="#84cc16" />
          <stop offset="1" stopColor="#bef264" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="256" height="256" rx="56" fill="#0d0e12" />
      <rect
        x="1.5"
        y="1.5"
        width="253"
        height="253"
        rx="54.5"
        fill="none"
        stroke="#2a2e3a"
        strokeWidth="3"
      />
      <circle
        cx="128"
        cy="128"
        r="84"
        fill="none"
        stroke="#a3e635"
        strokeOpacity="0.38"
        strokeWidth="8"
      />
      <circle
        cx="128"
        cy="128"
        r="48"
        fill="none"
        stroke="#a3e635"
        strokeOpacity="0.2"
        strokeWidth="8"
      />
      <g transform="rotate(-45 128 128)">
        <line
          x1="58"
          y1="128"
          x2="168"
          y2="128"
          stroke="url(#bh-lime)"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path d="M 158 94 L 226 128 L 158 162 L 172 128 Z" fill="url(#bh-lime)" />
        <line
          x1="82"
          y1="126"
          x2="54"
          y2="96"
          stroke="url(#bh-lime)"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <line
          x1="82"
          y1="130"
          x2="54"
          y2="160"
          stroke="url(#bh-lime)"
          strokeWidth="15"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
