/**
 * Test Utilities
 *
 * Shared test helpers, mock data, and wrapper components.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { PartnerProvider } from '@/contexts/PartnerContext';
import type { Company, Partner, EnrichmentStatus } from '@/types';

// =============================================================================
// Test Query Client
// =============================================================================

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// =============================================================================
// All Providers Wrapper
// =============================================================================

interface AllProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <MantineProvider>
        <BrowserRouter>
          <PartnerProvider>
            {children}
          </PartnerProvider>
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

// =============================================================================
// Custom Render
// =============================================================================

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { queryClient, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

// =============================================================================
// Mock Data Factories
// =============================================================================

export function createMockCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: `company-${Math.random().toString(36).slice(2)}`,
    domain: 'example.com',
    company_name: 'Example Company',
    industry: 'Technology',
    vertical: 'SaaS',
    icp_score: 75,
    signal_score: 60,
    priority_score: 70,
    sw_monthly_visits: 500000,
    revenue: 100000000,
    employee_count: 500,
    partner_tech: 'Adobe Experience Manager',
    current_search: 'Elasticsearch',
    headquarters: { country: 'United States', city: 'San Francisco' },
    founded_year: 2015,
    is_public: false,
    ticker: null,
    enrichment_level: 'basic',
    last_enriched: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockPartner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: `partner-${Math.random().toString(36).slice(2)}`,
    name: 'Adobe',
    tech_name: 'Adobe Experience Manager',
    logo_url: '/logos/adobe.svg',
    category: 'CMS',
    is_active: true,
    ...overrides,
  };
}

export function createMockEnrichmentStatus(
  overrides: Partial<EnrichmentStatus> = {}
): EnrichmentStatus {
  return {
    domain: 'example.com',
    status: 'running',
    message: 'Enriching...',
    step: 1,
    totalSteps: 7,
    currentSource: 'SimilarWeb',
    completedSources: [],
    failedSources: [],
    ...overrides,
  };
}

// =============================================================================
// Mock Company List
// =============================================================================

export const mockCompanies: Company[] = [
  createMockCompany({
    domain: 'walmart.com',
    company_name: 'Walmart',
    icp_score: 95,
    revenue: 648000000000,
    sw_monthly_visits: 2100000,
    is_public: true,
    ticker: 'WMT',
  }),
  createMockCompany({
    domain: 'target.com',
    company_name: 'Target',
    icp_score: 91,
    revenue: 109000000000,
    sw_monthly_visits: 890000,
    is_public: true,
    ticker: 'TGT',
  }),
  createMockCompany({
    domain: 'costco.com',
    company_name: 'Costco',
    icp_score: 89,
    revenue: 242000000000,
    sw_monthly_visits: 456000,
    is_public: true,
    ticker: 'COST',
  }),
  createMockCompany({
    domain: 'bestbuy.com',
    company_name: 'Best Buy',
    icp_score: 72,
    revenue: 46000000000,
    sw_monthly_visits: 320000,
    is_public: true,
    ticker: 'BBY',
  }),
  createMockCompany({
    domain: 'homedepot.com',
    company_name: 'Home Depot',
    icp_score: 88,
    revenue: 157000000000,
    sw_monthly_visits: 280000,
    is_public: true,
    ticker: 'HD',
  }),
];

// =============================================================================
// Async Helpers
// =============================================================================

export function waitForAsync(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForElement(
  getElement: () => HTMLElement | null,
  timeout = 1000
): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = getElement();
    if (element) return element;
    await waitForAsync(50);
  }

  throw new Error('Element not found within timeout');
}

// =============================================================================
// Event Helpers
// =============================================================================

export function createMouseEvent(type: string, options = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

export function createKeyboardEvent(type: string, key: string, options = {}) {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  });
}

// =============================================================================
// Re-export testing-library
// =============================================================================

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
