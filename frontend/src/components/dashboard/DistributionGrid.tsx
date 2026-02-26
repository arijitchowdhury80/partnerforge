/**
 * Distribution Grid - Unified Target List Wrapper
 *
 * ALL views (Partner, Product, Vertical, Account) use the same TargetList component.
 * This is a thin wrapper that:
 * 1. Converts DisplacementTarget → Company type
 * 2. Applies default sorting based on view mode
 * 3. Handles client-side pagination for performance (limits DOM nodes)
 *
 * The actual table functionality comes from TargetList (single source of truth).
 * No duplicate UI code - just data transformation.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import type { DisplacementTarget } from '@/services/supabase';
import type { ViewMode } from './ViewModeToggle';
import { TargetList } from '@/components/targets/TargetList';
import type { Company } from '@/types';
import type { Partner } from '@/contexts/PartnerContext';

// Client-side pagination settings for performance
const PAGE_SIZE = 50;

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
// Props
// =============================================================================

interface DistributionGridProps {
  viewMode: ViewMode;
  targets: DisplacementTarget[];
  onCellClick: (rowKey: string, colKey: string, targets: DisplacementTarget[]) => void;
  selectedPartner?: Partner;
}

// =============================================================================
// Sorting Utilities
// =============================================================================

function normalizePartner(partnerTech: string | null | undefined): string {
  if (!partnerTech) return 'ZZZ';
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
  if (!vertical) return 'ZZZ';
  const lower = vertical.toLowerCase();
  if (lower.includes('auto')) return 'Automotive';
  if (lower.includes('retail') || lower.includes('commerce')) return 'Retail';
  if (lower.includes('health') || lower.includes('medical')) return 'Healthcare';
  if (lower.includes('finance') || lower.includes('banking')) return 'Finance';
  if (lower.includes('media') || lower.includes('entertainment')) return 'Media';
  if (lower.includes('tech') || lower.includes('software')) return 'Technology';
  if (lower.includes('manufact') || lower.includes('industrial')) return 'Manufacturing';
  return 'Other';
}

// =============================================================================
// Main Component
// =============================================================================

export function DistributionGrid({ viewMode, targets }: DistributionGridProps) {
  // Client-side pagination state
  const [page, setPage] = useState(1);

  // Reset to page 1 when viewMode changes for instant feedback
  useEffect(() => {
    setPage(1);
  }, [viewMode]);

  // Convert all targets to Company type (memoized - only recalculates when targets change)
  const allCompanies = useMemo(() => {
    return targets.map(convertTargetToCompany);
  }, [targets]);

  // Sort companies based on view mode (controls default sort order)
  // Reset page when view mode changes
  const sortedCompanies = useMemo(() => {
    const sorted = [...allCompanies];

    switch (viewMode) {
      case 'partner':
        return sorted.sort((a, b) => {
          const partnerA = normalizePartner(a.partner_tech?.[0]);
          const partnerB = normalizePartner(b.partner_tech?.[0]);
          if (partnerA !== partnerB) return partnerA.localeCompare(partnerB);
          return (b.icp_score || 0) - (a.icp_score || 0);
        });

      case 'product':
        return sorted.sort((a, b) => {
          const productA = a.partner_tech?.[0] || 'ZZZ';
          const productB = b.partner_tech?.[0] || 'ZZZ';
          if (productA !== productB) return productA.localeCompare(productB);
          return (b.icp_score || 0) - (a.icp_score || 0);
        });

      case 'vertical':
        return sorted.sort((a, b) => {
          const verticalA = normalizeVertical(a.vertical);
          const verticalB = normalizeVertical(b.vertical);
          if (verticalA !== verticalB) return verticalA.localeCompare(verticalB);
          return (b.icp_score || 0) - (a.icp_score || 0);
        });

      case 'account':
      default:
        return sorted.sort((a, b) => (b.icp_score || 0) - (a.icp_score || 0));
    }
  }, [allCompanies, viewMode]);

  // Paginate for performance - only render PAGE_SIZE rows at a time
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedCompanies.slice(start, start + PAGE_SIZE);
  }, [sortedCompanies, page]);

  // Pagination info for TargetList
  const pagination = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    total: sortedCompanies.length,
    total_pages: Math.ceil(sortedCompanies.length / PAGE_SIZE),
  }), [page, sortedCompanies.length]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Use THE SAME TargetList component for ALL views
  // Single source of truth for table UI
  return (
    <TargetList
      companies={paginatedCompanies}
      allCompanies={sortedCompanies}
      isLoading={false}
      pagination={pagination}
      onPageChange={handlePageChange}
    />
  );
}
