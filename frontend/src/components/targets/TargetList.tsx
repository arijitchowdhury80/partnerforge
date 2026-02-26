/**
 * TargetList Component - Algolia Brand + Excel-Style Filters
 * Version: 3.0.0 - Modular Table Filters Library
 *
 * - Uses shared TableFilters library for consistent Excel-style filtering
 * - Hover on row: Shows preview card with quick info
 * - Click on row: Opens slide-over drawer with full details
 * - Click column headers: Opens filter popups
 */

import { useState, useMemo, useCallback, useRef } from 'react';
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
  Button,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import { Fragment } from 'react';
import {
  IconArrowUp,
  IconArrowDown,
  IconSelector,
  IconFilter,
  IconFilterOff,
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
  IconSearch,
} from '@tabler/icons-react';
import type { Company } from '@/types';
import { CompanyDrawer } from '@/components/company/CompanyDrawer';
import { QuickLookCard } from '@/components/targets/QuickLookCard';
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
  NumericFilterHeader,
  STATUS_COLOR_MAP,
  TRAFFIC_RANGES,
  ICP_SCORE_RANGES,
  type FilterOption,
  type NumericRange,
} from '@/components/common/TableFilters';
import { COLORS, STATUS_MAP } from '@/lib/constants';
import { calculateCompositeScore, getStatusFromCompositeScore } from '@/services/scoring';

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
  onEnrichCompany?: (domain: string) => void | Promise<void>;
  columnFilters?: ColumnFilter[];
  onColumnFilterChange?: (column: string, values: string[]) => void;
  /** Traffic range filter */
  trafficRange?: NumericRange | null;
  onTrafficRangeChange?: (range: NumericRange | null) => void;
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

// Factor colors matching ScoreBreakdown
const FACTOR_COLORS = {
  fit: '#8b5cf6',      // Purple
  intent: '#f59e0b',   // Amber
  value: '#10b981',    // Emerald
  displacement: '#3b82f6', // Blue
};

function ScoreDisplay({ score }: { score: number }) {
  const color = score >= 80 ? STATUS_MAP.hot.bgColor : score >= 40 ? STATUS_MAP.warm.bgColor : GRAY_500;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 50, height: 8, borderRadius: 4, background: GRAY_200, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <Text size="md" fw={700} style={{ color, minWidth: 28 }}>{score}</Text>
    </div>
  );
}

// Composite score display with mini factor bars
function CompositeScoreCell({ company }: { company: Company }) {
  const compositeScore = calculateCompositeScore(company);
  const status = getStatusFromCompositeScore(compositeScore.total);
  const statusColor = STATUS_MAP[status].bgColor;

  return (
    <Tooltip
      label={
        <div style={{ fontSize: 11 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Composite Score: {compositeScore.total}</div>
          <div>Fit: {compositeScore.factors.fit} | Intent: {compositeScore.factors.intent}</div>
          <div>Value: {compositeScore.factors.value} | Displace: {compositeScore.factors.displacement}</div>
          <div style={{ marginTop: 4, opacity: 0.8 }}>
            {compositeScore.confidence} confidence ({compositeScore.dataCompleteness}% data)
          </div>
        </div>
      }
      withArrow
      multiline
      w={180}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'help' }}>
        {/* Total score number */}
        <Text size="lg" fw={800} style={{ color: statusColor, minWidth: 32 }}>
          {compositeScore.total}
        </Text>
        {/* Mini factor bars */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['fit', 'intent', 'value', 'displacement'] as const).map((key) => (
            <div
              key={key}
              style={{
                width: 4,
                height: 20,
                borderRadius: 2,
                background: GRAY_200,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: `${compositeScore.factors[key]}%`,
                  background: FACTOR_COLORS[key],
                  borderRadius: 2,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </Tooltip>
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
  trafficRange: externalTrafficRange,
  onTrafficRangeChange,
}: TargetListProps) {
  // Use allCompanies for filter options (so multi-select works), fallback to companies
  const companiesForOptions = allCompanies || companies;
  const [sorting, setSorting] = useState<SortingState>([{ id: 'icp_score', desc: true }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Local traffic filter state (used if no external control provided)
  const [localTrafficRange, setLocalTrafficRange] = useState<NumericRange | null>(null);
  const trafficRange = externalTrafficRange !== undefined ? externalTrafficRange : localTrafficRange;
  const handleTrafficRangeChange = onTrafficRangeChange || setLocalTrafficRange;

  // Local ICP score filter state
  const [icpScoreRange, setIcpScoreRange] = useState<NumericRange | null>(null);

  // Traffic sort direction
  const trafficSortDirection = sorting.find(s => s.id === 'sw_monthly_visits')?.desc
    ? 'desc' as const
    : sorting.find(s => s.id === 'sw_monthly_visits')
    ? 'asc' as const
    : null;

  // ICP score sort direction
  const icpSortDirection = sorting.find(s => s.id === 'icp_score')?.desc
    ? 'desc' as const
    : sorting.find(s => s.id === 'icp_score')
    ? 'asc' as const
    : null;

  // Drawer state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [drawerOpened, setDrawerOpened] = useState(false);

  // Hover preview state
  const [hoveredCompany, setHoveredCompany] = useState<Company | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDrawer = useCallback((company: Company) => {
    // Clear any hover state when opening drawer
    setHoveredCompany(null);
    setHoveredRowId(null);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    setSelectedCompany(company);
    setDrawerOpened(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpened(false);
  }, []);

  // Hover handlers with 300ms delay
  const handleRowMouseEnter = useCallback((company: Company, rowId: string) => {
    // Clear any existing timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    // Set timer to show preview after 300ms
    hoverTimerRef.current = setTimeout(() => {
      setHoveredCompany(company);
      setHoveredRowId(rowId);
    }, 300);
  }, []);

  const handleRowMouseLeave = useCallback(() => {
    // Clear the timer
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    // Don't immediately hide - allow moving to the preview card
  }, []);

  const handleQuickLookClose = useCallback(() => {
    setHoveredCompany(null);
    setHoveredRowId(null);
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
        header: () => (
          <NumericFilterHeader
            label="Score"
            ranges={ICP_SCORE_RANGES}
            selectedRange={icpScoreRange}
            onFilterChange={setIcpScoreRange}
            sortable={true}
            sortDirection={icpSortDirection}
            onSortChange={(dir) => {
              setSorting([{ id: 'icp_score', desc: dir === 'desc' }]);
            }}
          />
        ),
        cell: ({ row }) => <CompositeScoreCell company={row.original} />,
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
            label="Tech Stack"
            options={partnerTechOptions}
            selectedValues={getFilterValues('partner_tech')}
            onFilterChange={(values) => handleFilterChange('partner_tech', values)}
          />
        ),
        cell: ({ getValue, row }) => {
          const partnerTechs = getValue<string[]>() || [];
          const company = row.original;
          const techStackData = company.tech_stack_data;

          // Build a list of techs to display with their logos
          const displayTechs: { name: string; logo: typeof AdobeLogo; color?: string }[] = [];

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

          // Add partner tech
          for (const tech of partnerTechs) {
            displayTechs.push({ name: tech, logo: getTechLogo(tech) });
          }

          // Add search provider from tech_stack_data (if competitive)
          if (techStackData?.search_provider && !techStackData.search_provider.toLowerCase().includes('algolia')) {
            const searchName = techStackData.search_provider;
            if (!displayTechs.some(t => t.name.toLowerCase().includes(searchName.toLowerCase()))) {
              displayTechs.push({
                name: `Search: ${searchName}`,
                logo: getTechLogo(searchName),
                color: 'red', // Highlight competitive search
              });
            }
          }

          // Add e-commerce platform from tech_stack_data
          if (techStackData?.ecommerce_platform) {
            const ecomName = techStackData.ecommerce_platform;
            if (!displayTechs.some(t => t.name.toLowerCase().includes(ecomName.toLowerCase()))) {
              displayTechs.push({
                name: ecomName,
                logo: getTechLogo(ecomName),
              });
            }
          }

          if (displayTechs.length === 0) return <Text size="md" c={GRAY_400}>—</Text>;

          return (
            <Group gap={6} wrap="nowrap">
              {displayTechs.slice(0, 4).map((tech, idx) => {
                const LogoComponent = tech.logo;
                return (
                  <Tooltip key={`${tech.name}-${idx}`} label={tech.name} withArrow position="top">
                    <div
                      style={{
                        cursor: 'pointer',
                        border: tech.color === 'red' ? '2px solid #dc2626' : undefined,
                        borderRadius: tech.color === 'red' ? 4 : undefined,
                        padding: tech.color === 'red' ? 2 : undefined,
                      }}
                    >
                      <LogoComponent size={28} />
                    </div>
                  </Tooltip>
                );
              })}
              {displayTechs.length > 4 && (
                <Tooltip label={displayTechs.slice(4).map(t => t.name).join(', ')} withArrow>
                  <Badge size="sm" variant="light" color="gray" styles={{ root: { fontWeight: 600, fontSize: 11 } }}>
                    +{displayTechs.length - 4}
                  </Badge>
                </Tooltip>
              )}
            </Group>
          );
        },
        size: 200,
      },
      {
        accessorKey: 'sw_monthly_visits',
        header: () => (
          <NumericFilterHeader
            label="Traffic"
            ranges={TRAFFIC_RANGES}
            selectedRange={trafficRange}
            onFilterChange={handleTrafficRangeChange}
            unit="Monthly"
            sortable={true}
            sortDirection={trafficSortDirection}
            onSortChange={(dir) => {
              setSorting([{ id: 'sw_monthly_visits', desc: dir === 'desc' }]);
            }}
          />
        ),
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
        size: 140,
      },
    ],
    [statusOptions, verticalOptions, partnerTechOptions, getFilterValues, handleFilterChange, trafficRange, trafficSortDirection, handleTrafficRangeChange, icpScoreRange, icpSortDirection, setIcpScoreRange, setSorting]
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

  // Clear all filters handler (must be before early returns for hooks rules)
  const handleClearAllFilters = useCallback(() => {
    // Clear all column filters
    columnFilters.forEach((filter) => {
      onColumnFilterChange?.(filter.column, []);
    });
    // Clear numeric filters
    onTrafficRangeChange?.(null);
    setIcpScoreRange(null); // Internal state
  }, [columnFilters, onColumnFilterChange, onTrafficRangeChange]);

  // Check if any filters are active
  const hasActiveFilters = activeFilterCount > 0 || trafficRange || icpScoreRange;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Loader color={ALGOLIA_BLUE} size="md" />
      </div>
    );
  }

  if (companies.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 64 }}>
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            {hasActiveFilters ? <IconFilterOff size={32} /> : <IconSearch size={32} />}
          </ThemeIcon>
          <div>
            <Text fw={600} size="lg" c={GRAY_700} mb={4}>
              {hasActiveFilters ? 'No matching companies' : 'No companies found'}
            </Text>
            <Text c={GRAY_500} size="sm" maw={400} style={{ margin: '0 auto' }}>
              {hasActiveFilters
                ? 'Try adjusting your filters or search criteria to find more results.'
                : 'There are no companies in this view. Upload a list or adjust your partner selection.'}
            </Text>
          </div>
          {hasActiveFilters && (
            <Button
              variant="light"
              color="blue"
              leftSection={<IconFilterOff size={16} />}
              onClick={handleClearAllFilters}
            >
              Clear All Filters
            </Button>
          )}
        </Stack>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Filter indicator - Sticky at top */}
      {activeFilterCount > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: `1px solid ${GRAY_200}`, background: GRAY_50, flexShrink: 0 }}>
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

      {/* Scrollable Table Container */}
      <div style={{ flex: 1, overflow: 'auto', background: 'white' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
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
                      boxShadow: '0 1px 0 0 #e2e8f0',
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
              <Fragment key={row.id}>
                <tr
                  onClick={() => handleRowClick(row.original)}
                  style={{
                    borderBottom: hoveredRowId === row.id ? 'none' : `1px solid ${GRAY_100}`,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                    background: hoveredRowId === row.id ? '#f0f4ff' : 'white',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoveredRowId === row.id ? '#f0f4ff' : GRAY_50;
                    handleRowMouseEnter(row.original, row.id);
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hoveredRowId === row.id ? '#f0f4ff' : 'white';
                    handleRowMouseLeave();
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
                {/* Quick Look Preview Card - shown below hovered row */}
                {hoveredRowId === row.id && hoveredCompany && (
                  <tr key={`${row.id}-preview`}>
                    <td
                      colSpan={columns.length}
                      style={{ padding: 0, border: 'none' }}
                      onMouseEnter={() => {
                        // Keep preview open when mouse is over it
                        if (hoverTimerRef.current) {
                          clearTimeout(hoverTimerRef.current);
                        }
                      }}
                      onMouseLeave={() => {
                        // Close preview when mouse leaves
                        handleQuickLookClose();
                      }}
                    >
                      <QuickLookCard
                        company={hoveredCompany}
                        onViewDetails={() => openDrawer(hoveredCompany)}
                        onClose={handleQuickLookClose}
                        onEnrich={onEnrichCompany}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination - Fixed at bottom */}
      {pagination && pagination.total_pages > 1 && (
        <div style={{ padding: '12px 16px', borderTop: `1px solid ${GRAY_200}`, background: 'white', flexShrink: 0 }}>
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
