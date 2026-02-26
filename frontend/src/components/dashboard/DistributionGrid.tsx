/**
 * Multi-Dimensional Distribution Grid
 *
 * Pivot table/grid that displays data aggregated by different dimensions:
 * - Partner View: Rows = Partners, Cols = Verticals
 * - Product View: Rows = Products, Cols = Verticals
 * - Vertical View: Rows = Verticals, Cols = ICP Tiers
 * - Account View: Simple paginated list
 */

import { useMemo, useState } from 'react';
import {
  Paper,
  Table,
  Text,
  Group,
  Badge,
  Tooltip,
  Box,
  Pagination,
  Stack,
  ScrollArea,
} from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import type { DisplacementTarget } from '@/services/supabase';
import type { ViewMode } from './ViewModeToggle';

// =============================================================================
// Types
// =============================================================================

interface DistributionGridProps {
  viewMode: ViewMode;
  targets: DisplacementTarget[];
  onCellClick: (rowKey: string, colKey: string, targets: DisplacementTarget[]) => void;
}

interface GridCell {
  count: number;
  targets: DisplacementTarget[];
  percentage?: number;
}

interface GridRow {
  key: string;
  label: string;
  cells: Record<string, GridCell>;
  total: number;
  totalPercentage: number;
}

// =============================================================================
// Constants
// =============================================================================

// Known partners
const PARTNERS = ['Adobe', 'Amplience', 'Spryker', 'Shopify', 'BigCommerce', 'Other'];

// Known products (more granular than partners)
const PRODUCTS = [
  'Adobe AEM',
  'Adobe Commerce',
  'Amplience DXP',
  'Spryker Commerce',
  'Shopify Plus',
  'BigCommerce',
  'Other',
];

// Verticals
const VERTICALS = ['Automotive', 'Retail', 'Healthcare', 'Finance', 'Media', 'Technology', 'Manufacturing', 'Other'];

// ICP Tiers (3-tier system)
const ICP_TIERS = [
  { key: 'hot', label: 'HOT (80-100)', color: '#ef4444', min: 80, max: 100 },
  { key: 'warm', label: 'WARM (40-79)', color: '#f97316', min: 40, max: 79 },
  { key: 'cold', label: 'COLD (0-39)', color: '#6b7280', min: 0, max: 39 },
];

// =============================================================================
// Utility Functions
// =============================================================================

function normalizePartner(partnerTech: string | null | undefined): string {
  if (!partnerTech) return 'Other';
  const lower = partnerTech.toLowerCase();
  if (lower.includes('adobe') || lower.includes('aem')) return 'Adobe';
  if (lower.includes('amplience')) return 'Amplience';
  if (lower.includes('spryker')) return 'Spryker';
  if (lower.includes('shopify')) return 'Shopify';
  if (lower.includes('bigcommerce')) return 'BigCommerce';
  return 'Other';
}

function normalizeProduct(partnerTech: string | null | undefined): string {
  if (!partnerTech) return 'Other';
  const lower = partnerTech.toLowerCase();
  if (lower.includes('aem') || lower.includes('experience manager')) return 'Adobe AEM';
  if (lower.includes('adobe commerce') || lower.includes('magento')) return 'Adobe Commerce';
  if (lower.includes('amplience')) return 'Amplience DXP';
  if (lower.includes('spryker')) return 'Spryker Commerce';
  if (lower.includes('shopify')) return 'Shopify Plus';
  if (lower.includes('bigcommerce')) return 'BigCommerce';
  return 'Other';
}

function normalizeVertical(vertical: string | null | undefined): string {
  if (!vertical) return 'Other';
  const lower = vertical.toLowerCase();
  if (lower.includes('auto')) return 'Automotive';
  if (lower.includes('retail') || lower.includes('commerce') || lower.includes('ecommerce')) return 'Retail';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('pharma')) return 'Healthcare';
  if (lower.includes('finance') || lower.includes('banking') || lower.includes('insurance')) return 'Finance';
  if (lower.includes('media') || lower.includes('entertainment') || lower.includes('publishing')) return 'Media';
  if (lower.includes('tech') || lower.includes('software') || lower.includes('saas')) return 'Technology';
  if (lower.includes('manufact') || lower.includes('industrial')) return 'Manufacturing';
  return 'Other';
}

function getIcpTier(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'cold';
  if (score >= 80) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

function getIcpTierLabel(tierKey: string): string {
  const tier = ICP_TIERS.find((t) => t.key === tierKey);
  return tier?.label || tierKey;
}

function getIcpTierColor(tierKey: string): string {
  const tier = ICP_TIERS.find((t) => t.key === tierKey);
  return tier?.color || '#6b7280';
}

// =============================================================================
// Grid Building Functions
// =============================================================================

function buildPartnerVerticalGrid(targets: DisplacementTarget[]): GridRow[] {
  const grid: Record<string, Record<string, DisplacementTarget[]>> = {};
  const grandTotal = targets.length;

  // Initialize grid
  PARTNERS.forEach((partner) => {
    grid[partner] = {};
    VERTICALS.forEach((vertical) => {
      grid[partner][vertical] = [];
    });
  });

  // Populate grid
  targets.forEach((target) => {
    const partner = normalizePartner(target.partner_tech);
    const vertical = normalizeVertical(target.vertical);
    if (grid[partner] && grid[partner][vertical]) {
      grid[partner][vertical].push(target);
    }
  });

  // Convert to GridRow format
  return PARTNERS.map((partner) => {
    const cells: Record<string, GridCell> = {};
    let rowTotal = 0;

    VERTICALS.forEach((vertical) => {
      const cellTargets = grid[partner][vertical];
      cells[vertical] = {
        count: cellTargets.length,
        targets: cellTargets,
        percentage: grandTotal > 0 ? (cellTargets.length / grandTotal) * 100 : 0,
      };
      rowTotal += cellTargets.length;
    });

    return {
      key: partner,
      label: partner,
      cells,
      total: rowTotal,
      totalPercentage: grandTotal > 0 ? (rowTotal / grandTotal) * 100 : 0,
    };
  }).filter((row) => row.total > 0); // Only show rows with data
}

function buildProductVerticalGrid(targets: DisplacementTarget[]): GridRow[] {
  const grid: Record<string, Record<string, DisplacementTarget[]>> = {};
  const grandTotal = targets.length;

  // Initialize grid
  PRODUCTS.forEach((product) => {
    grid[product] = {};
    VERTICALS.forEach((vertical) => {
      grid[product][vertical] = [];
    });
  });

  // Populate grid
  targets.forEach((target) => {
    const product = normalizeProduct(target.partner_tech);
    const vertical = normalizeVertical(target.vertical);
    if (grid[product] && grid[product][vertical]) {
      grid[product][vertical].push(target);
    }
  });

  // Convert to GridRow format
  return PRODUCTS.map((product) => {
    const cells: Record<string, GridCell> = {};
    let rowTotal = 0;

    VERTICALS.forEach((vertical) => {
      const cellTargets = grid[product][vertical];
      cells[vertical] = {
        count: cellTargets.length,
        targets: cellTargets,
        percentage: grandTotal > 0 ? (cellTargets.length / grandTotal) * 100 : 0,
      };
      rowTotal += cellTargets.length;
    });

    return {
      key: product,
      label: product,
      cells,
      total: rowTotal,
      totalPercentage: grandTotal > 0 ? (rowTotal / grandTotal) * 100 : 0,
    };
  }).filter((row) => row.total > 0);
}

function buildVerticalIcpGrid(targets: DisplacementTarget[]): GridRow[] {
  const grid: Record<string, Record<string, DisplacementTarget[]>> = {};
  const grandTotal = targets.length;

  // Initialize grid
  VERTICALS.forEach((vertical) => {
    grid[vertical] = {};
    ICP_TIERS.forEach((tier) => {
      grid[vertical][tier.key] = [];
    });
  });

  // Populate grid
  targets.forEach((target) => {
    const vertical = normalizeVertical(target.vertical);
    const tier = getIcpTier(target.icp_score);
    if (grid[vertical] && grid[vertical][tier]) {
      grid[vertical][tier].push(target);
    }
  });

  // Convert to GridRow format
  return VERTICALS.map((vertical) => {
    const cells: Record<string, GridCell> = {};
    let rowTotal = 0;

    ICP_TIERS.forEach((tier) => {
      const cellTargets = grid[vertical][tier.key];
      cells[tier.key] = {
        count: cellTargets.length,
        targets: cellTargets,
        percentage: grandTotal > 0 ? (cellTargets.length / grandTotal) * 100 : 0,
      };
      rowTotal += cellTargets.length;
    });

    return {
      key: vertical,
      label: vertical,
      cells,
      total: rowTotal,
      totalPercentage: grandTotal > 0 ? (rowTotal / grandTotal) * 100 : 0,
    };
  }).filter((row) => row.total > 0);
}

// =============================================================================
// Cell Component
// =============================================================================

interface GridCellProps {
  cell: GridCell;
  rowKey: string;
  colKey: string;
  onClick: (rowKey: string, colKey: string, targets: DisplacementTarget[]) => void;
  isTotal?: boolean;
  tierColor?: string;
}

function GridCellComponent({ cell, rowKey, colKey, onClick, isTotal = false, tierColor }: GridCellProps) {
  const handleClick = () => {
    if (cell.count > 0) {
      onClick(rowKey, colKey, cell.targets);
    }
  };

  return (
    <Table.Td
      onClick={handleClick}
      style={{
        cursor: cell.count > 0 ? 'pointer' : 'default',
        backgroundColor: isTotal ? 'var(--mantine-color-gray-0)' : undefined,
        transition: 'background-color 150ms ease',
        textAlign: 'center',
        borderLeft: tierColor ? `3px solid ${tierColor}` : undefined,
      }}
      className={cell.count > 0 ? 'hover:bg-gray-100' : ''}
    >
      <Text
        size="sm"
        fw={isTotal ? 700 : cell.count > 0 ? 600 : 400}
        c={cell.count > 0 ? '#1e293b' : '#94a3b8'}
      >
        {cell.count.toLocaleString()}
      </Text>
    </Table.Td>
  );
}

// =============================================================================
// Account List Component (for Account View)
// =============================================================================

interface AccountListProps {
  targets: DisplacementTarget[];
  onRowClick: (target: DisplacementTarget) => void;
}

function AccountList({ targets, onRowClick }: AccountListProps) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.ceil(targets.length / pageSize);

  const paginatedTargets = useMemo(() => {
    const start = (page - 1) * pageSize;
    return targets.slice(start, start + pageSize);
  }, [targets, page]);

  return (
    <Stack gap="md">
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Company</Table.Th>
            <Table.Th>Domain</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>Partner</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>Vertical</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>ICP Score</Table.Th>
            <Table.Th style={{ textAlign: 'center' }}>Traffic</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginatedTargets.map((target) => (
            <Table.Tr
              key={target.id}
              onClick={() => onRowClick(target)}
              style={{ cursor: 'pointer' }}
            >
              <Table.Td>
                <Text fw={500}>{target.company_name || target.domain}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="#64748b">{target.domain}</Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Badge size="sm" variant="light">
                  {normalizePartner(target.partner_tech)}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Badge size="sm" variant="outline" color="gray">
                  {normalizeVertical(target.vertical)}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Badge
                  size="sm"
                  color={
                    (target.icp_score || 0) >= 80
                      ? 'red'
                      : (target.icp_score || 0) >= 40
                      ? 'orange'
                      : 'gray'
                  }
                >
                  {target.icp_score || 0}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm">
                  {target.sw_monthly_visits
                    ? `${(target.sw_monthly_visits / 1000000).toFixed(1)}M`
                    : '-'}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination
            total={totalPages}
            value={page}
            onChange={setPage}
            size="sm"
          />
        </Group>
      )}
    </Stack>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DistributionGrid({ viewMode, targets, onCellClick }: DistributionGridProps) {
  // Build grid data based on view mode
  const { rows, columns, columnLabels, title, description } = useMemo(() => {
    switch (viewMode) {
      case 'partner':
        return {
          rows: buildPartnerVerticalGrid(targets),
          columns: VERTICALS,
          columnLabels: VERTICALS,
          title: 'Partner x Vertical Distribution',
          description: 'Target counts by partner technology and industry vertical',
        };
      case 'product':
        return {
          rows: buildProductVerticalGrid(targets),
          columns: VERTICALS,
          columnLabels: VERTICALS,
          title: 'Product x Vertical Distribution',
          description: 'Target counts by specific product and industry vertical',
        };
      case 'vertical':
        return {
          rows: buildVerticalIcpGrid(targets),
          columns: ICP_TIERS.map((t) => t.key),
          columnLabels: ICP_TIERS.map((t) => t.label),
          title: 'Vertical x ICP Tier Distribution',
          description: 'Target counts by vertical and ICP score tier',
        };
      default:
        return {
          rows: [],
          columns: [],
          columnLabels: [],
          title: 'Account List',
          description: 'All displacement targets',
        };
    }
  }, [viewMode, targets]);

  // Calculate column totals
  const columnTotals = useMemo(() => {
    const totals: Record<string, GridCell> = {};
    const grandTotal = targets.length;

    columns.forEach((col) => {
      const colTargets: DisplacementTarget[] = [];
      rows.forEach((row) => {
        if (row.cells[col]) {
          colTargets.push(...row.cells[col].targets);
        }
      });
      totals[col] = {
        count: colTargets.length,
        targets: colTargets,
        percentage: grandTotal > 0 ? (colTargets.length / grandTotal) * 100 : 0,
      };
    });

    return totals;
  }, [rows, columns, targets]);

  // Grand total
  const grandTotal = targets.length;

  // Handle account view separately
  if (viewMode === 'account') {
    return (
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Text fw={500}>{title}</Text>
            <Tooltip label={description} position="right" withArrow>
              <IconInfoCircle size={16} style={{ cursor: 'help', color: '#64748b' }} />
            </Tooltip>
          </Group>
          <Badge variant="light" size="lg">
            {grandTotal.toLocaleString()} accounts
          </Badge>
        </Group>
        <AccountList
          targets={targets}
          onRowClick={(target) => onCellClick(target.domain, 'account', [target])}
        />
      </Paper>
    );
  }

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Text fw={500}>{title}</Text>
          <Tooltip label={description} position="right" withArrow multiline w={250}>
            <IconInfoCircle size={16} style={{ cursor: 'help', color: 'var(--mantine-color-dimmed)' }} />
          </Tooltip>
        </Group>
        <Group gap="xs">
          <Text size="sm" c="#64748b" fw={500}>Total:</Text>
          <Badge variant="filled" size="lg">
            {grandTotal.toLocaleString()}
          </Badge>
        </Group>
      </Group>

      <ScrollArea>
        <Table striped withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 140 }}>
                {viewMode === 'partner' && 'PARTNER'}
                {viewMode === 'product' && 'PRODUCT'}
                {viewMode === 'vertical' && 'VERTICAL'}
              </Table.Th>
              {columnLabels.map((label, idx) => (
                <Table.Th
                  key={columns[idx]}
                  style={{
                    textAlign: 'center',
                    minWidth: 100,
                    backgroundColor:
                      viewMode === 'vertical' ? `${getIcpTierColor(columns[idx])}15` : undefined,
                  }}
                >
                  <Text
                    size="xs"
                    fw={700}
                    style={{
                      color: viewMode === 'vertical' ? getIcpTierColor(columns[idx]) : '#334155',
                    }}
                  >
                    {label}
                  </Text>
                </Table.Th>
              ))}
              <Table.Th
                style={{
                  textAlign: 'center',
                  minWidth: 100,
                  backgroundColor: 'var(--mantine-color-gray-1)',
                }}
              >
                <Text size="xs" fw={700}>TOTAL</Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>
                  <Text fw={600} size="sm" c="#1e293b">{row.label}</Text>
                </Table.Td>
                {columns.map((col) => (
                  <GridCellComponent
                    key={col}
                    cell={row.cells[col]}
                    rowKey={row.key}
                    colKey={col}
                    onClick={onCellClick}
                    tierColor={viewMode === 'vertical' ? getIcpTierColor(col) : undefined}
                  />
                ))}
                <Table.Td
                  style={{
                    textAlign: 'center',
                    backgroundColor: 'var(--mantine-color-gray-0)',
                  }}
                >
                  <Group gap={4} justify="center">
                    <Text size="sm" fw={700}>
                      {row.total.toLocaleString()}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {row.totalPercentage.toFixed(1)}%
                    </Badge>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}

            {/* Totals Row */}
            <Table.Tr style={{ backgroundColor: 'var(--mantine-color-gray-1)' }}>
              <Table.Td>
                <Text fw={700} size="sm">TOTAL</Text>
              </Table.Td>
              {columns.map((col) => (
                <Table.Td key={col} style={{ textAlign: 'center' }}>
                  <Group gap={4} justify="center">
                    <Text size="sm" fw={700}>
                      {columnTotals[col]?.count.toLocaleString() || 0}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {(columnTotals[col]?.percentage ?? 0).toFixed(1)}%
                    </Badge>
                  </Group>
                </Table.Td>
              ))}
              <Table.Td
                style={{
                  textAlign: 'center',
                  backgroundColor: 'var(--mantine-color-blue-0)',
                }}
              >
                <Text size="sm" fw={700} c="blue">
                  {grandTotal.toLocaleString()}
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Legend for ICP Tiers in Vertical View */}
      {viewMode === 'vertical' && (
        <Group justify="center" mt="md" gap="lg">
          {ICP_TIERS.map((tier) => (
            <Tooltip key={tier.key} label={`Score ${tier.min}-${tier.max}`} withArrow>
              <Group gap={4} style={{ cursor: 'help' }}>
                <Box
                  w={12}
                  h={12}
                  style={{ backgroundColor: tier.color, borderRadius: 2 }}
                />
                <Text size="xs" c="#64748b" fw={500}>{tier.label.split(' ')[0]}</Text>
              </Group>
            </Tooltip>
          ))}
        </Group>
      )}
    </Paper>
  );
}
