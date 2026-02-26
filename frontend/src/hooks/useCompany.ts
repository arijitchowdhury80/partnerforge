/**
 * useCompany Hook
 *
 * TanStack Query hooks for company-specific operations.
 * Includes company data fetching, intelligence modules, change history, and enrichment triggers.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  getCompany,
  getIntelOverview,
  getModuleData,
  triggerEnrichment,
  getEnrichmentStatus,
} from '@/services/api';
import type {
  Company,
  ModuleId,
  ModuleResult,
  EnrichmentStatus,
} from '@/types';
import type { ChangeEntry } from '@/components/company/ChangeTimeline';

// =============================================================================
// Query Keys
// =============================================================================

export const companyKeys = {
  all: ['company'] as const,
  detail: (domain: string) => [...companyKeys.all, 'detail', domain] as const,
  intelligence: (domain: string) => [...companyKeys.all, 'intelligence', domain] as const,
  module: (domain: string, moduleId: ModuleId) =>
    [...companyKeys.all, 'module', domain, moduleId] as const,
  changes: (domain: string) => [...companyKeys.all, 'changes', domain] as const,
  enrichmentStatus: (domain: string) =>
    [...companyKeys.all, 'enrichment-status', domain] as const,
};

// =============================================================================
// Company Data Hooks
// =============================================================================

/**
 * Hook to fetch a single company by domain
 */
export function useCompany(domain: string | undefined) {
  return useQuery({
    queryKey: companyKeys.detail(domain!),
    queryFn: () => getCompany(domain!),
    enabled: !!domain,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404
      if (error.message.includes('404') || error.message.includes('not found')) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

/**
 * Hook to check if a company exists
 */
export function useCompanyExists(domain: string | undefined) {
  const { data, isLoading, error } = useCompany(domain);
  return {
    exists: !error && !!data,
    isLoading,
    isNotFound: error?.message?.includes('404') || error?.message?.includes('not found'),
  };
}

/**
 * Hook to prefetch company data (for hover preloading)
 */
export function usePrefetchCompany() {
  const queryClient = useQueryClient();

  return (domain: string) => {
    queryClient.prefetchQuery({
      queryKey: companyKeys.detail(domain),
      queryFn: () => getCompany(domain),
      staleTime: 1000 * 60 * 5,
    });
  };
}

// =============================================================================
// Intelligence Module Hooks
// =============================================================================

/**
 * Hook to fetch intelligence overview for a company
 */
export function useCompanyIntelligence(domain: string | undefined) {
  return useQuery({
    queryKey: companyKeys.intelligence(domain!),
    queryFn: () => getIntelOverview(domain!),
    enabled: !!domain,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to fetch a specific module's data
 */
export function useCompanyModule<T>(
  domain: string | undefined,
  moduleId: ModuleId
) {
  return useQuery({
    queryKey: companyKeys.module(domain!, moduleId),
    queryFn: () => getModuleData<T>(domain!, moduleId),
    enabled: !!domain,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch all intelligence modules for a company
 */
export function useAllCompanyModules(domain: string | undefined) {
  const queryClient = useQueryClient();

  const moduleIds: ModuleId[] = [
    'm01_company_context',
    'm02_tech_stack',
    'm03_traffic',
    'm04_financials',
    'm05_competitors',
    'm06_hiring',
    'm07_strategic',
    'm08_investor',
    'm09_executive',
    'm10_buying_committee',
    'm11_displacement',
    'm12_case_study',
    'm13_icp_priority',
    'm14_signal_scoring',
    'm15_strategic_brief',
  ];

  // Prefetch all modules
  const prefetchAll = async () => {
    if (!domain) return;

    await Promise.all(
      moduleIds.map((moduleId) =>
        queryClient.prefetchQuery({
          queryKey: companyKeys.module(domain, moduleId),
          queryFn: () => getModuleData(domain, moduleId),
          staleTime: 1000 * 60 * 5,
        })
      )
    );
  };

  return { prefetchAll };
}

// =============================================================================
// Change History Hooks
// =============================================================================

/**
 * Hook to fetch change history for a company
 * Note: This is a mock implementation until the API endpoint is ready
 */
export function useCompanyChanges(
  domain: string | undefined,
  options?: {
    moduleFilter?: ModuleId[];
    significanceFilter?: ('high' | 'medium' | 'low')[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: [...companyKeys.changes(domain!), options] as const,
    queryFn: async (): Promise<ChangeEntry[]> => {
      // TODO: Replace with actual API call when endpoint is ready
      // const { data } = await apiClient.get(`/companies/${domain}/changes`, { params: options });
      // return data;

      // Mock implementation - generate sample changes
      const now = new Date();
      const mockChanges: ChangeEntry[] = [
        {
          id: `${domain}-1`,
          domain: domain!,
          module_id: 'm03_traffic',
          change_type: 'value_change',
          field: 'Monthly Visits',
          old_value: '12.5M',
          new_value: '14.2M',
          significance: 'high',
          detected_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
          description: 'Significant traffic increase detected',
        },
        {
          id: `${domain}-2`,
          domain: domain!,
          module_id: 'm06_hiring',
          change_type: 'new_data',
          field: 'VP Engineering Role',
          new_value: 'VP of Engineering - Search Infrastructure',
          significance: 'high',
          detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
          description: 'High-level search role posted',
        },
        {
          id: `${domain}-3`,
          domain: domain!,
          module_id: 'm04_financials',
          change_type: 'value_change',
          field: 'Stock Price',
          old_value: '$142.50',
          new_value: '$148.75',
          significance: 'medium',
          detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ];

      // Apply filters
      let filtered = mockChanges;

      if (options?.moduleFilter?.length) {
        filtered = filtered.filter((c) => options.moduleFilter!.includes(c.module_id));
      }

      if (options?.significanceFilter?.length) {
        filtered = filtered.filter((c) =>
          options.significanceFilter!.includes(c.significance)
        );
      }

      if (options?.startDate) {
        filtered = filtered.filter(
          (c) => new Date(c.detected_at) >= options.startDate!
        );
      }

      if (options?.endDate) {
        filtered = filtered.filter(
          (c) => new Date(c.detected_at) <= options.endDate!
        );
      }

      if (options?.limit) {
        filtered = filtered.slice(0, options.limit);
      }

      return filtered;
    },
    enabled: !!domain,
    staleTime: 1000 * 60, // 1 minute
  });
}

// =============================================================================
// Enrichment Hooks
// =============================================================================

/**
 * Hook to get enrichment status for a company
 */
export function useCompanyEnrichmentStatus(
  domain: string | undefined,
  options?: { polling?: boolean }
) {
  return useQuery({
    queryKey: companyKeys.enrichmentStatus(domain!),
    queryFn: () => getEnrichmentStatus(domain!),
    enabled: !!domain,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: (query) => {
      if (!options?.polling) return false;
      const data = query.state.data;
      if (data?.overall_status !== 'running') return false;
      return 2000; // Poll every 2 seconds while running
    },
  });
}

/**
 * Hook to trigger company enrichment
 */
export function useRefreshCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ domain, force = false }: { domain: string; force?: boolean }) =>
      triggerEnrichment(domain, force),
    onMutate: (variables) => {
      notifications.show({
        id: `enrich-${variables.domain}`,
        title: 'Enrichment Started',
        message: `Processing intelligence for ${variables.domain}`,
        color: 'blue',
        loading: true,
        autoClose: false,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: companyKeys.detail(variables.domain),
      });
      queryClient.invalidateQueries({
        queryKey: companyKeys.intelligence(variables.domain),
      });
      queryClient.invalidateQueries({
        queryKey: companyKeys.enrichmentStatus(variables.domain),
      });

      notifications.update({
        id: `enrich-${variables.domain}`,
        title: 'Enrichment Queued',
        message: `Job ID: ${data.job_id}`,
        color: 'green',
        loading: false,
        autoClose: 3000,
      });
    },
    onError: (error: Error, variables) => {
      notifications.update({
        id: `enrich-${variables.domain}`,
        title: 'Enrichment Failed',
        message: error.message,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    },
  });
}

/**
 * Hook to invalidate all company-related data
 */
export function useInvalidateCompany() {
  const queryClient = useQueryClient();

  return (domain: string) => {
    queryClient.invalidateQueries({ queryKey: companyKeys.detail(domain) });
    queryClient.invalidateQueries({ queryKey: companyKeys.intelligence(domain) });
    queryClient.invalidateQueries({ queryKey: companyKeys.changes(domain) });
    queryClient.invalidateQueries({ queryKey: companyKeys.enrichmentStatus(domain) });
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to compute module completion status
 */
export function useModuleCompletion(domain: string | undefined) {
  const { data: status, isLoading } = useCompanyEnrichmentStatus(domain);

  if (isLoading || !status?.modules) {
    return {
      total: 15,
      completed: 0,
      running: 0,
      pending: 15,
      errored: 0,
      percentage: 0,
      isLoading,
    };
  }

  const modules = Object.values(status.modules);
  const completed = modules.filter((m) => m.status === 'complete').length;
  const running = modules.filter((m) => m.status === 'running').length;
  const errored = modules.filter((m) => m.status === 'error').length;
  const pending = modules.filter((m) => m.status === 'pending').length;

  return {
    total: modules.length,
    completed,
    running,
    pending,
    errored,
    percentage: Math.round((completed / modules.length) * 100),
    isLoading,
  };
}

/**
 * Hook to get company score color based on ICP score
 */
export function useCompanyScoreColor(score: number | undefined): string {
  if (!score) return 'gray';
  if (score >= 80) return 'red';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'yellow';
  return 'gray';
}

/**
 * Hook to get company status label
 */
export function useCompanyStatusLabel(score: number | undefined): string {
  if (!score) return 'UNKNOWN';
  if (score >= 80) return 'HOT';
  if (score >= 40) return 'WARM';
  return 'COLD';
}
