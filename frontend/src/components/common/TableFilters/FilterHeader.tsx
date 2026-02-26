/**
 * FilterHeader - Reusable Excel-Style Column Filter
 *
 * This component provides Excel/Google Sheets style filtering for any table column.
 * Use this everywhere you need column filtering for consistency.
 *
 * Features:
 * - Dropdown stays open while selecting multiple items
 * - Local pending state until "Apply" is clicked
 * - "X of Y selected" counter
 * - Select All / Clear All quick actions
 * - Proper checkboxes with white/blue styling
 */

import { useState, useMemo } from 'react';
import {
  Popover,
  UnstyledButton,
  Text,
  Badge,
  Stack,
  Group,
  Divider,
  Button,
  Checkbox,
  ScrollArea,
} from '@mantine/core';
import { IconChevronDown, IconFilter } from '@tabler/icons-react';

// Algolia Brand Colors
const ALGOLIA_NEBULA_BLUE = '#003DFF';
const ALGOLIA_SPACE_GRAY = '#21243D';
const GRAY_200 = '#e2e8f0';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';

export interface FilterOption {
  value: string;
  label?: string; // Optional custom label
  count: number;
}

export interface FilterHeaderProps {
  /** Column label displayed in header */
  label: string;
  /** Available filter options with counts */
  options: FilterOption[];
  /** Currently applied filter values */
  selectedValues: string[];
  /** Callback when filter is applied */
  onFilterChange: (values: string[]) => void;
  /** Optional color map for badge styling (e.g., { hot: 'red', warm: 'orange' }) */
  colorMap?: Record<string, string>;
  /** Whether to sort options by count (default: true) */
  sortByCount?: boolean;
}

export function FilterHeader({
  label,
  options,
  selectedValues,
  onFilterChange,
  colorMap,
  sortByCount = true,
}: FilterHeaderProps) {
  const [opened, setOpened] = useState(false);

  // LOCAL pending state - only applied when user clicks "Apply"
  const [pendingValues, setPendingValues] = useState<string[]>([]);

  // When popover opens, sync pending with current applied values
  const handleOpen = () => {
    setPendingValues([...selectedValues]);
    setOpened(true);
  };

  // Check if filter is currently applied (not pending)
  const hasAppliedFilter = selectedValues.length > 0;
  const filterCount = selectedValues.length;

  // Sort options by count (highest first) if enabled
  const sortedOptions = useMemo(() => {
    if (!sortByCount) return options;
    return [...options].sort((a, b) => b.count - a.count);
  }, [options, sortByCount]);

  // Toggle a value in PENDING state (doesn't apply yet)
  const togglePendingValue = (value: string) => {
    if (pendingValues.includes(value)) {
      setPendingValues(pendingValues.filter((v) => v !== value));
    } else {
      setPendingValues([...pendingValues, value]);
    }
  };

  // Select all in pending (clears filter - shows all)
  const selectAllPending = () => {
    setPendingValues([]);
  };

  // Clear all pending selections
  const clearAllPending = () => {
    setPendingValues([]);
  };

  // APPLY the pending selections
  const applyFilter = () => {
    onFilterChange(pendingValues);
    setOpened(false);
  };

  // Cancel and discard pending changes
  const cancelFilter = () => {
    setPendingValues([...selectedValues]);
    setOpened(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={(isOpen) => {
        if (!isOpen) {
          // Closing without apply - discard pending changes
          setPendingValues([...selectedValues]);
        }
        setOpened(isOpen);
      }}
      position="bottom-start"
      shadow="xl"
      width={320}
    >
      <Popover.Target>
        {/* ENTIRE HEADER IS CLICKABLE - Excel style */}
        <UnstyledButton
          onClick={handleOpen}
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
          <Text size="sm" fw={700} c={hasAppliedFilter ? ALGOLIA_NEBULA_BLUE : GRAY_700} tt="uppercase">
            {label}
          </Text>

          {/* Filter indicator - badge when active, dropdown arrow when not */}
          {hasAppliedFilter ? (
            <Badge size="sm" variant="filled" color="blue" style={{ minWidth: 22 }}>
              {filterCount}
            </Badge>
          ) : (
            <IconChevronDown size={16} color={ALGOLIA_SPACE_GRAY} strokeWidth={2.5} />
          )}
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown
        style={{
          background: 'white',
          border: `1px solid ${GRAY_200}`,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderRadius: 8,
        }}
      >
        <Stack gap="sm">
          {/* Header */}
          <Group justify="space-between">
            <Group gap="xs">
              <IconFilter size={16} color={ALGOLIA_NEBULA_BLUE} />
              <Text size="sm" fw={600} c="#1e293b">
                Filter by {label}
              </Text>
            </Group>
            <Text size="xs" c={GRAY_500}>
              {pendingValues.length > 0
                ? `${pendingValues.length} of ${options.length} selected`
                : `${options.length} values`}
            </Text>
          </Group>

          <Divider />

          {/* Quick actions row */}
          <Group gap="xs">
            <Button size="compact-xs" variant="subtle" color="blue" onClick={selectAllPending}>
              Select All
            </Button>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={clearAllPending}>
              Clear All
            </Button>
          </Group>

          {/* Filter options */}
          <ScrollArea.Autosize mah={280}>
            <Stack gap={6}>
              {sortedOptions.map((option) => {
                const isChecked = pendingValues.includes(option.value);
                const displayLabel = option.label || option.value || '(empty)';

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
                      background: isChecked ? '#dbeafe' : '#f8fafc',
                      border: isChecked ? '2px solid #3b82f6' : '1px solid #e2e8f0',
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
                          icon: {
                            color: '#ffffff',
                          },
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
                          {displayLabel}
                        </Badge>
                      ) : (
                        <Text size="sm" fw={500} c="#1e293b">
                          {displayLabel}
                        </Text>
                      )}
                    </Group>
                    {/* COUNT badge */}
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

          {/* Footer with Apply/Cancel buttons */}
          <Divider />
          <Group justify="flex-end" gap="sm">
            <Button size="sm" variant="subtle" color="gray" onClick={cancelFilter}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="filled"
              color="blue"
              onClick={applyFilter}
            >
              Apply Filter
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export default FilterHeader;
