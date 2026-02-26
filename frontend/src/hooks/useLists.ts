/**
 * useLists - TanStack Query Hooks for List Operations
 *
 * Provides data fetching, mutations, and caching for list management.
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '@/services/api';
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
// Fetch Functions
// =============================================================================

async function fetchLists(filters?: ListFilters): Promise<PaginatedResponse<UploadedListItem>> {
  // Mock implementation - replace with actual API call
  const mockData: UploadedListItem[] = [
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

  // Filter by status if provided
  let filteredData = mockData;
  if (filters?.status) {
    filteredData = mockData.filter((list) => list.status === filters.status);
  }
  if (filters?.partnerTech) {
    filteredData = mockData.filter((list) =>
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
  const { data } = await apiClient.get(`/lists/${id}`);
  return data;
}

async function uploadList(payload: UploadListPayload): Promise<UploadedListItem> {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('partner_tech', payload.partnerTech);
  if (payload.name) {
    formData.append('name', payload.name);
  }

  const { data } = await apiClient.post('/lists/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

async function deleteList(id: string): Promise<void> {
  await apiClient.delete(`/lists/${id}`);
}

async function startListEnrichment(id: string): Promise<EnrichmentJob> {
  const { data } = await apiClient.post(`/lists/${id}/enrich`);
  return data;
}

async function retryFailedEnrichment(id: string): Promise<EnrichmentJob> {
  const { data } = await apiClient.post(`/lists/${id}/retry`);
  return data;
}

async function exportList(id: string): Promise<Blob> {
  const { data } = await apiClient.get(`/lists/${id}/export`, {
    responseType: 'blob',
  });
  return data;
}

// =============================================================================
// Query Hooks
// =============================================================================

/**
 * Fetch all lists with optional filtering
 */
export function useLists(
  filters?: ListFilters,
  options?: Omit<UseQueryOptions<PaginatedResponse<UploadedListItem>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: listKeys.lists(filters),
    queryFn: () => fetchLists(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes
    ...options,
  });
}

/**
 * Fetch a single list by ID
 */
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

/**
 * Upload a new list
 */
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

/**
 * Delete a list
 */
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

/**
 * Start enrichment for a list
 */
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

/**
 * Retry failed enrichments for a list
 */
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

/**
 * Export a list to CSV
 */
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
