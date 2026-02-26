/**
 * useLists - TanStack Query Hooks for List Operations
 *
 * Provides data fetching, mutations, and caching for list management.
 * NOTE: This is a stub implementation - API not yet connected.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { PaginatedResponse, EnrichmentJob } from '@/types';
import type { UploadedListItem } from '@/components/lists/ListTable';

// =============================================================================
// Types
// =============================================================================

export interface UploadListPayload {
  file: File;
  partnerTech: string;
  name?: string;
}

export interface ListFilters {
  status?: 'pending' | 'processing' | 'complete' | 'error';
  partnerTech?: string;
  page?: number;
  limit?: number;
}

// =============================================================================
// Query Keys
// =============================================================================

export const listKeys = {
  all: ['lists'] as const,
  lists: (filters?: ListFilters) => [...listKeys.all, 'list', filters] as const,
  detail: (id: string) => [...listKeys.all, 'detail', id] as const,
  progress: (id: string) => [...listKeys.all, 'progress', id] as const,
};

// =============================================================================
// Mock Data & Fetch Functions
// =============================================================================

const MOCK_LISTS: UploadedListItem[] = [
  {
    id: 'list-1',
    name: 'Adobe AEM Targets',
    rowCount: 2687,
    enrichedCount: 2687,
    partnerTech: 'Adobe AEM',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    status: 'complete',
    progress: 100,
  },
  {
    id: 'list-2',
    name: 'Shopify Enterprise',
    rowCount: 1500,
    enrichedCount: 750,
    partnerTech: 'Shopify',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    status: 'processing',
    progress: 50,
  },
  {
    id: 'list-3',
    name: 'Salesforce Commerce',
    rowCount: 890,
    enrichedCount: 0,
    partnerTech: 'Salesforce',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'pending',
    progress: 0,
  },
];

async function fetchLists(filters?: ListFilters): Promise<PaginatedResponse<UploadedListItem>> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  let filteredData = [...MOCK_LISTS];
  if (filters?.status) {
    filteredData = filteredData.filter((list) => list.status === filters.status);
  }
  if (filters?.partnerTech) {
    filteredData = filteredData.filter((list) =>
      list.partnerTech.toLowerCase().includes(filters.partnerTech!.toLowerCase())
    );
  }

  return {
    data: filteredData,
    pagination: {
      page: filters?.page || 1,
      limit: filters?.limit || 20,
      total: filteredData.length,
      total_pages: Math.ceil(filteredData.length / (filters?.limit || 20)),
    },
  };
}

async function fetchListDetail(id: string): Promise<UploadedListItem> {
  await new Promise(resolve => setTimeout(resolve, 100));
  const item = MOCK_LISTS.find(l => l.id === id);
  if (!item) throw new Error(`List not found: ${id}`);
  return item;
}

async function uploadList(payload: UploadListPayload): Promise<UploadedListItem> {
  await new Promise(resolve => setTimeout(resolve, 500));
  return {
    id: `list-${Date.now()}`,
    name: payload.name || payload.file.name,
    rowCount: 100,
    enrichedCount: 0,
    partnerTech: payload.partnerTech,
    createdAt: new Date().toISOString(),
    status: 'pending',
    progress: 0,
  };
}

async function deleteList(_id: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
}

async function startListEnrichment(id: string): Promise<EnrichmentJob> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    job_id: `job-${Date.now()}`,
    domain: id,
    status: 'queued',
    modules: [],
  };
}

async function retryFailedEnrichment(id: string): Promise<EnrichmentJob> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return {
    job_id: `job-${Date.now()}`,
    domain: id,
    status: 'queued',
    modules: [],
  };
}

async function exportList(_id: string): Promise<Blob> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return new Blob(['domain,company_name,icp_score\nexample.com,Example,75'], { type: 'text/csv' });
}

// =============================================================================
// Query Hooks
// =============================================================================

export function useLists(
  filters?: ListFilters,
  options?: Omit<UseQueryOptions<PaginatedResponse<UploadedListItem>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: listKeys.lists(filters),
    queryFn: () => fetchLists(filters),
    staleTime: 1000 * 60 * 2,
    ...options,
  });
}

export function useListDetail(
  id: string,
  options?: Omit<UseQueryOptions<UploadedListItem>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: () => fetchListDetail(id),
    enabled: !!id,
    ...options,
  });
}

// =============================================================================
// Mutation Hooks
// =============================================================================

export function useUploadList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadList,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
      notifications.show({
        title: 'List Uploaded',
        message: `${data.name} has been uploaded with ${data.rowCount} companies`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Upload Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
      notifications.show({
        title: 'List Deleted',
        message: 'The list has been removed',
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Delete Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useStartEnrichment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: startListEnrichment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
      notifications.show({
        title: 'Enrichment Started',
        message: `Job ${data.job_id} has been queued`,
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Start Enrichment',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useRetryEnrichment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryFailedEnrichment,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: listKeys.all });
      notifications.show({
        title: 'Retry Started',
        message: `Retrying failed enrichments for job ${data.job_id}`,
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Retry Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

export function useExportList() {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await exportList(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `list-${id}-export.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      notifications.show({
        title: 'Export Complete',
        message: 'The list has been exported to CSV',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Export Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}
