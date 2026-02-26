/**
 * Multi-Dimensional Distribution Grid
 *
 * Pivot table/grid that displays data aggregated by different dimensions:
 * - Partner View: Rows = Partners, Cols = Verticals
 * - Product View: Rows = Products, Cols = Verticals
 * - Vertical View: Rows = Verticals, Cols = ICP Tiers
 * - Account View: Simple paginated list
 *
 * Enterprise-grade styling with Algolia branding for maximum readability.
 */

import { useMemo, useState } from 'react';
import {
  Table,
  Text,
  Group,
  Tooltip,
  Box,
  Stack,
  ScrollArea,
} from '@mantine/core';
import type { DisplacementTarget } from '@/services/supabase';
import type { ViewMode } from './ViewModeToggle';
import { TargetList } from '@/components/targets/TargetList';
import type { Company } from '@/types';
import type { Partner } from '@/contexts/PartnerContext';

// =============================================================================
// Type Conversion: DisplacementTarget -> Company
// =============================================================================

function convertTargetToCompany(target: DisplacementTarget): Company {
  const score = target.icp_score || 0;
  const status: 'hot' | 'warm' | 'cold' = score >= 80 ? 'hot' : score >= 40 ? 'warm' : 'cold';

  return {
    domain: target.domain,
    company_name: target.company_name || target.domain,
    ticker: target.ticker || undefined,
    is_public: target.is_public || false,
    headquarters: {
      city: '',
      state: '',
      country: target.country || '',
    },
    industry: target.vertical || 'Unknown',
    vertical: target.vertical || 'Unknown',
    icp_score: target.icp_score || 0,
    signal_score: 0,
    priority_score: 0,
    status,
    partner_tech: target.partner_tech ? [target.partner_tech] : [],
    last_enriched: target.last_enriched || undefined,
    sw_monthly_visits: target.sw_monthly_visits || undefined,
    revenue: target.revenue || undefined,
    current_search: target.current_search || undefined,
    enrichment_level: target.enrichment_level || undefined,
  };
}

// =============================================================================
// Types
// =============================================================================

interface DistributionGridProps {
  viewMode: ViewMode;
  targets: DisplacementTarget[];
  onCellClick: (rowKey: string, colKey: string, targets: DisplacementTarget[]) => void;
  selectedPartner?: Partner; // When set, Product view shows only this partner's products
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

// Algolia Brand Colors
const HEADER_BG = '#1e293b';
const HEADER_BG_LIGHT = '#334155';
const BODY_BG_WHITE = '#ffffff';
const BODY_BG_ALT = '#f8fafc';
const TOTALS_BG = '#e2e8f0';
const TOTALS_HIGHLIGHT = '#dbeafe';
const TEXT_DARK = '#0f172a';
const TEXT_MUTED = '#64748b';
const TEXT_LIGHT_MUTED = '#94a3b8';
const ALGOLIA_BLUE = '#1d4ed8';

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
  { key: 'hot', label: 'HOT (80-100)', color: '#dc2626', min: 80, max: 100 },
  { key: 'warm', label: 'WARM (40-79)', color: '#ea580c', min: 40, max: 79 },
  { key: 'cold', label: 'COLD (0-39)', color: '#64748b', min: 0, max: 39 },
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

function getIcpTierColor(tierKey: string): string {
  const tier = ICP_TIERS.find((t) => t.key === tierKey);
  return tier?.color || '#64748b';
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

// Map Partner product keys to display names for grid
function getProductDisplayName(partner: Partner, productKey: string): string {
  const product = partner.products.find(p => p.key === productKey);
  return product?.name || productKey;
}

// Check if a target's partner_tech matches a partner's product
function targetMatchesProduct(partnerTech: string | null | undefined, partner: Partner, productKey: string): boolean {
  if (!partnerTech) return false;
  const lower = partnerTech.toLowerCase();
  const product = partner.products.find(p => p.key === productKey);
  if (!product) return false;

  // Match by product name or shortName
  const productNameLower = product.name.toLowerCase();
  const shortNameLower = product.shortName.toLowerCase();

  return lower.includes(productNameLower) ||
         lower.includes(shortNameLower) ||
         productNameLower.includes(lower) ||
         // Special handling for common variations
         (productKey === 'aem' && (lower.includes('aem') || lower.includes('experience manager'))) ||
         (productKey === 'commerce' && (lower.includes('magento') || lower.includes('adobe commerce'))) ||
         (productKey === 'commerce-cloud' && lower.includes('commerce cloud')) ||
         (productKey === 'shopify-plus' && lower.includes('shopify plus')) ||
         (productKey === 'shopify' && lower.includes('shopify') && !lower.includes('plus'));
}

function buildProductVerticalGrid(targets: DisplacementTarget[], selectedPartner?: Partner): GridRow[] {
  const grandTotal = targets.length;

  // If no partner selected or "all", use fallback to static PRODUCTS list
  if (!selectedPartner || selectedPartner.key === 'all') {
    const grid: Record<string, Record<string, DisplacementTarget[]>> = {};

    // Initialize grid with static PRODUCTS
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

  // Partner is selected - show only that partner's products
  const partnerProducts = selectedPartner.products;
  const grid: Record<string, Record<string, DisplacementTarget[]>> = {};

  // Initialize grid with partner's products
  partnerProducts.forEach((product) => {
    grid[product.key] = {};
    VERTICALS.forEach((vertical) => {
      grid[product.key][vertical] = [];
    });
  });

  // Populate grid - match targets to partner products
  targets.forEach((target) => {
    const vertical = normalizeVertical(target.vertical);

    // Find which product this target belongs to
    for (const product of partnerProducts) {
      if (targetMatchesProduct(target.partner_tech, selectedPartner, product.key)) {
        if (grid[product.key] && grid[product.key][vertical]) {
          grid[product.key][vertical].push(target);
        }
        break; // Only count once
      }
    }
  });

  // Convert to GridRow format using partner's product names
  return partnerProducts.map((product) => {
    const cells: Record<string, GridCell> = {};
    let rowTotal = 0;

    VERTICALS.forEach((vertical) => {
      const cellTargets = grid[product.key][vertical];
      cells[vertical] = {
        count: cellTargets.length,
        targets: cellTargets,
        percentage: grandTotal > 0 ? (cellTargets.length / grandTotal) * 100 : 0,
      };
      rowTotal += cellTargets.length;
    });

    return {
      key: product.key,
      label: product.name, // Use full product name from Partner context
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
// Cell Component - Enterprise Grade Visibility
// =============================================================================

interface GridCellProps {
  cell: GridCell;
  rowKey: string;
  colKey: string;
  onClick: (rowKey: string, colKey: string, targets: DisplacementTarget[]) => void;
  isTotal?: boolean;
  tierColor?: string;
  rowBg?: string;
}

function GridCellComponent({ cell, rowKey, colKey, onClick, isTotal = false, tierColor, rowBg }: GridCellProps) {
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
        backgroundColor: isTotal ? BODY_BG_ALT : rowBg || 'transparent',
        transition: 'background-color 150ms ease',
        textAlign: 'center',
        borderLeft: tierColor ? `4px solid ${tierColor}` : undefined,
        padding: '14px 12px',
      }}
    >
      <Text
        fw={isTotal ? 700 : cell.count > 0 ? 600 : 400}
        style={{
          color: cell.count > 0 ? TEXT_DARK : TEXT_LIGHT_MUTED,
          fontSize: '16px',
        }}
      >
        {cell.count.toLocaleString()}
      </Text>
    </Table.Td>
  );
}

// AccountList component removed - now using shared TargetList component for consistency

// =============================================================================
// Main Component
// =============================================================================

export function DistributionGrid({ viewMode, targets, onCellClick, selectedPartner }: DistributionGridProps) {
  // Build grid data based on view mode
  const { rows, columns, columnLabels } = useMemo(() => {
    switch (viewMode) {
      case 'partner':
        return {
          rows: buildPartnerVerticalGrid(targets),
          columns: VERTICALS,
          columnLabels: VERTICALS,
        };
      case 'product':
        return {
          rows: buildProductVerticalGrid(targets, selectedPartner),
          columns: VERTICALS,
          columnLabels: VERTICALS,
        };
      case 'vertical':
        return {
          rows: buildVerticalIcpGrid(targets),
          columns: ICP_TIERS.map((t) => t.key),
          columnLabels: ICP_TIERS.map((t) => t.label),
        };
      default:
        return {
          rows: [],
          columns: [],
          columnLabels: [],
        };
    }
  }, [viewMode, targets, selectedPartner]);

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

  // Convert targets to Company type for TargetList
  const companiesForAccountView = useMemo(() => {
    return targets.map(convertTargetToCompany);
  }, [targets]);

  // Handle account view - uses the shared TargetList component for consistency
  if (viewMode === 'account') {
    return (
      <TargetList
        companies={companiesForAccountView}
        allCompanies={companiesForAccountView}
        isLoading={false}
      />
    );
  }

  return (
    <Stack gap="md">
      <ScrollArea>
        <Table withTableBorder withColumnBorders style={{ backgroundColor: BODY_BG_WHITE, borderRadius: '8px', overflow: 'hidden' }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 160, backgroundColor: HEADER_BG, padding: '14px 16px' }}>
                <Text style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {viewMode === 'partner' && 'Partner'}
                  {viewMode === 'product' && 'Product'}
                  {viewMode === 'vertical' && 'Vertical'}
                </Text>
              </Table.Th>
              {columnLabels.map((label, idx) => (
                <Table.Th
                  key={columns[idx]}
                  style={{
                    textAlign: 'center',
                    minWidth: 100,
                    backgroundColor: HEADER_BG,
                    padding: '14px 12px',
                  }}
                >
                  <Text style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {label}
                  </Text>
                </Table.Th>
              ))}
              <Table.Th
                style={{
                  textAlign: 'center',
                  minWidth: 100,
                  backgroundColor: HEADER_BG_LIGHT,
                  padding: '14px 12px',
                }}
              >
                <Text style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total
                </Text>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row, rowIdx) => {
              const rowBg = rowIdx % 2 === 0 ? BODY_BG_WHITE : BODY_BG_ALT;
              return (
                <Table.Tr key={row.key}>
                  <Table.Td style={{ backgroundColor: rowBg, padding: '14px 16px' }}>
                    <Text style={{ fontSize: '14px', fontWeight: 600, color: TEXT_DARK }}>{row.label}</Text>
                  </Table.Td>
                  {columns.map((col) => (
                    <GridCellComponent
                      key={col}
                      cell={row.cells[col]}
                      rowKey={row.key}
                      colKey={col}
                      onClick={onCellClick}
                      tierColor={viewMode === 'vertical' ? getIcpTierColor(col) : undefined}
                      rowBg={rowBg}
                    />
                  ))}
                  <Table.Td
                    style={{
                      textAlign: 'center',
                      backgroundColor: BODY_BG_ALT,
                      padding: '14px 12px',
                    }}
                  >
                    <Text style={{ fontSize: '14px', fontWeight: 700, color: TEXT_DARK }}>
                      {row.total.toLocaleString()}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}

            {/* Totals Row */}
            <Table.Tr>
              <Table.Td style={{ backgroundColor: TOTALS_BG, padding: '14px 16px' }}>
                <Text style={{ fontSize: '14px', fontWeight: 700, color: TEXT_DARK }}>TOTAL</Text>
              </Table.Td>
              {columns.map((col) => (
                <Table.Td key={col} style={{ textAlign: 'center', backgroundColor: TOTALS_BG, padding: '14px 12px' }}>
                  <Text style={{ fontSize: '14px', fontWeight: 700, color: TEXT_DARK }}>
                    {columnTotals[col]?.count.toLocaleString() || 0}
                  </Text>
                </Table.Td>
              ))}
              <Table.Td
                style={{
                  textAlign: 'center',
                  backgroundColor: TOTALS_HIGHLIGHT,
                  padding: '14px 12px',
                }}
              >
                <Text style={{ fontSize: '16px', fontWeight: 700, color: ALGOLIA_BLUE }}>
                  {grandTotal.toLocaleString()}
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </ScrollArea>

      {/* Legend for ICP Tiers in Vertical View */}
      {viewMode === 'vertical' && (
        <Group justify="center" gap="xl">
          {ICP_TIERS.map((tier) => (
            <Tooltip key={tier.key} label={`ICP Score ${tier.min}-${tier.max}`} withArrow>
              <Group gap={8} style={{ cursor: 'help' }}>
                <Box
                  w={14}
                  h={14}
                  style={{ backgroundColor: tier.color, borderRadius: 4 }}
                />
                <Text style={{ fontSize: '13px', color: TEXT_MUTED, fontWeight: 500 }}>{tier.label.split(' ')[0]}</Text>
              </Group>
            </Tooltip>
          ))}
        </Group>
      )}
    </Stack>
  );
}
