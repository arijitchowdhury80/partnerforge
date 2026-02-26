/**
 * PartnerForge Color System
 *
 * Single source of truth for all colors in the application.
 * Uses Algolia brand colors as foundation with enterprise-grade contrast.
 *
 * RULE: All text must have 4.5:1 contrast ratio minimum (WCAG AA)
 */

// =============================================================================
// ALGOLIA BRAND COLORS
// =============================================================================

export const ALGOLIA = {
  // Primary
  NEBULA_BLUE: '#003DFF',    // Primary CTAs, links, active states
  PURPLE: '#5468FF',         // Accents, highlights

  // Neutrals
  SPACE_GRAY: '#21243D',     // Primary text, headings
  WHITE: '#FFFFFF',          // Backgrounds
  LIGHT_GRAY: '#F5F5F7',     // Alternate section backgrounds
  BORDER: '#E8E8ED',         // Borders, dividers
} as const;

// =============================================================================
// SEMANTIC COLORS
// =============================================================================

export const COLORS = {
  // Text - Always readable on white background
  text: {
    primary: '#1e293b',      // slate-800 - Main text
    secondary: '#475569',    // slate-600 - Secondary text
    muted: '#64748b',        // slate-500 - Muted/helper text
    disabled: '#94a3b8',     // slate-400 - Disabled text
    inverse: '#ffffff',      // White text on dark backgrounds
  },

  // Backgrounds
  bg: {
    page: '#ffffff',         // Main page background
    card: '#ffffff',         // Card backgrounds
    hover: '#f8fafc',        // slate-50 - Hover states
    active: '#f1f5f9',       // slate-100 - Active/selected states
    muted: '#f8fafc',        // Muted sections
  },

  // Borders
  border: {
    default: '#e2e8f0',      // slate-200 - Default borders
    strong: '#cbd5e1',       // slate-300 - Emphasized borders
    focus: ALGOLIA.NEBULA_BLUE,
  },

  // Status colors - HIGH CONTRAST for visibility
  status: {
    hot: {
      bg: '#dc2626',         // red-600 - Solid background
      bgLight: '#fef2f2',    // red-50 - Light background
      border: '#fecaca',     // red-200 - Border
      text: '#dc2626',       // red-600 - Text on light
      textInverse: '#ffffff', // White text on solid
    },
    warm: {
      bg: '#ea580c',         // orange-600
      bgLight: '#fff7ed',    // orange-50
      border: '#fed7aa',     // orange-200
      text: '#ea580c',       // orange-600
      textInverse: '#ffffff',
    },
    cold: {
      bg: '#64748b',         // slate-500
      bgLight: '#f8fafc',    // slate-50
      border: '#e2e8f0',     // slate-200
      text: '#64748b',       // slate-500
      textInverse: '#ffffff',
    },
  },

  // Semantic
  success: {
    bg: '#16a34a',           // green-600
    bgLight: '#f0fdf4',      // green-50
    text: '#16a34a',         // green-600
    textInverse: '#ffffff',
  },
  warning: {
    bg: '#ca8a04',           // yellow-600
    bgLight: '#fefce8',      // yellow-50
    text: '#ca8a04',         // yellow-600
    textInverse: '#ffffff',
  },
  error: {
    bg: '#dc2626',           // red-600
    bgLight: '#fef2f2',      // red-50
    text: '#dc2626',         // red-600
    textInverse: '#ffffff',
  },
  info: {
    bg: ALGOLIA.NEBULA_BLUE,
    bgLight: '#eff6ff',      // blue-50
    text: ALGOLIA.NEBULA_BLUE,
    textInverse: '#ffffff',
  },
} as const;

// =============================================================================
// PARTNER TECH COLORS (for badges)
// =============================================================================

export const PARTNER_COLORS: Record<string, { bg: string; text: string }> = {
  'Adobe Experience Manager': { bg: '#dc2626', text: '#ffffff' },
  'Adobe AEM': { bg: '#dc2626', text: '#ffffff' },
  'Adobe Commerce': { bg: '#7c3aed', text: '#ffffff' },
  'Amplience': { bg: '#2563eb', text: '#ffffff' },
  'Spryker': { bg: '#0d9488', text: '#ffffff' },
  'Shopify': { bg: '#16a34a', text: '#ffffff' },
  'BigCommerce': { bg: '#7c3aed', text: '#ffffff' },
  'Salesforce Commerce': { bg: '#0891b2', text: '#ffffff' },
  'SAP Commerce': { bg: '#ea580c', text: '#ffffff' },
  'Commercetools': { bg: '#4f46e5', text: '#ffffff' },
  'default': { bg: '#64748b', text: '#ffffff' },
};

// =============================================================================
// STATUS BADGE CONFIG
// =============================================================================

export const STATUS_BADGE = {
  hot: {
    bg: '#dc2626',
    text: '#ffffff',
    icon: 'flame',
  },
  warm: {
    bg: '#ea580c',
    text: '#ffffff',
    icon: 'trending-up',
  },
  cold: {
    bg: '#64748b',
    text: '#ffffff',
    icon: 'snowflake',
  },
} as const;

// =============================================================================
// MANTINE COLOR MAPPINGS
// =============================================================================

// Use these with Mantine's color prop for consistent results
export const MANTINE_COLORS = {
  // Status badges - use 'filled' variant with these
  hot: 'red',
  warm: 'orange',
  cold: 'gray',

  // Partner tech - use 'filled' variant with these
  adobe: 'red',
  amplience: 'blue',
  spryker: 'teal',
  shopify: 'green',
  bigcommerce: 'violet',
  salesforce: 'cyan',
  sap: 'orange',

  // General
  primary: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
  info: 'blue',
} as const;

// =============================================================================
// LEGACY ALIASES (for gradual migration)
// =============================================================================

export const GRAY_50 = COLORS.bg.hover;
export const GRAY_100 = COLORS.bg.active;
export const GRAY_200 = COLORS.border.default;
export const GRAY_400 = COLORS.text.disabled;
export const GRAY_500 = COLORS.text.muted;
export const GRAY_700 = COLORS.text.secondary;
export const GRAY_900 = COLORS.text.primary;
export const ALGOLIA_BLUE = ALGOLIA.NEBULA_BLUE;
