/**
 * SortHeader - Reusable Sortable Column Header
 *
 * This component provides clickable column headers with sort indicators.
 * Use this everywhere you need sortable columns for consistency.
 *
 * Features:
 * - Click to toggle sort direction (none → asc → desc → none)
 * - Visual indicators for current sort state
 * - Consistent styling across all tables
 */

import { UnstyledButton, Group, Text } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';

// Algolia Brand Colors
const ALGOLIA_NEBULA_BLUE = '#003DFF';
const ALGOLIA_SPACE_GRAY = '#21243D';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortHeaderProps {
  /** Column label displayed in header */
  label: string;
  /** Current sort direction for this column */
  sortDirection: SortDirection;
  /** Callback when sort is toggled */
  onSortChange: (direction: SortDirection) => void;
  /** Whether this column is currently the active sort column */
  isActive?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

export function SortHeader({
  label,
  sortDirection,
  onSortChange,
  isActive = false,
  align = 'left',
}: SortHeaderProps) {
  // Toggle through: null → asc → desc → null
  const handleClick = () => {
    if (sortDirection === null) {
      onSortChange('asc');
    } else if (sortDirection === 'asc') {
      onSortChange('desc');
    } else {
      onSortChange(null);
    }
  };

  const getSortIcon = () => {
    if (!isActive || sortDirection === null) {
      return <IconSelector size={14} color={GRAY_500} strokeWidth={2} />;
    }
    if (sortDirection === 'asc') {
      return <IconChevronUp size={14} color={ALGOLIA_NEBULA_BLUE} strokeWidth={2.5} />;
    }
    return <IconChevronDown size={14} color={ALGOLIA_NEBULA_BLUE} strokeWidth={2.5} />;
  };

  return (
    <UnstyledButton
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        gap: 4,
        padding: '6px 10px',
        borderRadius: 6,
        background: isActive ? 'rgba(0, 61, 255, 0.05)' : 'transparent',
        transition: 'all 0.15s ease',
        width: '100%',
      }}
    >
      <Text
        size="sm"
        fw={700}
        c={isActive ? ALGOLIA_NEBULA_BLUE : GRAY_700}
        tt="uppercase"
      >
        {label}
      </Text>
      {getSortIcon()}
    </UnstyledButton>
  );
}

export default SortHeader;
