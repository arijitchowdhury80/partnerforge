/**
 * useTargets Hook
 *
 * TanStack Query hooks for target/company operations.
 * Handles fetching, filtering, and mutations for displacement targets.
 */

import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { getCompanies, getCompany, createCompany, getStats } from '@/services/api';
import type { Company, FilterState, DashboardStats, PaginatedResponse } from '@/types';

// =============================================================================
// Query Keys
// =============================================================================

export const targetKeys = {
  all: ['targets'] as const,
  lists: () => [...targetKeys.all, 'list'] as const,
  list: (filters: FilterState & { page?: number; limit?: number }) =>
    [...targetKeys.all, 'list', filters] as const,
  details: () => [...targetKeys.all, 'detail'] as const,
  detail: (domain: string) => [...targetKeys.all, 'detail', domain] as const,
  stats: () => [...targetKeys.all, 'stats'] as const,
  infinite: (filters: Omit<FilterState, 'page'>) =>
    [...targetKeys.all, 'infinite', filters] as const,
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch dashboard statistics
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: targetKeys.stats(),
    queryFn: getStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch paginated list of targets
 */
export function useTargets(
  filters: FilterState & { page?: number; limit?: number } = {
    sort_by: 'icp_score',
    sort_order: 'desc',
    page: 1,
    limit: 50,
  }
) {
  return useQuery({
    queryKey: targetKeys.list(filters),
    queryFn: () => getCompanies(filters),
    staleTime: 1000 * 60, // 1 minute
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });
}

/**
 * Hook for infinite scroll targets list
 */
export function useInfiniteTargets(
  filters: Omit<FilterState, 'page'> = {
    sort_by: 'icp_score',
    sort_order: 'desc',
  },
  limit = 25
) {
  return useInfiniteQuery({
    queryKey: targetKeys.infinite(filters),
    queryFn: ({ pageParam = 1 }) =>
      getCompanies({ ...filters, page: pageParam, limit }),
    getNextPageParam: (lastPage) => {
      const { page, total_pages } = lastPage.pagination;
      return page < total_pages ? page + 1 : undefined;
    },
    initialPageParam: 1,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to fetch a single target by domain
 */
export function useTarget(domain: string | undefined) {
  return useQuery({
    queryKey: targetKeys.detail(domain!),
    queryFn: () => getCompany(domain!),
    enabled: !!domain,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to prefetch a target (for hover preloading)
 */
export function usePrefetchTarget() {
  const queryClient = useQueryClient();

  return (domain: string) => {
    queryClient.prefetchQuery({
      queryKey: targetKeys.detail(domain),
      queryFn: () => getCompany(domain),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
}

/**
 * Hook to create/add a new target
 */
export function useCreateTargetMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCompany,
    onSuccess: (data) => {
      // Invalidate lists to include new target
      queryClient.invalidateQueries({ queryKey: targetKeys.lists() });
      queryClient.invalidateQueries({ queryKey: targetKeys.stats() });

      // Add to cache
      queryClient.setQueryData(targetKeys.detail(data.domain), data);

      notifications.show({
        title: 'Target Added',
        message: `${data.company_name || data.domain} has been added`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Add Target',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to get hot leads (ICP score >= 80)
 */
export function useHotLeads(limit = 10) {
  return useQuery({
    queryKey: [...targetKeys.lists(), 'hot', limit] as const,
    queryFn: () =>
      getCompanies({
        status: 'hot',
        sort_by: 'icp_score',
        sort_order: 'desc',
        limit,
      }),
    staleTime: 1000 * 60, // 1 minute
    select: (data) => data.data,
  });
}

/**
 * Hook to get warm leads (ICP score 60-79)
 */
export function useWarmLeads(limit = 20) {
  return useQuery({
    queryKey: [...targetKeys.lists(), 'warm', limit] as const,
    queryFn: () =>
      getCompanies({
        status: 'warm',
        sort_by: 'icp_score',
        sort_order: 'desc',
        limit,
      }),
    staleTime: 1000 * 60, // 1 minute
    select: (data) => data.data,
  });
}

/**
 * Hook to search targets by name/domain
 */
export function useSearchTargets(query: string, enabled = true) {
  return useQuery({
    queryKey: [...targetKeys.lists(), 'search', query] as const,
    queryFn: async () => {
      // For now, fetch all and filter client-side
      // TODO: Add server-side search endpoint
      const { data } = await getCompanies({
        sort_by: 'icp_score',
        sort_order: 'desc',
        limit: 100,
      });

      const lowerQuery = query.toLowerCase();
      return data.filter(
        (c) =>
          c.domain.toLowerCase().includes(lowerQuery) ||
          c.company_name.toLowerCase().includes(lowerQuery)
      );
    },
    enabled: enabled && query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to get targets by partner tech
 */
export function useTargetsByPartner(partner: string, limit = 50) {
  return useQuery({
    queryKey: [...targetKeys.lists(), 'partner', partner, limit] as const,
    queryFn: () =>
      getCompanies({
        partner,
        sort_by: 'icp_score',
        sort_order: 'desc',
        limit,
      }),
    enabled: !!partner,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to invalidate all target-related queries
 */
export function useInvalidateTargets() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: targetKeys.all });
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to get target counts by status
 */
export function useTargetStatusCounts() {
  const { data: stats } = useDashboardStats();

  return {
    total: stats?.total_companies || 0,
    enriched: stats?.enriched_companies || 0,
    hot: stats?.hot_leads || 0,
    warm: stats?.warm_leads || 0,
    cold: stats?.cold_leads || 0,
  };
}

/**
 * Hook to check if a target exists
 */
export function useTargetExists(domain: string | undefined) {
  const { data, isLoading } = useTarget(domain);
  return {
    exists: !!data,
    isLoading,
  };
}
