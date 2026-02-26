/**
 * TargetList Component
 *
 * Premium data table for displacement targets using TanStack Table.
 * Features Excel-style column filters with counts, sorting, and glassmorphism design.
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
  Paper,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Checkbox,
  Pagination,
  Avatar,
  Popover,
  Stack,
  Button,
  ScrollArea,
  Divider,
  UnstyledButton,
} from '@mantine/core';
import {
  IconEye,
  IconRefresh,
  IconExternalLink,
  IconDownload,
  IconColumns,
  IconArrowUp,
  IconArrowDown,
  IconSelector,
  IconX,
  IconChevronDown,
} from '@tabler/icons-react';
import type { Company } from '@/types';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ScoreGauge } from '@/components/common/ScoreGauge';
import { TableRowSkeleton } from '@/components/common/LoadingSpinner';

// =============================================================================
// Types
// =============================================================================

export interface ColumnFilter {
  column: string;
  values: string[];
}

export interface FilterOption {
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
  // Column filter callbacks
  columnFilters?: ColumnFilter[];
  onColumnFilterChange?: (column: string, values: string[]) => void;
}

// =============================================================================
// Excel-Style Column Filter Header Component
// =============================================================================

interface FilterableHeaderProps {
  column: any;
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onFilterChange: (values: string[]) => void;
  colorMap?: Record<string, string>;
}

function FilterableHeader({
  column,
  label,
  options,
  selectedValues,
  onFilterChange,
  colorMap,
}: FilterableHeaderProps) {
  const [opened, setOpened] = useState(false);
  const hasFilter = selectedValues.length > 0 && selectedValues.length < options.length;

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onFilterChange(selectedValues.filter((v) => v !== value));
    } else {
      onFilterChange([...selectedValues, value]);
    }
  };

  const clearFilter = () => {
    onFilterChange([]);
    setOpened(false);
  };

  const selectAll = () => {
    onFilterChange(options.map((o) => o.value));
  };

  // Sort options by count (highest first)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => b.count - a.count);
  }, [options]);

  return (
    <Group gap={4} wrap="nowrap">
      {/* Sort button */}
      <UnstyledButton
        onClick={() => column.toggleSorting()}
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <span>{label}</span>
        {{
          asc: <IconArrowUp size={12} />,
          desc: <IconArrowDown size={12} />,
        }[column.getIsSorted() as string] ?? (
          <IconSelector size={12} className="opacity-30" />
        )}
      </UnstyledButton>

      {/* Filter dropdown */}
      <Popover
        opened={opened}
        onChange={setOpened}
        position="bottom-start"
        shadow="lg"
        width={260}
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
            background: 'rgba(20, 20, 30, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" fw={600} c="white">
                Filter by {label}
              </Text>
              {hasFilter && (
                <ActionIcon
                  variant="subtle"
                  size="xs"
                  onClick={clearFilter}
                  c="dimmed"
                >
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>

            <Divider color="white/10" />

            <Group gap="xs">
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={selectAll}
              >
                Select All
              </Button>
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                onClick={clearFilter}
              >
                Clear
              </Button>
            </Group>

            <ScrollArea.Autosize mah={280}>
              <Stack gap={2}>
                {sortedOptions.map((option) => {
                  const isSelected = selectedValues.length === 0 || selectedValues.includes(option.value);
                  const color = colorMap?.[option.value];

                  return (
                    <UnstyledButton
                      key={option.value}
                      onClick={() => toggleValue(option.value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 6,
                        background: isSelected
                          ? 'rgba(59, 130, 246, 0.15)'
                          : 'transparent',
                        border: isSelected
                          ? '1px solid rgba(59, 130, 246, 0.3)'
                          : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                      className="hover:bg-white/5"
                    >
                      <Group gap="xs">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => {}}
                          size="xs"
                          styles={{
                            input: { cursor: 'pointer' },
                          }}
                        />
                        {color ? (
                          <Badge size="sm" color={color} variant="light">
                            {option.value}
                          </Badge>
                        ) : (
                          <Text size="sm" c="white/90">
                            {option.value}
                          </Text>
                        )}
                      </Group>
                      <Badge size="xs" variant="light" color="gray">
                        {option.count}
                      </Badge>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </ScrollArea.Autosize>

            {hasFilter && (
              <>
                <Divider color="white/10" />
                <Text size="xs" c="dimmed" ta="center">
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
// Simple Sort Header (no filter)
// =============================================================================

interface SortHeaderProps {
  column: any;
  label: string;
}

function SortHeader({ column, label }: SortHeaderProps) {
  return (
    <UnstyledButton
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      <span>{label}</span>
      {{
        asc: <IconArrowUp size={12} />,
        desc: <IconArrowDown size={12} />,
      }[column.getIsSorted() as string] ?? (
        <IconSelector size={12} className="opacity-30" />
      )}
    </UnstyledButton>
  );
}

// =============================================================================
// Partner Tech Cell with Tooltip
// =============================================================================

function PartnerTechCell({ techs }: { techs: string[] }) {
  if (techs.length === 0) {
    return (
      <Text size="xs" c="dimmed">
        ---
      </Text>
    );
  }

  if (techs.length === 1) {
    return (
      <Badge size="xs" variant="light" color="green">
        {techs[0]}
      </Badge>
    );
  }

  return (
    <Tooltip
      label={
        <Stack gap={4}>
          {techs.map((tech) => (
            <Text key={tech} size="xs">
              {tech}
            </Text>
          ))}
        </Stack>
      }
      withArrow
      multiline
    >
      <Group gap={4}>
        <Badge size="xs" variant="light" color="green">
          {techs[0]}
        </Badge>
        <Badge size="xs" variant="light" color="gray" style={{ cursor: 'help' }}>
          +{techs.length - 1}
        </Badge>
      </Group>
    </Tooltip>
  );
}

// =============================================================================
// Main TargetList Component
// =============================================================================

export function TargetList({
  companies,
  isLoading = false,
  pagination,
  onPageChange,
  onEnrichCompany,
  columnFilters = [],
  onColumnFilterChange,
}: TargetListProps) {
  const navigate = useNavigate();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'icp_score', desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Get filter values for a column
  const getFilterValues = useCallback(
    (column: string) => {
      const filter = columnFilters.find((f) => f.column === column);
      return filter?.values || [];
    },
    [columnFilters]
  );

  // Handle filter change for a column
  const handleFilterChange = useCallback(
    (column: string, values: string[]) => {
      onColumnFilterChange?.(column, values);
    },
    [onColumnFilterChange]
  );

  // Build filter options with counts from current data
  const statusOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    companies.forEach((c) => {
      if (c.status) counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return [
      { value: 'hot', count: counts.hot },
      { value: 'warm', count: counts.warm },
      { value: 'cold', count: counts.cold },
    ].filter((o) => o.count > 0);
  }, [companies]);

  const verticalOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companies.forEach((c) => {
      if (c.vertical) {
        counts[c.vertical] = (counts[c.vertical] || 0) + 1;
      }
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

  // Status colors
  const statusColors: Record<string, string> = {
    hot: 'red',
    warm: 'orange',
    cold: 'gray',
  };

  // Define columns
  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: 'company_name',
        header: ({ column }) => <SortHeader column={column} label="Company" />,
        cell: ({ row }) => {
          const company = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar size="sm" radius="md" color="blue" className="flex-shrink-0">
                {(company.company_name || company.domain).charAt(0).toUpperCase()}
              </Avatar>
              <div className="min-w-0">
                <Text size="sm" fw={500} c="white" truncate>
                  {company.company_name || company.domain}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <Text size="xs" c="dimmed" truncate>
                    {company.domain}
                  </Text>
                  {company.ticker && (
                    <Badge size="xs" variant="outline" color="gray">
                      {company.exchange}:{company.ticker}
                    </Badge>
                  )}
                </Group>
              </div>
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: 'icp_score',
        header: ({ column }) => <SortHeader column={column} label="ICP Score" />,
        cell: ({ getValue }) => {
          const score = getValue<number>() || 0;
          return (
            <div className="flex items-center justify-center">
              <ScoreGauge value={score} size="sm" />
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <FilterableHeader
            column={column}
            label="Status"
            options={statusOptions}
            selectedValues={getFilterValues('status')}
            onFilterChange={(values) => handleFilterChange('status', values)}
            colorMap={statusColors}
          />
        ),
        cell: ({ getValue }) => {
          const status = getValue<Company['status']>();
          return <StatusBadge status={status} size="sm" />;
        },
        size: 130,
      },
      {
        accessorKey: 'vertical',
        header: ({ column }) => (
          <FilterableHeader
            column={column}
            label="Vertical"
            options={verticalOptions}
            selectedValues={getFilterValues('vertical')}
            onFilterChange={(values) => handleFilterChange('vertical', values)}
          />
        ),
        cell: ({ getValue }) => (
          <Text size="sm" c="white/70">
            {getValue<string>() || '---'}
          </Text>
        ),
        size: 150,
      },
      {
        accessorKey: 'partner_tech',
        header: ({ column }) => (
          <FilterableHeader
            column={column}
            label="Partner Tech"
            options={partnerTechOptions}
            selectedValues={getFilterValues('partner_tech')}
            onFilterChange={(values) => handleFilterChange('partner_tech', values)}
          />
        ),
        cell: ({ getValue }) => {
          const techs = getValue<string[]>() || [];
          return <PartnerTechCell techs={techs} />;
        },
        size: 160,
      },
      {
        accessorKey: 'signal_score',
        header: ({ column }) => <SortHeader column={column} label="Signals" />,
        cell: ({ getValue }) => {
          const score = getValue<number>();
          if (!score) return <Text size="xs" c="dimmed">---</Text>;
          return (
            <Text size="sm" fw={500} c={score >= 50 ? 'green.4' : 'white/60'}>
              {score}
            </Text>
          );
        },
        size: 80,
      },
      {
        accessorKey: 'last_enriched',
        header: 'Last Enriched',
        cell: ({ getValue }) => {
          const date = getValue<string>();
          if (!date) {
            return (
              <Badge size="xs" variant="light" color="yellow">
                Not enriched
              </Badge>
            );
          }
          const d = new Date(date);
          const daysSince = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
          return (
            <Tooltip label={d.toLocaleString()}>
              <Text size="xs" c={daysSince > 7 ? 'yellow.4' : 'dimmed'}>
                {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince}d ago`}
              </Text>
            </Tooltip>
          );
        },
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const company = row.original;
          return (
            <Group gap="xs" justify="flex-end" wrap="nowrap">
              <Tooltip label="View Intelligence">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/company/${company.domain}`);
                  }}
                >
                  <IconEye size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Refresh Data">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnrichCompany?.(company.domain);
                  }}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Visit Website">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  component="a"
                  href={`https://${company.domain}`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          );
        },
        size: 100,
      },
    ],
    [
      navigate,
      onEnrichCompany,
      getFilterValues,
      handleFilterChange,
      statusOptions,
      verticalOptions,
      partnerTechOptions,
    ]
  );

  // Create table instance
  const table = useReactTable({
    data: companies,
    columns,
    state: {
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: !!pagination,
    pageCount: pagination?.total_pages || -1,
  });

  const handleRowClick = useCallback(
    (domain: string) => {
      navigate(`/company/${domain}`);
    },
    [navigate]
  );

  // Count active filters
  const activeFilterCount = columnFilters.reduce(
    (acc, f) => acc + (f.values.length > 0 ? 1 : 0),
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Paper radius="lg" className="bg-white/5 border border-white/10 overflow-hidden">
        {/* Minimal Toolbar - just column visibility and export */}
        <div className="p-3 border-b border-white/10">
          <Group justify="space-between">
            <Group gap="xs">
              {activeFilterCount > 0 && (
                <Badge variant="light" color="blue" size="sm">
                  {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                Click column header dropdowns to filter
              </Text>
            </Group>

            <Group gap="xs">
              {/* Column visibility */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Tooltip label="Toggle columns">
                    <ActionIcon variant="subtle">
                      <IconColumns size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Visible Columns</Menu.Label>
                  {table.getAllLeafColumns().map((column) => {
                    if (column.id === 'actions') return null;
                    return (
                      <Menu.Item key={column.id} onClick={() => column.toggleVisibility()}>
                        <Checkbox
                          label={column.id}
                          checked={column.getIsVisible()}
                          onChange={() => {}}
                          size="xs"
                        />
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>

              {/* Export */}
              <Tooltip label="Export CSV">
                <ActionIcon variant="subtle">
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/5">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {/* Body */}
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="p-0">
                      <TableRowSkeleton columns={columns.length} />
                    </td>
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <Text c="dimmed">No companies found</Text>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {table.getRowModel().rows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => handleRowClick(row.original.domain)}
                      className="border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-4 py-3"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="p-4 border-t border-white/10">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </Text>
              <Pagination
                value={pagination.page}
                onChange={onPageChange || (() => {})}
                total={pagination.total_pages}
                size="sm"
                withEdges
                classNames={{
                  control: 'border-white/10 text-white/70 hover:bg-white/10',
                }}
              />
            </Group>
          </div>
        )}
      </Paper>
    </motion.div>
  );
}
