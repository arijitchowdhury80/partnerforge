/**
 * Algolia Logo Component
 *
 * Official Algolia logo mark for use in header and dashboard.
 * Brand colors: Nebula Blue #003DFF, Accent Purple #5468FF
 */

interface AlgoliaLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

// Official Algolia mark (the distinctive "A" symbol)
export function AlgoliaLogo({ size = 32, className = '', color = '#5468FF' }: AlgoliaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Rounded square background */}
      <rect width="40" height="40" rx="8" fill={color} />
      {/* Algolia mark - stylized search/A shape */}
      <path
        d="M20.155 7.333c-7.033 0-12.733 5.7-12.733 12.734 0 7.033 5.7 12.733 12.733 12.733 7.034 0 12.734-5.7 12.734-12.733 0-7.034-5.7-12.734-12.734-12.734zm0 3.2a9.48 9.48 0 0 1 6.6 2.667l-2.267 2.267a6.39 6.39 0 0 0-4.333-1.667 6.467 6.467 0 1 0 4.6 11l2.2 2.2a9.533 9.533 0 1 1-6.8-16.467z"
        fill="white"
      />
      <circle cx="20" cy="20" r="3" fill="white" />
    </svg>
  );
}

// Alternative: Just the mark without background (for use on colored backgrounds)
export function AlgoliaMarkOnly({ size = 24, className = '', color = '#5468FF' }: AlgoliaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c2.03 0 3.88.78 5.27 2.05l-1.42 1.42A5.96 5.96 0 0 0 12 6a6 6 0 1 0 4.24 10.24l1.42 1.42A7.96 7.96 0 0 1 12 20a8 8 0 1 1 0-16z"
        fill={color}
      />
      <circle cx="12" cy="12" r="2" fill={color} />
    </svg>
  );
}

// Text logo with mark
export function AlgoliaLogoWithText({ height = 24, className = '' }: { height?: number; className?: string }) {
  const width = height * 4; // Approximate aspect ratio
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mark */}
      <rect width="30" height="30" rx="6" fill="#5468FF" />
      <path
        d="M15 5c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10S20.52 5 15 5zm0 2.5c1.9 0 3.62.73 4.93 1.93l-1.77 1.77A4.46 4.46 0 0 0 15 10a5 5 0 1 0 3.53 8.53l1.77 1.77A7.47 7.47 0 0 1 15 22.5a7.5 7.5 0 1 1 0-15z"
        fill="white"
      />
      <circle cx="15" cy="15" r="2.25" fill="white" />
      {/* Text: algolia */}
      <text x="38" y="21" fontFamily="Source Sans Pro, sans-serif" fontSize="16" fontWeight="600" fill="white">
        algolia
      </text>
    </svg>
  );
}

export default AlgoliaLogo;
