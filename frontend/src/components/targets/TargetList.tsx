/**
 * TargetList Component
 *
 * Premium data table for displacement targets using TanStack Table.
 * Features Excel-style column filters with counts, sorting, and DATA SOURCE TRANSPARENCY.
 *
 * All data is clickable to verify at source:
 * - Partner Tech → BuiltWith
 * - Traffic → SimilarWeb
 * - Domain → Company website
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
  Anchor,
  ThemeIcon,
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
  IconDatabase,
  IconWorld,
  IconBrandGoogle,
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
  columnFilters?: ColumnFilter[];
  onColumnFilterChange?: (column: string, values: string[]) => void;
}

// =============================================================================
// Source Link Helpers - For Data Transparency
// =============================================================================

/** Get BuiltWith URL for a domain */
function getBuiltWithUrl(domain: string): string {
  return `https://builtwith.com/${domain}`;
}

/** Get SimilarWeb URL for a domain */
function getSimilarWebUrl(domain: string): string {
  return `https://www.similarweb.com/website/${domain}/`;
}

/** Format traffic number */
function formatTraffic(visits: number | undefined): string {
  if (!visits) return '---';
  if (visits >= 1000000) return `${(visits / 1000000).toFixed(1)}M`;
  if (visits >= 1000) return `${(visits / 1000).toFixed(0)}K`;
  return visits.toString();
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

  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => b.count - a.count);
  }, [options]);

  return (
    <Group gap={4} wrap="nowrap">
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

      <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="lg" width={260}>
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
                <ActionIcon variant="subtle" size="xs" onClick={clearFilter} c="dimmed">
                  <IconX size={14} />
                </ActionIcon>
              )}
            </Group>

            <Divider color="white/10" />

            <Group gap="xs">
              <Button size="compact-xs" variant="subtle" color="gray" onClick={selectAll}>
                Select All
              </Button>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={clearFilter}>
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
                        background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        border: isSelected ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                        transition: 'all 0.15s ease',
                      }}
                      className="hover:bg-white/5"
                    >
                      <Group gap="xs">
                        <Checkbox checked={isSelected} onChange={() => {}} size="xs" styles={{ input: { cursor: 'pointer' } }} />
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

function SortHeader({ column, label }: { column: any; label: string }) {
  return (
    <UnstyledButton
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      <span>{label}</span>
      {{
        asc: <IconArrowUp size={12} />,
        desc: <IconArrowDown size={12} />,
      }[column.getIsSorted() as string] ?? <IconSelector size={12} className="opacity-30" />}
    </UnstyledButton>
  );
}

// =============================================================================
// Partner Tech Cell - CLICKABLE to BuiltWith for verification
// =============================================================================

function PartnerTechCell({ techs, domain }: { techs: string[]; domain: string }) {
  if (techs.length === 0) {
    return (
      <Tooltip label="No partner tech detected. Click to verify on BuiltWith." withArrow>
        <Anchor
          href={getBuiltWithUrl(domain)}
          target="_blank"
          size="xs"
          c="dimmed"
          onClick={(e) => e.stopPropagation()}
        >
          ---
        </Anchor>
      </Tooltip>
    );
  }

  return (
    <Tooltip
      label={
        <Stack gap={4}>
          <Text size="xs" fw={600}>Source: BuiltWith</Text>
          <Divider size="xs" />
          {techs.map((tech) => (
            <Text key={tech} size="xs">{tech}</Text>
          ))}
          <Divider size="xs" />
          <Text size="xs" c="dimmed">Click to verify →</Text>
        </Stack>
      }
      withArrow
      multiline
    >
      <Anchor
        href={getBuiltWithUrl(domain)}
        target="_blank"
        onClick={(e) => e.stopPropagation()}
        style={{ textDecoration: 'none' }}
      >
        <Group gap={4}>
          <Badge size="xs" variant="light" color="green" style={{ cursor: 'pointer' }}>
            {techs[0]}
          </Badge>
          {techs.length > 1 && (
            <Badge size="xs" variant="light" color="gray" style={{ cursor: 'pointer' }}>
              +{techs.length - 1}
            </Badge>
          )}
          <IconExternalLink size={10} style={{ opacity: 0.5 }} />
        </Group>
      </Anchor>
    </Tooltip>
  );
}

// =============================================================================
// Traffic Cell - CLICKABLE to SimilarWeb for verification
// =============================================================================

function TrafficCell({ visits, domain }: { visits: number | undefined; domain: string }) {
  const formatted = formatTraffic(visits);

  return (
    <Tooltip
      label={
        <Stack gap={4}>
          <Text size="xs" fw={600}>Source: SimilarWeb</Text>
          <Divider size="xs" />
          <Text size="xs">Monthly visits: {visits?.toLocaleString() || 'N/A'}</Text>
          <Text size="xs" c="dimmed">Click to verify →</Text>
        </Stack>
      }
      withArrow
    >
      <Anchor
        href={getSimilarWebUrl(domain)}
        target="_blank"
        onClick={(e) => e.stopPropagation()}
        size="sm"
        c={visits && visits > 1000000 ? 'green.4' : 'white/70'}
        fw={500}
      >
        {formatted}
        <IconExternalLink size={10} style={{ marginLeft: 4, opacity: 0.5 }} />
      </Anchor>
    </Tooltip>
  );
}

// =============================================================================
// Source Badge - Shows data freshness
// =============================================================================

function SourceBadge({ lastEnriched }: { lastEnriched: string | undefined }) {
  if (!lastEnriched) {
    return (
      <Tooltip label="Data has not been enriched yet. Click 'Refresh' to fetch fresh data." withArrow>
        <Badge size="xs" variant="light" color="yellow" style={{ cursor: 'help' }}>
          Not verified
        </Badge>
      </Tooltip>
    );
  }

  const d = new Date(lastEnriched);
  const daysSince = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  const isFresh = daysSince <= 7;
  const isStale = daysSince > 30;

  return (
    <Tooltip
      label={
        <Stack gap={4}>
          <Text size="xs" fw={600}>Data Sources:</Text>
          <Group gap={4}>
            <ThemeIcon size="xs" variant="light" color="blue"><IconDatabase size={10} /></ThemeIcon>
            <Text size="xs">BuiltWith (Tech)</Text>
          </Group>
          <Group gap={4}>
            <ThemeIcon size="xs" variant="light" color="orange"><IconWorld size={10} /></ThemeIcon>
            <Text size="xs">SimilarWeb (Traffic)</Text>
          </Group>
          <Divider size="xs" />
          <Text size="xs" c="dimmed">Last updated: {d.toLocaleDateString()}</Text>
        </Stack>
      }
      withArrow
      multiline
    >
      <Badge
        size="xs"
        variant="light"
        color={isFresh ? 'green' : isStale ? 'red' : 'yellow'}
        style={{ cursor: 'help' }}
      >
        {isFresh ? 'Fresh' : isStale ? 'Stale' : `${daysSince}d ago`}
      </Badge>
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

  const [sorting, setSorting] = useState<SortingState>([{ id: 'icp_score', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const getFilterValues = useCallback(
    (column: string) => {
      const filter = columnFilters.find((f) => f.column === column);
      return filter?.values || [];
    },
    [columnFilters]
  );

  const handleFilterChange = useCallback(
    (column: string, values: string[]) => {
      onColumnFilterChange?.(column, values);
    },
    [onColumnFilterChange]
  );

  // Build filter options with counts
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
            <div className="flex items-center gap-3">
              <Avatar size="sm" radius="md" color="blue" className="flex-shrink-0">
                {(company.company_name || company.domain).charAt(0).toUpperCase()}
              </Avatar>
              <div className="min-w-0">
                <Text size="sm" fw={500} c="white" truncate>
                  {company.company_name || company.domain}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <Anchor
                    href={`https://${company.domain}`}
                    target="_blank"
                    size="xs"
                    c="dimmed"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {company.domain}
                  </Anchor>
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
        size: 220,
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
        size: 90,
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
        cell: ({ getValue }) => <StatusBadge status={getValue<Company['status']>()} size="sm" />,
        size: 110,
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
          <Text size="sm" c="white/70" truncate style={{ maxWidth: 120 }}>
            {getValue<string>() || '---'}
          </Text>
        ),
        size: 130,
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
        cell: ({ row }) => (
          <PartnerTechCell techs={row.original.partner_tech || []} domain={row.original.domain} />
        ),
        size: 140,
      },
      {
        accessorKey: 'sw_monthly_visits',
        header: ({ column }) => <SortHeader column={column} label="Traffic" />,
        cell: ({ row }) => (
          <TrafficCell visits={row.original.sw_monthly_visits} domain={row.original.domain} />
        ),
        size: 90,
      },
      {
        accessorKey: 'last_enriched',
        header: 'Data Source',
        cell: ({ getValue }) => <SourceBadge lastEnriched={getValue<string>()} />,
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const company = row.original;
          return (
            <Group gap="xs" justify="flex-end" wrap="nowrap">
              <Tooltip label="View Full Intelligence Report">
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
              <Tooltip label="Refresh Data from BuiltWith & SimilarWeb">
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
              <Tooltip label="Visit Company Website">
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
    [navigate, onEnrichCompany, getFilterValues, handleFilterChange, statusOptions, verticalOptions, partnerTechOptions]
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

  const activeFilterCount = columnFilters.reduce((acc, f) => acc + (f.values.length > 0 ? 1 : 0), 0);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Paper radius="lg" className="bg-white/5 border border-white/10 overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-white/10">
          <Group justify="space-between">
            <Group gap="xs">
              {activeFilterCount > 0 && (
                <Badge variant="light" color="blue" size="sm">
                  {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                💡 Click column headers to filter • Click badges to verify at source
              </Text>
            </Group>

            <Group gap="xs">
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
                        <Checkbox label={column.id} checked={column.getIsVisible()} onChange={() => {}} size="xs" />
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>

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
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-white/10 bg-white/5">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

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
                        <td key={cell.id} className="px-4 py-3" style={{ width: cell.column.getSize() }}>
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
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
              </Text>
              <Pagination
                value={pagination.page}
                onChange={onPageChange || (() => {})}
                total={pagination.total_pages}
                size="sm"
                withEdges
                classNames={{ control: 'border-white/10 text-white/70 hover:bg-white/10' }}
              />
            </Group>
          </div>
        )}

        {/* Data Source Attribution Footer */}
        <div className="px-4 py-2 border-t border-white/10 bg-white/2">
          <Group gap="lg" justify="center">
            <Group gap={4}>
              <ThemeIcon size="xs" variant="light" color="blue"><IconDatabase size={10} /></ThemeIcon>
              <Text size="xs" c="dimmed">Tech: BuiltWith</Text>
            </Group>
            <Group gap={4}>
              <ThemeIcon size="xs" variant="light" color="orange"><IconWorld size={10} /></ThemeIcon>
              <Text size="xs" c="dimmed">Traffic: SimilarWeb</Text>
            </Group>
            <Text size="xs" c="dimmed">• Click any data to verify at source</Text>
          </Group>
        </div>
      </Paper>
    </motion.div>
  );
}
