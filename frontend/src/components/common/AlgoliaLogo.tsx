/**
 * Algolia Logo Component
 *
 * Official Algolia brand mark.
 * Brand colors: Nebula Blue #003DFF, Accent Purple #5468FF
 */

interface AlgoliaLogoProps {
  size?: number;
  className?: string;
}

// Official Algolia logo mark - the "A" with magnifying glass
export function AlgoliaLogo({ size = 32, className = '' }: AlgoliaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 2500 2500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="algolia-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#003DFF" />
          <stop offset="100%" stopColor="#5468FF" />
        </linearGradient>
      </defs>
      {/* Rounded square background */}
      <rect width="2500" height="2500" rx="500" fill="url(#algolia-gradient)" />
      {/* Algolia "A" mark */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1250 500C665.48 500 192 973.48 192 1558C192 2142.52 665.48 2616 1250 2616C1834.52 2616 2308 2142.52 2308 1558C2308 973.48 1834.52 500 1250 500ZM1250 708C777.16 708 400 1085.16 400 1558C400 2030.84 777.16 2408 1250 2408C1722.84 2408 2100 2030.84 2100 1558C2100 1085.16 1722.84 708 1250 708Z"
        fill="white"
      />
      <circle cx="1250" cy="1558" r="250" fill="white" />
      {/* Search handle */}
      <rect
        x="1580"
        y="1750"
        width="120"
        height="500"
        rx="60"
        transform="rotate(45 1580 1750)"
        fill="white"
      />
    </svg>
  );
}

// Compact version for tight spaces
export function AlgoliaIcon({ size = 20, className = '' }: AlgoliaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="24" height="24" rx="4" fill="#5468FF" />
      <circle cx="10" cy="10" r="5" stroke="white" strokeWidth="2" fill="none" />
      <circle cx="10" cy="10" r="1.5" fill="white" />
      <line x1="14" y1="14" x2="18" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default AlgoliaLogo;
