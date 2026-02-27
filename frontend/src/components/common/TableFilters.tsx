/**
 * TableFilters Library - Reusable Excel-Style Filtering Components
 *
 * SINGLE SOURCE OF TRUTH for all table filtering UI.
 * Use these components everywhere instead of custom inline implementations.
 */

import { useState, useMemo } from 'react';
import {
  UnstyledButton,
  Text,
  Badge,
  Popover,
  Checkbox,
  ScrollArea,
  Divider,
  Button,
  Stack,
  Group,
} from '@mantine/core';
import {
  IconChevronDown,
  IconFilter,
  IconArrowUp,
  IconArrowDown,
  IconSelector,
} from '@tabler/icons-react';
import { STATUSES, STATUS_MAP, COLORS, type StatusKey } from '@/lib/constants';

// =============================================================================
// Shared Types
// =============================================================================

export interface FilterOption {
  value: string;
  count: number;
}

export interface ColumnFilter {
  column: string;
  values: string[];
}

// =============================================================================
// Shared Colors - exported for consistency
// =============================================================================

export const TABLE_COLORS = {
  HEADER_BG: COLORS.ALGOLIA_SPACE_GRAY,
  BODY_BG: COLORS.ALGOLIA_WHITE,
  BODY_BG_ALT: COLORS.GRAY_50,
  BORDER: COLORS.GRAY_200,
  TEXT_PRIMARY: COLORS.GRAY_900,
  TEXT_SECONDARY: COLORS.GRAY_500,
  ACCENT: COLORS.ALGOLIA_NEBULA_BLUE,
};

// Status color map for badges - uses canonical order
export const STATUS_COLOR_MAP: Record<string, string> = {
  hot: 'red',
  warm: 'orange',
  cold: 'gray',
};

// =============================================================================
// Sort Status Options in Canonical Order (Hot → Warm → Cold)
// =============================================================================

export function sortStatusOptions(options: FilterOption[]): FilterOption[] {
  const order: StatusKey[] = ['hot', 'warm', 'cold'];
  return [...options].sort((a, b) => {
    const aIndex = order.indexOf(a.value as StatusKey);
    const bIndex = order.indexOf(b.value as StatusKey);
    // If not found in order, put at end
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}

// =============================================================================
// FilterHeader Component - Excel-style column filter
// =============================================================================

interface FilterHeaderProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onFilterChange: (values: string[]) => void;
  colorMap?: Record<string, string>;
  /** If true, sorts options in canonical status order (Hot → Warm → Cold) instead of by count */
  useCanonicalOrder?: boolean;
}

export function FilterHeader({
  label,
  options,
  selectedValues,
  onFilterChange,
  colorMap,
  useCanonicalOrder = false,
}: FilterHeaderProps) {
  const [opened, setOpened] = useState(false);
  const [pendingValues, setPendingValues] = useState<string[]>([]);

  // Toggle handler - properly opens/closes and initializes pending values
  const handleToggle = () => {
    if (!opened) {
      // Opening: initialize pending values
      setPendingValues([...selectedValues]);
    }
    setOpened(!opened);
  };

  const hasAppliedFilter = selectedValues.length > 0;
  const filterCount = selectedValues.length;

  // Sort options: canonical order for status, by count for others
  const sortedOptions = useMemo(() => {
    if (useCanonicalOrder) {
      return sortStatusOptions(options);
    }
    return [...options].sort((a, b) => b.count - a.count);
  }, [options, useCanonicalOrder]);

  const togglePendingValue = (value: string) => {
    if (pendingValues.includes(value)) {
      setPendingValues(pendingValues.filter((v) => v !== value));
    } else {
      setPendingValues([...pendingValues, value]);
    }
  };

  const selectAllPending = () => setPendingValues(sortedOptions.map(o => o.value));
  const clearAllPending = () => setPendingValues([]);

  const applyFilter = () => {
    onFilterChange(pendingValues);
    setOpened(false);
  };

  const cancelFilter = () => {
    setPendingValues([...selectedValues]);
    setOpened(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={(isOpen) => {
        // Only handle external closes (clicking outside)
        // The target button handles toggle via onClick
        if (!isOpen && opened) {
          setPendingValues([...selectedValues]);
          setOpened(false);
        }
      }}
      position="bottom-start"
      shadow="xl"
      width={320}
      closeOnClickOutside
    >
      <Popover.Target>
        <UnstyledButton
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: hasAppliedFilter ? 'rgba(0, 61, 255, 0.1)' : 'transparent',
            border: hasAppliedFilter ? '1px solid rgba(0, 61, 255, 0.3)' : '1px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <Text
            size="sm"
            fw={700}
            c={hasAppliedFilter ? COLORS.ALGOLIA_NEBULA_BLUE : COLORS.GRAY_700}
            tt="uppercase"
          >
            {label}
          </Text>
          {hasAppliedFilter ? (
            <Badge size="sm" variant="filled" color="blue" style={{ minWidth: 22 }}>
              {filterCount}
            </Badge>
          ) : (
            <IconChevronDown
              size={16}
              color={opened ? COLORS.ALGOLIA_NEBULA_BLUE : COLORS.ALGOLIA_SPACE_GRAY}
              strokeWidth={2.5}
              style={{
                transform: opened ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease',
              }}
            />
          )}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: 'white',
          border: `1px solid ${COLORS.GRAY_200}`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderRadius: 8,
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <IconFilter size={16} color={COLORS.ALGOLIA_NEBULA_BLUE} />
              <Text size="sm" fw={600} c={COLORS.GRAY_800}>
                Filter by {label}
              </Text>
            </Group>
            <Text size="xs" c={COLORS.GRAY_500}>
              {pendingValues.length > 0
                ? `${pendingValues.length} of ${options.length} selected`
                : `${options.length} values`}
            </Text>
          </Group>

          <Divider />

          <Group gap="xs">
            <Button size="compact-xs" variant="subtle" color="blue" onClick={selectAllPending}>
              Select All
            </Button>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={clearAllPending}>
              Clear All
            </Button>
          </Group>

          <ScrollArea.Autosize mah={280}>
            <Stack gap={6}>
              {sortedOptions.map((option) => {
                const isChecked = pendingValues.includes(option.value);
                return (
                  <UnstyledButton
                    key={option.value}
                    onClick={() => togglePendingValue(option.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: isChecked ? '#dbeafe' : COLORS.GRAY_50,
                      border: isChecked ? '2px solid #3b82f6' : `1px solid ${COLORS.GRAY_200}`,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Group gap="sm">
                      <Checkbox
                        checked={isChecked}
                        onChange={() => {}}
                        size="md"
                        color="blue"
                        styles={{
                          input: {
                            cursor: 'pointer',
                            backgroundColor: isChecked ? '#3b82f6' : '#ffffff',
                            borderColor: isChecked ? '#3b82f6' : '#d1d5db',
                            borderWidth: 2,
                          },
                          icon: { color: '#ffffff' },
                        }}
                      />
                      {colorMap?.[option.value] ? (
                        <Badge
                          size="md"
                          color={colorMap[option.value]}
                          variant="filled"
                          tt="capitalize"
                          styles={{ root: { color: '#fff' } }}
                        >
                          {option.value}
                        </Badge>
                      ) : (
                        <Text size="sm" fw={500} c={COLORS.GRAY_800}>
                          {option.value || '(empty)'}
                        </Text>
                      )}
                    </Group>
                    <Badge
                      size="md"
                      variant="filled"
                      color="dark"
                      styles={{ root: { minWidth: 32, fontWeight: 700 } }}
                    >
                      {option.count}
                    </Badge>
                  </UnstyledButton>
                );
              })}
            </Stack>
          </ScrollArea.Autosize>

          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button size="sm" variant="subtle" color="gray" onClick={cancelFilter}>
              Cancel
            </Button>
            <Button size="sm" variant="filled" color="blue" onClick={applyFilter}>
              Apply Filter
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

// =============================================================================
// SortHeader Component - Column header with sort indicators
// =============================================================================

interface SortHeaderProps {
  column: any;
  label: string;
}

export function SortHeader({ column, label }: SortHeaderProps) {
  const isSorted = column.getIsSorted();
  return (
    <UnstyledButton
      onClick={() => column.toggleSorting()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 6,
        background: isSorted ? 'rgba(0, 61, 255, 0.1)' : 'transparent',
        border: isSorted ? '1px solid rgba(0, 61, 255, 0.3)' : '1px solid transparent',
        transition: 'all 0.15s ease',
      }}
    >
      <Text
        size="sm"
        fw={700}
        c={isSorted ? COLORS.ALGOLIA_NEBULA_BLUE : COLORS.ALGOLIA_SPACE_GRAY}
        tt="uppercase"
      >
        {label}
      </Text>
      {{
        asc: <IconArrowUp size={16} color={COLORS.ALGOLIA_NEBULA_BLUE} strokeWidth={2.5} />,
        desc: <IconArrowDown size={16} color={COLORS.ALGOLIA_NEBULA_BLUE} strokeWidth={2.5} />,
      }[isSorted as string] ?? (
        <IconSelector size={16} color={COLORS.ALGOLIA_SPACE_GRAY} strokeWidth={2} />
      )}
    </UnstyledButton>
  );
}

// =============================================================================
// NumericRangeFilter - For traffic, revenue, ICP score columns
// =============================================================================

export interface NumericRange {
  min: number | null;
  max: number | null;
  label: string;
}

interface NumericFilterHeaderProps {
  label: string;
  /** Pre-defined range options like "0-1M", "1M-10M", etc. */
  ranges: NumericRange[];
  /** Currently selected range */
  selectedRange: NumericRange | null;
  /** Called when filter changes */
  onFilterChange: (range: NumericRange | null) => void;
  /** Unit suffix for display (e.g., "/mo" for monthly) */
  unit?: string;
  /** Enable sorting */
  sortable?: boolean;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc' | null;
  /** Called when sort changes */
  onSortChange?: (direction: 'asc' | 'desc') => void;
}

export function NumericFilterHeader({
  label,
  ranges,
  selectedRange,
  onFilterChange,
  unit = '',
  sortable = true,
  sortDirection,
  onSortChange,
}: NumericFilterHeaderProps) {
  const [opened, setOpened] = useState(false);

  const hasAppliedFilter = selectedRange !== null;

  const handleRangeSelect = (range: NumericRange | null) => {
    onFilterChange(range);
    setOpened(false);
  };

  const handleSort = (direction: 'asc' | 'desc') => {
    onSortChange?.(direction);
    setOpened(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={(isOpen) => {
        // Only handle external closes (clicking outside)
        if (!isOpen && opened) {
          setOpened(false);
        }
      }}
      position="bottom-start"
      shadow="xl"
      width={280}
      closeOnClickOutside
    >
      <Popover.Target>
        <UnstyledButton
          onClick={(e) => {
            e.stopPropagation();
            setOpened(!opened);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: hasAppliedFilter || sortDirection ? 'rgba(0, 61, 255, 0.1)' : 'transparent',
            border: hasAppliedFilter || sortDirection ? '1px solid rgba(0, 61, 255, 0.3)' : '1px solid transparent',
            transition: 'all 0.15s ease',
          }}
        >
          <Text
            size="sm"
            fw={700}
            c={hasAppliedFilter || sortDirection ? COLORS.ALGOLIA_NEBULA_BLUE : COLORS.GRAY_700}
            tt="uppercase"
          >
            {label}
          </Text>
          {sortDirection === 'asc' && <IconArrowUp size={14} color={COLORS.ALGOLIA_NEBULA_BLUE} />}
          {sortDirection === 'desc' && <IconArrowDown size={14} color={COLORS.ALGOLIA_NEBULA_BLUE} />}
          {hasAppliedFilter && (
            <Badge size="sm" variant="filled" color="blue">
              {selectedRange?.label}
            </Badge>
          )}
          {!hasAppliedFilter && !sortDirection && (
            <IconChevronDown
              size={16}
              color={opened ? COLORS.ALGOLIA_NEBULA_BLUE : COLORS.ALGOLIA_SPACE_GRAY}
              strokeWidth={2.5}
              style={{
                transform: opened ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s ease',
              }}
            />
          )}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: 'white',
          border: `1px solid ${COLORS.GRAY_200}`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderRadius: 8,
        }}
      >
        <Stack gap="sm">
          <Group justify="space-between">
            <Group gap="xs">
              <IconFilter size={16} color={COLORS.ALGOLIA_NEBULA_BLUE} />
              <Text size="sm" fw={600} c={COLORS.GRAY_800}>
                {label} {unit && <Text span size="xs" c={COLORS.GRAY_500}>({unit})</Text>}
              </Text>
            </Group>
          </Group>

          {sortable && (
            <>
              <Divider label="Sort" labelPosition="left" />
              <Group gap="xs">
                <Button
                  size="compact-sm"
                  variant={sortDirection === 'desc' ? 'filled' : 'light'}
                  color="blue"
                  leftSection={<IconArrowDown size={14} />}
                  onClick={() => handleSort('desc')}
                >
                  High to Low
                </Button>
                <Button
                  size="compact-sm"
                  variant={sortDirection === 'asc' ? 'filled' : 'light'}
                  color="blue"
                  leftSection={<IconArrowUp size={14} />}
                  onClick={() => handleSort('asc')}
                >
                  Low to High
                </Button>
              </Group>
            </>
          )}

          <Divider label="Filter by Range" labelPosition="left" />

          <Stack gap={6}>
            <UnstyledButton
              onClick={() => handleRangeSelect(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 8,
                background: !selectedRange ? '#dbeafe' : COLORS.GRAY_50,
                border: !selectedRange ? '2px solid #3b82f6' : `1px solid ${COLORS.GRAY_200}`,
                transition: 'all 0.15s ease',
              }}
            >
              <Text size="sm" fw={500} c={COLORS.GRAY_800}>All Values</Text>
            </UnstyledButton>

            {ranges.map((range, idx) => {
              const isSelected = selectedRange?.label === range.label;
              return (
                <UnstyledButton
                  key={idx}
                  onClick={() => handleRangeSelect(range)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: isSelected ? '#dbeafe' : COLORS.GRAY_50,
                    border: isSelected ? '2px solid #3b82f6' : `1px solid ${COLORS.GRAY_200}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Text size="sm" fw={500} c={COLORS.GRAY_800}>{range.label}</Text>
                </UnstyledButton>
              );
            })}
          </Stack>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

// =============================================================================
// Predefined Traffic Ranges
// =============================================================================

export const TRAFFIC_RANGES: NumericRange[] = [
  { min: 50000000, max: null, label: '50M+' },
  { min: 10000000, max: 50000000, label: '10M-50M' },
  { min: 1000000, max: 10000000, label: '1M-10M' },
  { min: 100000, max: 1000000, label: '100K-1M' },
  { min: 0, max: 100000, label: '<100K' },
];

// Matches composite scoring thresholds: 70+ = Hot, 40-69 = Warm, 0-39 = Cold
export const ICP_SCORE_RANGES: NumericRange[] = [
  { min: 70, max: 100, label: 'Hot (70-100)' },
  { min: 40, max: 69, label: 'Warm (40-69)' },
  { min: 0, max: 39, label: 'Cold (0-39)' },
];
