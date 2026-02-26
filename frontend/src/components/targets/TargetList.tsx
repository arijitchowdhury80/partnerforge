/**
 * TargetList Component - Algolia Brand + Excel-Style Filters
 * Version: 2.4.1 - FORCE REBUILD
 *
 * Click column headers (Status, Vertical, Partner Tech) to open filter popups.
 * Filter options sorted by count (most common first), with checkboxes.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Pagination,
  Avatar,
  Anchor,
  Loader,
  UnstyledButton,
  Popover,
  Checkbox,
  ScrollArea,
  Divider,
  Button,
  Stack,
} from '@mantine/core';
import {
  IconEye,
  IconExternalLink,
  IconArrowUp,
  IconArrowDown,
  IconSelector,
  IconChevronDown,
  IconX,
  IconFilter,
} from '@tabler/icons-react';
import type { Company } from '@/types';

// Colors
const ALGOLIA_BLUE = '#003DFF';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';
const GRAY_400 = '#94a3b8';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';
const GRAY_900 = '#0f172a';

// Status colors
const STATUS_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  hot: { bg: '#fef2f2', text: '#dc2626', badge: 'red' },
  warm: { bg: '#fff7ed', text: '#ea580c', badge: 'orange' },
  cold: { bg: '#f8fafc', text: '#64748b', badge: 'gray' },
};

// Types
export interface ColumnFilter {
  column: string;
  values: string[];
}

interface FilterOption {
  value: string;
  count: number;
}

interface TargetListProps {
  companies: Company[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  onPageChange?: (page: number) => void;
  onEnrichCompany?: (domain: string) => void;
  columnFilters?: ColumnFilter[];
  onColumnFilterChange?: (column: string, values: string[]) => void;
}

// =============================================================================
// Excel-Style Filter Header Component
// =============================================================================

interface FilterHeaderProps {
  column: any;
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onFilterChange: (values: string[]) => void;
  colorMap?: Record<string, string>;
}

function FilterHeader({
  column,
  label,
  options,
  selectedValues,
  onFilterChange,
  colorMap,
}: FilterHeaderProps) {
  const [opened, setOpened] = useState(false);

  // Check if filter is active (some but not all selected)
  const hasFilter = selectedValues.length > 0 && selectedValues.length < options.length;

  // Sort options by count (highest first) - THIS IS THE KEY SORTING
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => b.count - a.count);
  }, [options]);

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onFilterChange(selectedValues.filter((v) => v !== value));
    } else {
      onFilterChange([...selectedValues, value]);
    }
  };

  const selectAll = () => {
    onFilterChange(options.map((o) => o.value));
  };

  const clearAll = () => {
    onFilterChange([]);
    setOpened(false);
  };

  return (
    <Group gap={4} wrap="nowrap">
      {/* Sort button */}
      <UnstyledButton
        onClick={() => column.toggleSorting()}
        style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      >
        <Text size="xs" fw={600} c={GRAY_500} tt="uppercase">{label}</Text>
        {{
          asc: <IconArrowUp size={12} color={ALGOLIA_BLUE} />,
          desc: <IconArrowDown size={12} color={ALGOLIA_BLUE} />,
        }[column.getIsSorted() as string] ?? <IconSelector size={12} color={GRAY_400} />}
      </UnstyledButton>

      {/* Filter dropdown */}
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        shadow="lg"
        width={280}
      >
        <Popover.Target>
          <ActionIcon
            variant={hasFilter ? 'filled' : 'subtle'}
            size="xs"
            color={hasFilter ? 'blue' : 'gray'}
            onClick={() => setOpened(!opened)}
          >
            {hasFilter ? (
              <Badge size="xs" circle variant="filled" color="blue">
                {selectedValues.length}
              </Badge>
            ) : (
              <IconChevronDown size={12} />
            )}
          </ActionIcon>
        </Popover.Target>

        <Popover.Dropdown
          style={{
            background: 'white',
            border: `1px solid ${GRAY_200}`,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }}
        >
          <Stack gap="xs">
            {/* Header */}
            <Group justify="space-between">
              <Group gap="xs">
                <IconFilter size={14} color={ALGOLIA_BLUE} />
                <Text size="sm" fw={600} c={GRAY_900}>
                  Filter by {label}
                </Text>
              </Group>
              {hasFilter && (
                <ActionIcon variant="subtle" size="xs" onClick={clearAll} c="gray">
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>

            <Divider />

            {/* Quick actions */}
            <Group gap="xs">
              <Button size="compact-xs" variant="light" color="blue" onClick={selectAll}>
                Select All
              </Button>
              <Button size="compact-xs" variant="light" color="gray" onClick={clearAll}>
                Clear
              </Button>
            </Group>

            {/* Filter options - SORTED BY COUNT */}
            <ScrollArea.Autosize mah={300}>
              <Stack gap={4}>
                {sortedOptions.map((option) => {
                  const isSelected = selectedValues.length === 0 || selectedValues.includes(option.value);
                  const badgeColor = colorMap?.[option.value];

                  return (
                    <UnstyledButton
                      key={option.value}
                      onClick={() => toggleValue(option.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: isSelected ? '#eff6ff' : 'transparent',
                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Group gap="sm">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {}}
                          size="xs"
                          color="blue"
                          styles={{ input: { cursor: 'pointer' } }}
                        />
                        {badgeColor ? (
                          <Badge size="sm" color={badgeColor} variant="light" tt="capitalize">
                            {option.value}
                          </Badge>
                        ) : (
                          <Text size="sm" c={GRAY_700}>
                            {option.value}
                          </Text>
                        )}
                      </Group>
                      {/* COUNT BADGE - shows how many companies */}
                      <Badge size="sm" variant="light" color="gray">
                        {option.count}
                      </Badge>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>

            {/* Footer showing selection count */}
            {hasFilter && (
              <>
                <Divider />
                <Text size="xs" c={GRAY_500} ta="center">
                  {selectedValues.length} of {options.length} selected
                </Text>
              </>
            )}
          </Stack>
        </Popover.Dropdown>
      </Popover>
    </Group>
  );
}

// =============================================================================
// Simple Sort Header (for columns without filtering)
// =============================================================================

function SortHeader({ column, label }: { column: any; label: string }) {
  return (
    <UnstyledButton
      onClick={() => column.toggleSorting()}
      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <Text size="xs" fw={600} c={GRAY_500} tt="uppercase">{label}</Text>
      {{
        asc: <IconArrowUp size={12} color={ALGOLIA_BLUE} />,
        desc: <IconArrowDown size={12} color={ALGOLIA_BLUE} />,
      }[column.getIsSorted() as string] ?? <IconSelector size={12} color={GRAY_400} />}
    </UnstyledButton>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function StatusBadge({ status }: { status: 'hot' | 'warm' | 'cold' }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.cold;
  return (
    <Badge size="sm" variant="light" color={colors.badge} tt="capitalize">
      {status}
    </Badge>
  );
}

function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 80 ? '#dc2626' : score >= 40 ? '#ea580c' : GRAY_500;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 40, height: 6, borderRadius: 3, background: GRAY_200, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <Text size="sm" fw={600} style={{ color }}>{score}</Text>
    </div>
  );
}

function formatTraffic(visits: number | undefined): string {
  if (!visits) return '—';
  if (visits >= 1000000) return `${(visits / 1000000).toFixed(1)}M`;
  if (visits >= 1000) return `${(visits / 1000).toFixed(0)}K`;
  return visits.toString();
}

// =============================================================================
// Main Component
// =============================================================================

export function TargetList({
  companies,
  isLoading = false,
  pagination,
  onPageChange,
  columnFilters = [],
  onColumnFilterChange,
}: TargetListProps) {
  const navigate = useNavigate();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'icp_score', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Get current filter values for a column
  const getFilterValues = useCallback(
    (column: string) => {
      const filter = columnFilters.find((f) => f.column === column);
      return filter?.values || [];
    },
    [columnFilters]
  );

  // Handle filter changes
  const handleFilterChange = useCallback(
    (column: string, values: string[]) => {
      onColumnFilterChange?.(column, values);
    },
    [onColumnFilterChange]
  );

  // Build filter options with counts - SORTED BY COUNT (highest first)
  const statusOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      if (c.status) counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const verticalOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      if (c.vertical) counts[c.vertical] = (counts[c.vertical] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const partnerTechOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      c.partner_tech?.forEach((tech) => {
        counts[tech] = (counts[tech] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [companies]);

  const statusColors: Record<string, string> = { hot: 'red', warm: 'orange', cold: 'gray' };

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: 'company_name',
        header: ({ column }) => <SortHeader column={column} label="Company" />,
        cell: ({ row }) => {
          const company = row.original;
          return (
            <Group gap="sm" wrap="nowrap">
              <Avatar size="sm" radius="md" color="blue">
                {(company.company_name || company.domain).charAt(0).toUpperCase()}
              </Avatar>
              <div>
                <Text size="sm" fw={500} c={GRAY_900} lineClamp={1}>
                  {company.company_name || company.domain}
                </Text>
                <Anchor
                  href={`https://${company.domain}`}
                  target="_blank"
                  size="xs"
                  c={GRAY_500}
                  onClick={(e) => e.stopPropagation()}
                >
                  {company.domain}
                </Anchor>
              </div>
            </Group>
          );
        },
        size: 220,
      },
      {
        accessorKey: 'icp_score',
        header: ({ column }) => <SortHeader column={column} label="ICP Score" />,
        cell: ({ getValue }) => <ScoreDisplay score={getValue<number>() || 0} />,
        size: 120,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <FilterHeader
            column={column}
            label="Status"
            options={statusOptions}
            selectedValues={getFilterValues('status')}
            onFilterChange={(values) => handleFilterChange('status', values)}
            colorMap={statusColors}
          />
        ),
        cell: ({ getValue }) => <StatusBadge status={getValue<Company['status']>()} />,
        size: 120,
      },
      {
        accessorKey: 'vertical',
        header: ({ column }) => (
          <FilterHeader
            column={column}
            label="Vertical"
            options={verticalOptions}
            selectedValues={getFilterValues('vertical')}
            onFilterChange={(values) => handleFilterChange('vertical', values)}
          />
        ),
        cell: ({ getValue }) => (
          <Text size="sm" c={GRAY_700} lineClamp={1}>
            {getValue<string>() || '—'}
          </Text>
        ),
        size: 160,
      },
      {
        accessorKey: 'partner_tech',
        header: ({ column }) => (
          <FilterHeader
            column={column}
            label="Partner Tech"
            options={partnerTechOptions}
            selectedValues={getFilterValues('partner_tech')}
            onFilterChange={(values) => handleFilterChange('partner_tech', values)}
          />
        ),
        cell: ({ getValue, row }) => {
          const techs = getValue<string[]>() || [];
          if (techs.length === 0) return <Text size="sm" c={GRAY_400}>—</Text>;
          return (
            <Tooltip label={`Source: BuiltWith • ${techs.join(', ')}`} withArrow>
              <Anchor
                href={`https://builtwith.com/${row.original.domain}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                size="sm"
              >
                <Badge size="sm" variant="light" color="green">
                  {techs[0]}
                  {techs.length > 1 && ` +${techs.length - 1}`}
                </Badge>
              </Anchor>
            </Tooltip>
          );
        },
        size: 160,
      },
      {
        accessorKey: 'sw_monthly_visits',
        header: ({ column }) => <SortHeader column={column} label="Traffic" />,
        cell: ({ getValue, row }) => {
          const visits = getValue<number>();
          return (
            <Tooltip label={`Source: SimilarWeb • ${visits?.toLocaleString() || 'N/A'} monthly visits`} withArrow>
              <Anchor
                href={`https://www.similarweb.com/website/${row.original.domain}/`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
                size="sm"
                c={visits && visits > 1000000 ? 'green' : GRAY_700}
                fw={500}
              >
                {formatTraffic(visits)}
              </Anchor>
            </Tooltip>
          );
        },
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Group gap="xs" justify="flex-end">
            <Tooltip label="View Intelligence">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/company/${row.original.domain}`);
                }}
              >
                <IconEye size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Visit Website">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                component="a"
                href={`https://${row.original.domain}`}
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                <IconExternalLink size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        ),
        size: 80,
      },
    ],
    [navigate, statusOptions, verticalOptions, partnerTechOptions, getFilterValues, handleFilterChange]
  );

  const table = useReactTable({
    data: companies,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: !!pagination,
    pageCount: pagination?.total_pages || -1,
  });

  const handleRowClick = useCallback((domain: string) => navigate(`/company/${domain}`), [navigate]);

  // Count active filters
  const activeFilterCount = columnFilters.filter((f) => f.values.length > 0).length;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader color={ALGOLIA_BLUE} size="md" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Text c={GRAY_500}>No companies found</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Filter indicator */}
      {activeFilterCount > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${GRAY_200}`, background: GRAY_50 }}>
          <Group gap="xs">
            <IconFilter size={14} color={ALGOLIA_BLUE} />
            <Text size="sm" c={GRAY_700}>
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </Text>
            <Text size="xs" c={GRAY_500}>
              — Click column header dropdowns to modify
            </Text>
          </Group>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ borderBottom: `2px solid ${GRAY_200}` }}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: header.getSize(),
                    }}
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            <AnimatePresence>
              {table.getRowModel().rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleRowClick(row.original.domain)}
                  style={{
                    borderBottom: `1px solid ${GRAY_100}`,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = GRAY_50;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{
                        padding: '16px',
                        width: cell.column.getSize(),
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total_pages > 1 && (
        <div style={{ padding: '16px 0', borderTop: `1px solid ${GRAY_200}`, marginTop: 16 }}>
          <Group justify="space-between">
            <Text size="sm" c={GRAY_500}>
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </Text>
            <Pagination
              value={pagination.page}
              onChange={onPageChange || (() => {})}
              total={pagination.total_pages}
              size="sm"
              withEdges
            />
          </Group>
        </div>
      )}
    </div>
  );
}

export default TargetList;
