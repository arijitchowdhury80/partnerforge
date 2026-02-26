/**
 * TargetList Component - Algolia Brand + Excel-Style Filters
 * Version: 3.0.0 - Modular Table Filters Library
 *
 * - Uses shared TableFilters library for consistent Excel-style filtering
 * - Hover on row: Shows preview card with quick info
 * - Click on row: Opens slide-over drawer with full details
 * - Click column headers: Opens filter popups
 */

import { useState, useMemo, useCallback } from 'react';
// Note: Removed framer-motion for performance - 5000 rows with staggered animations caused slowness
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
  Tooltip,
  Pagination,
  Anchor,
  Loader,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowUp,
  IconArrowDown,
  IconSelector,
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

// Import shared libraries - SINGLE SOURCE OF TRUTH
import {
  FilterHeader,
  STATUS_COLOR_MAP,
  type FilterOption,
} from '@/components/common/TableFilters';
import { COLORS } from '@/lib/constants';

// Use shared color constants - no more inline duplicates
const ALGOLIA_NEBULA_BLUE = COLORS.ALGOLIA_NEBULA_BLUE;
const ALGOLIA_SPACE_GRAY = COLORS.ALGOLIA_SPACE_GRAY;
const ALGOLIA_BLUE = COLORS.ALGOLIA_NEBULA_BLUE;
const GRAY_50 = COLORS.GRAY_50;
const GRAY_100 = COLORS.GRAY_100;
const GRAY_200 = COLORS.GRAY_200;
const GRAY_400 = COLORS.GRAY_400;
const GRAY_500 = COLORS.GRAY_500;
const GRAY_700 = COLORS.GRAY_700;

// Types
export interface ColumnFilter {
  column: string;
  values: string[];
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
// TanStack Table Sort Header Adapter
// This wraps TanStack Table's column API. For standalone use, import from TableFilters.
// =============================================================================

function TanStackSortHeader({ column, label }: { column: any; label: string }) {
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
      <Text size="sm" fw={700} c={isSorted ? ALGOLIA_NEBULA_BLUE : ALGOLIA_SPACE_GRAY} tt="uppercase">
        {label}
      </Text>
      {{
        asc: <IconArrowUp size={16} color={ALGOLIA_NEBULA_BLUE} strokeWidth={2.5} />,
        desc: <IconArrowDown size={16} color={ALGOLIA_NEBULA_BLUE} strokeWidth={2.5} />,
      }[isSorted as string] ?? <IconSelector size={16} color={ALGOLIA_SPACE_GRAY} strokeWidth={2} />}
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

  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: 'company_name',
        header: ({ column }) => <TanStackSortHeader column={column} label="Company" />,
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
        header: ({ column }) => <TanStackSortHeader column={column} label="ICP Score" />,
        cell: ({ getValue }) => <ScoreDisplay score={getValue<number>() || 0} />,
        size: 120,
      },
      {
        accessorKey: 'status',
        header: () => (
          <FilterHeader
            label="Status"
            options={statusOptions}
            selectedValues={getFilterValues('status')}
            onFilterChange={(values) => handleFilterChange('status', values)}
            colorMap={STATUS_COLOR_MAP}
            useCanonicalOrder={true}  // Always show Hot → Warm → Cold order
          />
        ),
        cell: ({ getValue }) => <StatusBadge status={getValue<Company['status']>()} />,
        size: 120,
      },
      {
        accessorKey: 'vertical',
        header: () => (
          <FilterHeader
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
        header: () => (
          <FilterHeader
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
        header: ({ column }) => <TanStackSortHeader column={column} label="Traffic" />,
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
    [statusOptions, verticalOptions, partnerTechOptions, getFilterValues, handleFilterChange]
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
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
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
              </tr>
            ))}
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
