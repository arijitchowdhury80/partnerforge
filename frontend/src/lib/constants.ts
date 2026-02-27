/**
 * Shared Constants - Single Source of Truth
 *
 * All status definitions, colors, and display values live here.
 * Import this everywhere instead of defining inline.
 */

// =============================================================================
// Status Definitions - THE canonical order is Hot → Warm → Cold
// =============================================================================

export type StatusKey = 'hot' | 'warm' | 'cold';

export interface StatusDefinition {
  key: StatusKey;
  label: string;
  color: string;        // Mantine color name for Badge/Button
  bgColor: string;      // Hex for custom styling
  textColor: string;    // Text color on the background
  icon: string;         // Icon name (for reference)
  description: string;  // Tooltip/help text
  scoreRange: [number, number]; // ICP score range [min, max]
}

// THE single source of truth for status - always in this order
// Thresholds: 70+ = Hot, 40-69 = Warm, 0-39 = Cold (matches composite scoring)
export const STATUSES: StatusDefinition[] = [
  {
    key: 'hot',
    label: 'Hot',
    color: 'red',
    bgColor: '#dc2626',
    textColor: '#ffffff',
    icon: 'flame',
    description: 'Ready for outreach',
    scoreRange: [70, 100],
  },
  {
    key: 'warm',
    label: 'Warm',
    color: 'orange',
    bgColor: '#ea580c',
    textColor: '#ffffff',
    icon: 'trending-up',
    description: 'Nurture pipeline',
    scoreRange: [40, 69],
  },
  {
    key: 'cold',
    label: 'Cold',
    color: 'gray',
    bgColor: '#64748b',
    textColor: '#ffffff',
    icon: 'snowflake',
    description: 'Low priority',
    scoreRange: [0, 39],
  },
];

// Quick lookup map
export const STATUS_MAP: Record<StatusKey, StatusDefinition> = {
  hot: STATUSES[0],
  warm: STATUSES[1],
  cold: STATUSES[2],
};

// Get status from ICP/composite score
// Thresholds: 70+ = Hot, 40-69 = Warm, 0-39 = Cold
export function getStatusFromScore(score: number): StatusKey {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// Get status definition from ICP score
export function getStatusDefinitionFromScore(score: number): StatusDefinition {
  return STATUS_MAP[getStatusFromScore(score)];
}

// =============================================================================
// Algolia Brand Colors - Single source of truth
// =============================================================================

export const COLORS = {
  // Primary brand colors
  ALGOLIA_NEBULA_BLUE: '#003DFF',
  ALGOLIA_SPACE_GRAY: '#21243D',
  ALGOLIA_PURPLE: '#5468FF',
  ALGOLIA_WHITE: '#FFFFFF',
  ALGOLIA_LIGHT_GRAY: '#F5F5F7',
  ALGOLIA_BORDER: '#E8E8ED',

  // Grayscale palette
  GRAY_50: '#f8fafc',
  GRAY_100: '#f1f5f9',
  GRAY_200: '#e2e8f0',
  GRAY_300: '#cbd5e1',
  GRAY_400: '#94a3b8',
  GRAY_500: '#64748b',
  GRAY_600: '#475569',
  GRAY_700: '#334155',
  GRAY_800: '#1e293b',
  GRAY_900: '#0f172a',
} as const;

// =============================================================================
// Verticals - Single source of truth
// =============================================================================

export const VERTICALS = [
  'Retail',
  'Finance',
  'Media',
  'Technology',
  'Healthcare',
  'Manufacturing',
  'Other',
] as const;

export type VerticalKey = typeof VERTICALS[number];

// =============================================================================
// ICP Tiers - Single source of truth
// =============================================================================

export interface IcpTierDefinition {
  key: StatusKey;
  label: string;
  min: number;
  max: number;
  color: string;
}

// ICP Tiers map to status - they're the same thing
export const ICP_TIERS: IcpTierDefinition[] = STATUSES.map(s => ({
  key: s.key,
  label: `${s.label} (${s.scoreRange[0]}-${s.scoreRange[1]})`,
  min: s.scoreRange[0],
  max: s.scoreRange[1],
  color: s.bgColor,
}));
