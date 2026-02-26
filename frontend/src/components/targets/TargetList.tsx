/**
 * TargetList Component - Algolia Brand + Excel-Style Filters
 * Version: 2.5.0 - Hover Preview + Slide-over Drawer
 *
 * - Hover on row: Shows preview card with quick info
 * - Click on row: Opens slide-over drawer with full details
 * - Click column headers: Opens filter popups
 */

import { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  IconArrowUp,
  IconArrowDown,
  IconSelector,
  IconChevronDown,
  IconX,
  IconFilter,
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
} from '@tabler/icons-react';
import type { Company } from '@/types';
import { CompanyDrawer } from '@/components/company/CompanyDrawer';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import {
  AdobeLogo,
  AmplienceLogo,
  SprykerLogo,
  ShopifyLogo,
  BigCommerceLogo,
  SalesforceLogo,
  SAPLogo,
  CommercetoolsLogo,
  MagentoLogo,
  ElasticsearchLogo,
  AllPartnersLogo,
} from '@/components/common/PartnerLogos';

// Algolia Brand Colors (Official)
const ALGOLIA_NEBULA_BLUE = '#003DFF';   // Primary - CTAs, headers
const ALGOLIA_SPACE_GRAY = '#21243D';    // Body text, headings
const ALGOLIA_PURPLE = '#5468FF';        // Accents, highlights
const ALGOLIA_WHITE = '#FFFFFF';         // Backgrounds
const ALGOLIA_LIGHT_GRAY = '#F5F5F7';    // Alternating sections
const ALGOLIA_BORDER = '#E8E8ED';        // Borders

// Legacy aliases for compatibility
const ALGOLIA_BLUE = ALGOLIA_NEBULA_BLUE;
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = ALGOLIA_BORDER;
const GRAY_400 = '#94a3b8';
const GRAY_500 = '#64748b';
const GRAY_700 = ALGOLIA_SPACE_GRAY;
const GRAY_900 = ALGOLIA_SPACE_GRAY;

// Status colors - Enterprise grade visibility
const STATUS_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  hot: { bg: '#dc2626', text: '#ffffff', badge: 'red' },
  warm: { bg: '#ea580c', text: '#ffffff', badge: 'orange' },
  cold: { bg: '#64748b', text: '#ffffff', badge: 'gray' },
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
  /** All companies BEFORE filtering - used for building filter options */
  allCompanies?: Company[];
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
// Excel-Style Filter Header Component - WITH APPLY BUTTON
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

  // Check if pending differs from applied
  const hasPendingChanges = JSON.stringify(pendingValues.sort()) !== JSON.stringify([...selectedValues].sort());

  // Sort options by count (highest first)
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => b.count - a.count);
  }, [options]);

  // Toggle a value in PENDING state (doesn't apply yet)
  const togglePendingValue = (value: string) => {
    if (pendingValues.includes(value)) {
      setPendingValues(pendingValues.filter((v) => v !== value));
    } else {
      setPendingValues([...pendingValues, value]);
    }
  };

  // Select all in pending (clears filter)
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

          {/* Filter indicator */}
          {hasAppliedFilter ? (
            <Badge size="sm" variant="filled" color="blue" style={{ minWidth: 22 }}>
              {filterCount}
            </Badge>
          ) : (
            <IconChevronDown size={16} color={GRAY_500} style={{ opacity: 0.8 }} />
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

          {/* Filter options - SORTED BY COUNT */}
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
                      background: isChecked ? '#dbeafe' : '#f8fafc',
                      border: isChecked ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Group gap="sm">
                      <Checkbox
                        checked={isChecked}
                        onChange={() => {}}
                        size="sm"
                        color="blue"
                        styles={{ input: { cursor: 'pointer' } }}
                      />
                      {colorMap?.[option.value] ? (
                        <Badge size="md" color={colorMap[option.value]} variant="filled" tt="capitalize" styles={{ root: { color: '#fff' } }}>
                          {option.value}
                        </Badge>
                      ) : (
                        <Text size="sm" fw={500} c="#1e293b">
                          {option.value || '(empty)'}
                        </Text>
                      )}
                    </Group>
                    {/* COUNT - shows how many companies (dark for visibility) */}
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

// =============================================================================
// Simple Sort Header (for columns without filtering)
// =============================================================================

function SortHeader({ column, label }: { column: any; label: string }) {
  return (
    <UnstyledButton
      onClick={() => column.toggleSorting()}
      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
    >
      <Text size="sm" fw={700} c={GRAY_700} tt="uppercase">{label}</Text>
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
  const config = {
    hot: { bg: '#dc2626', icon: IconFlame, label: 'HOT' },
    warm: { bg: '#ea580c', icon: IconTrendingUp, label: 'WARM' },
    cold: { bg: '#64748b', icon: IconSnowflake, label: 'COLD' },
  };
  const { bg, icon: Icon, label } = config[status] || config.cold;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 14px',
        borderRadius: 6,
        background: bg,
        color: 'white',
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: '0.5px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
      }}
    >
      <Icon size={16} stroke={2.5} />
      {label}
    </div>
  );
}

function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 80 ? '#dc2626' : score >= 40 ? '#ea580c' : GRAY_500;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 50, height: 8, borderRadius: 4, background: GRAY_200, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <Text size="md" fw={700} style={{ color, minWidth: 28 }}>{score}</Text>
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
  allCompanies,
  isLoading = false,
  pagination,
  onPageChange,
  onEnrichCompany,
  columnFilters = [],
  onColumnFilterChange,
}: TargetListProps) {
  // Use allCompanies for filter options (so multi-select works), fallback to companies
  const companiesForOptions = allCompanies || companies;
  const [sorting, setSorting] = useState<SortingState>([{ id: 'icp_score', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Drawer state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [drawerOpened, setDrawerOpened] = useState(false);

  const openDrawer = useCallback((company: Company) => {
    setSelectedCompany(company);
    setDrawerOpened(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpened(false);
  }, []);

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

  // Build filter options with counts - uses UNFILTERED data so multi-select works
  // When a filter is active, options stay available for adding more selections
  const statusOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companiesForOptions.forEach((c) => {
      if (c.status) counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [companiesForOptions]);

  const verticalOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companiesForOptions.forEach((c) => {
      if (c.vertical) counts[c.vertical] = (counts[c.vertical] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [companiesForOptions]);

  const partnerTechOptions = useMemo<FilterOption[]>(() => {
    const counts: Record<string, number> = {};
    companiesForOptions.forEach((c) => {
      c.partner_tech?.forEach((tech) => {
        counts[tech] = (counts[tech] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }, [companiesForOptions]);

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
              <CompanyLogo
                domain={company.domain}
                companyName={company.company_name}
                size="sm"
                radius="md"
              />
              <div>
                <Text size="sm" fw={600} c="#1e293b" lineClamp={1}>
                  {company.company_name || company.domain}
                </Text>
                <Text size="xs" c="#64748b">
                  {company.domain}
                </Text>
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
          <Text size="sm" c="#475569" lineClamp={1}>
            {getValue<string>() || '—'}
          </Text>
        ),
        size: 180,
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
          if (techs.length === 0) return <Text size="md" c={GRAY_400}>—</Text>;

          // Map tech names to logo components
          const getTechLogo = (tech: string) => {
            const techLower = tech.toLowerCase();
            if (techLower.includes('adobe') || techLower.includes('aem')) return AdobeLogo;
            if (techLower.includes('amplience')) return AmplienceLogo;
            if (techLower.includes('spryker')) return SprykerLogo;
            if (techLower.includes('shopify')) return ShopifyLogo;
            if (techLower.includes('bigcommerce')) return BigCommerceLogo;
            if (techLower.includes('salesforce')) return SalesforceLogo;
            if (techLower.includes('sap')) return SAPLogo;
            if (techLower.includes('commercetools')) return CommercetoolsLogo;
            if (techLower.includes('magento')) return MagentoLogo;
            if (techLower.includes('elastic')) return ElasticsearchLogo;
            return AllPartnersLogo;
          };

          return (
            <Group gap={6} wrap="nowrap">
              {techs.slice(0, 4).map((tech) => {
                const LogoComponent = getTechLogo(tech);
                return (
                  <Tooltip key={tech} label={tech} withArrow position="top">
                    <div style={{ cursor: 'pointer' }}>
                      <LogoComponent size={28} />
                    </div>
                  </Tooltip>
                );
              })}
              {techs.length > 4 && (
                <Tooltip label={techs.slice(4).join(', ')} withArrow>
                  <Badge size="sm" variant="light" color="gray" styles={{ root: { fontWeight: 600, fontSize: 11 } }}>
                    +{techs.length - 4}
                  </Badge>
                </Tooltip>
              )}
            </Group>
          );
        },
        size: 180,
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
                size="md"
                c={visits && visits > 1000000 ? 'green' : GRAY_700}
                fw={600}
              >
                {formatTraffic(visits)}
              </Anchor>
            </Tooltip>
          );
        },
        size: 110,
      },
    ],
    [openDrawer, statusOptions, verticalOptions, partnerTechOptions, getFilterValues, handleFilterChange]
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

  const handleRowClick = useCallback((company: Company) => {
    openDrawer(company);
  }, [openDrawer]);

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
      <div style={{ overflowX: 'auto', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ borderBottom: `2px solid ${GRAY_200}`, background: 'white' }}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      width: header.getSize(),
                      background: 'white',
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
                  onClick={() => handleRowClick(row.original)}
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
                        background: 'inherit',
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

      {/* Company Detail Drawer */}
      <CompanyDrawer
        company={selectedCompany}
        opened={drawerOpened}
        onClose={closeDrawer}
        onEnrich={onEnrichCompany}
      />
    </div>
  );
}

export default TargetList;
