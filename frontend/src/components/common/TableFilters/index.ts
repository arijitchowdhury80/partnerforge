/**
 * TableFilters - Modular Excel-Style Table Filtering Library
 *
 * This module provides consistent, reusable components for table filtering
 * and sorting across the entire PartnerForge application.
 *
 * Usage:
 *   import { FilterHeader, SortHeader, FilterSortHeader } from '@/components/common/TableFilters';
 *
 * Components:
 *   - FilterHeader: Excel-style multi-select column filter with Apply/Cancel
 *   - SortHeader: Clickable column header with sort direction indicators
 *   - FilterSortHeader: Combined filter + sort in one header (coming soon)
 *
 * Design Principles:
 *   1. Single source of truth - one implementation used everywhere
 *   2. Excel/Google Sheets behavior - familiar UX patterns
 *   3. Consistent styling - Algolia brand colors throughout
 *   4. Pending state pattern - changes applied only on "Apply" click
 */

export { FilterHeader, type FilterHeaderProps, type FilterOption } from './FilterHeader';
export { SortHeader, type SortHeaderProps, type SortDirection } from './SortHeader';

// Color constants for use in consuming components
export const TABLE_COLORS = {
  ALGOLIA_NEBULA_BLUE: '#003DFF',
  ALGOLIA_SPACE_GRAY: '#21243D',
  ALGOLIA_PURPLE: '#5468FF',
  GRAY_200: '#e2e8f0',
  GRAY_500: '#64748b',
  GRAY_700: '#334155',
} as const;

// Status color map for consistent badge colors
export const STATUS_COLOR_MAP: Record<string, string> = {
  hot: 'red',
  warm: 'orange',
  cold: 'blue',
  cool: 'cyan',
};
