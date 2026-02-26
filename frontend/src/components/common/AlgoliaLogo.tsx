/**
 * Algolia Logo Component
 *
 * Official Algolia logo SVG for use in header and dashboard.
 */

interface AlgoliaLogoProps {
  size?: number;
  className?: string;
}

export function AlgoliaLogo({ size = 32, className = '' }: AlgoliaLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 2196 2500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M1044.7 0C468.1 0 0 468.1 0 1044.7v406.9c0 576.6 468.1 1044.7 1044.7 1044.7h406.9c576.6 0 1044.7-468.1 1044.7-1044.7V1044.7C2496.3 468.1 2028.2 0 1451.6 0H1044.7zm-17.5 544.8l423.7 167.5c34.8 13.8 52.2 52.5 38.7 86.3-12.5 31.6-47.3 48.5-79.6 38.7l-123.7-41.2c-7.5-2.5-15.3 2.8-15.3 10.6v665.4c0 36.3-29.4 65.7-65.7 65.7h-166.6c-36.3 0-65.7-29.4-65.7-65.7V619.7c0-52.2 45.7-92.3 97.2-84.1l-43 9.2z"
        fill="#5468FF"
      />
    </svg>
  );
}

// Simple icon version for small spaces
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
      <path
        d="M12 2C6.48 2 2 6.48 2 12v4.5c0 5.52 4.48 10 10 10h4.5c5.52 0 10-4.48 10-10V12c0-5.52-4.48-10-10-10H12zm-.2 6.5l4.8 1.9c.4.15.6.6.45 1-.15.35-.55.55-.9.45l-1.4-.5c-.1-.02-.2.03-.2.12v7.53c0 .4-.35.75-.75.75H12c-.4 0-.75-.35-.75-.75V9c0-.6.5-1.05 1.1-.95l-.55.45z"
        fill="#5468FF"
      />
    </svg>
  );
}

export default AlgoliaLogo;
