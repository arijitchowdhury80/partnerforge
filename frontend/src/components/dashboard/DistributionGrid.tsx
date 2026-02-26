/**
 * Distribution Grid - Unified Target List View
 *
 * ALL views (Partner, Product, Vertical, Account) use the same TargetList component
 * for consistent UX. The view mode controls the default sort order:
 * - Partner: Sorted by partner_tech
 * - Product: Sorted by partner_tech (product granularity)
 * - Vertical: Sorted by vertical
 * - Account: Sorted by ICP score (default)
 *
 * This ensures:
 * - Same functionality across all views (sorting, filtering, clicking)
 * - Same visual appearance (logos, badges, columns)
 * - Consistent user experience
 */

import { useMemo, useState } from 'react';
import { Text, Badge, Group, Stack, Paper, Divider } from '@mantine/core';
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
  selectedPartner?: Partner;
}

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
  if (lower.includes('salesforce')) return 'Salesforce';
  if (lower.includes('sap')) return 'SAP';
  if (lower.includes('commercetools')) return 'commercetools';
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

// =============================================================================
// Summary Stats Component
// =============================================================================

interface SummaryStatsProps {
  companies: Company[];
  viewMode: ViewMode;
}

function SummaryStats({ companies, viewMode }: SummaryStatsProps) {
  // Calculate stats based on view mode
  const stats = useMemo(() => {
    if (viewMode === 'partner') {
      // Group by partner
      const partnerCounts: Record<string, number> = {};
      companies.forEach(c => {
        const partner = normalizePartner(c.partner_tech?.[0]);
        partnerCounts[partner] = (partnerCounts[partner] || 0) + 1;
      });
      return Object.entries(partnerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    } else if (viewMode === 'product') {
      // Group by product (partner_tech)
      const productCounts: Record<string, number> = {};
      companies.forEach(c => {
        const product = c.partner_tech?.[0] || 'Unknown';
        productCounts[product] = (productCounts[product] || 0) + 1;
      });
      return Object.entries(productCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    } else if (viewMode === 'vertical') {
      // Group by vertical
      const verticalCounts: Record<string, number> = {};
      companies.forEach(c => {
        const vertical = normalizeVertical(c.vertical);
        verticalCounts[vertical] = (verticalCounts[vertical] || 0) + 1;
      });
      return Object.entries(verticalCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    }
    // Account view - show status breakdown
    const statusCounts = {
      hot: companies.filter(c => c.status === 'hot').length,
      warm: companies.filter(c => c.status === 'warm').length,
      cold: companies.filter(c => c.status === 'cold').length,
    };
    return [
      ['Hot Leads', statusCounts.hot],
      ['Warm Leads', statusCounts.warm],
      ['Cold Leads', statusCounts.cold],
    ] as [string, number][];
  }, [companies, viewMode]);

  const total = companies.length;

  return (
    <Paper p="md" mb="md" radius="md" withBorder style={{ background: '#f8fafc' }}>
      <Group justify="space-between" align="center">
        <Group gap="lg">
          {stats.map(([label, count]) => (
            <Group key={label} gap="xs">
              <Text size="sm" c="#64748b">{label}:</Text>
              <Badge
                variant="light"
                color={
                  label === 'Hot Leads' ? 'red' :
                  label === 'Warm Leads' ? 'orange' :
                  label === 'Cold Leads' ? 'gray' : 'blue'
                }
                size="lg"
              >
                {(count as number).toLocaleString()}
              </Badge>
            </Group>
          ))}
        </Group>
        <Group gap="xs">
          <Text size="sm" c="#64748b">Total:</Text>
          <Badge variant="filled" color="blue" size="lg">{total.toLocaleString()}</Badge>
        </Group>
      </Group>
    </Paper>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function DistributionGrid({ viewMode, targets, onCellClick, selectedPartner }: DistributionGridProps) {
  // Convert all targets to Company type
  const allCompanies = useMemo(() => {
    return targets.map(convertTargetToCompany);
  }, [targets]);

  // Sort companies based on view mode
  const sortedCompanies = useMemo(() => {
    const sorted = [...allCompanies];

    switch (viewMode) {
      case 'partner':
        // Sort by partner, then by ICP score
        return sorted.sort((a, b) => {
          const partnerA = normalizePartner(a.partner_tech?.[0]);
          const partnerB = normalizePartner(b.partner_tech?.[0]);
          if (partnerA !== partnerB) return partnerA.localeCompare(partnerB);
          return (b.icp_score || 0) - (a.icp_score || 0);
        });

      case 'product':
        // Sort by product (partner_tech), then by ICP score
        return sorted.sort((a, b) => {
          const productA = a.partner_tech?.[0] || 'ZZZ';
          const productB = b.partner_tech?.[0] || 'ZZZ';
          if (productA !== productB) return productA.localeCompare(productB);
          return (b.icp_score || 0) - (a.icp_score || 0);
        });

      case 'vertical':
        // Sort by vertical, then by ICP score
        return sorted.sort((a, b) => {
          const verticalA = normalizeVertical(a.vertical);
          const verticalB = normalizeVertical(b.vertical);
          if (verticalA !== verticalB) return verticalA.localeCompare(verticalB);
          return (b.icp_score || 0) - (a.icp_score || 0);
        });

      case 'account':
      default:
        // Default: sort by ICP score descending
        return sorted.sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0));
    }
  }, [allCompanies, viewMode]);

  return (
    <Stack gap={0}>
      {/* Summary stats bar */}
      <SummaryStats companies={sortedCompanies} viewMode={viewMode} />

      {/* Unified TargetList - same component for ALL views */}
      <TargetList
        companies={sortedCompanies}
        allCompanies={sortedCompanies}
        isLoading={false}
      />
    </Stack>
  );
}
