/**
 * useUpload Hook
 *
 * TanStack Query hooks for CSV upload operations.
 * Handles upload, validation, enrichment, and progress tracking.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiClient } from '@/services/api';
import type {
  UploadResponse,
  UploadedList,
  UploadedListItem,
  ValidationResult,
  EnrichmentJobResponse,
  ListStatusResponse,
  ColumnMapping,
  PaginatedResponse,
} from '@/types';

// =============================================================================
// Query Keys
// =============================================================================

export const uploadKeys = {
  all: ['uploads'] as const,
  lists: () => [...uploadKeys.all, 'lists'] as const,
  list: (id: string) => [...uploadKeys.all, 'list', id] as const,
  status: (id: string) => [...uploadKeys.all, 'status', id] as const,
  items: (id: string, params?: { page?: number; status?: string }) =>
    [...uploadKeys.all, 'items', id, params] as const,
};

// =============================================================================
// API Functions (Stubs - Upload functionality not yet implemented with Supabase)
// =============================================================================

// Upload a new CSV file
async function uploadList(_formData: FormData): Promise<UploadResponse> {
  throw new Error('Upload not implemented - Supabase backend pending');
}

// Get all uploaded lists
async function getLists(): Promise<{ lists: UploadedList[] }> {
  return { lists: [] };
}

// Get a single list by ID
async function getList(_id: string): Promise<UploadedList> {
  throw new Error('List not found');
}

// Get list status with progress
async function getListStatus(_id: string): Promise<ListStatusResponse> {
  throw new Error('List not found');
}

// Get list items with pagination
async function getListItems(
  _id: string,
  _params?: { page?: number; page_size?: number; status?: string }
): Promise<PaginatedResponse<UploadedListItem>> {
  return { data: [], pagination: { page: 1, limit: 50, total: 0, total_pages: 0 } };
}

// Confirm column mapping
async function confirmMapping(
  _id: string,
  _mapping: ColumnMapping
): Promise<UploadedList> {
  throw new Error('List not found');
}

// Validate list
async function validateList(_id: string): Promise<ValidationResult> {
  return { list_id: '', total: 0, valid: 0, invalid: 0, duplicates: 0, status: 'validated' };
}

// Start enrichment
async function startEnrichment(
  _id: string,
  _options?: { priority?: string; modules?: string[] }
): Promise<EnrichmentJobResponse> {
  throw new Error('Enrichment not implemented');
}

// Download results
async function downloadResults(
  _id: string,
  _format: 'csv' | 'json' = 'csv',
  _includeErrors = false
): Promise<Blob> {
  return new Blob();
}

// Delete a list
async function deleteList(_id: string): Promise<void> {
  // No-op
}

// Retry failed items
async function retryFailed(_id: string): Promise<EnrichmentJobResponse> {
  throw new Error('Enrichment not implemented');
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch all uploaded lists
 */
export function useUploadLists() {
  return useQuery({
    queryKey: uploadKeys.lists(),
    queryFn: getLists,
    select: (data) => data.lists,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to fetch a single list
 */
export function useUploadList(id: string | undefined) {
  return useQuery({
    queryKey: uploadKeys.list(id!),
    queryFn: () => getList(id!),
    enabled: !!id,
  });
}

/**
 * Hook to fetch list status with polling
 */
export function useListStatus(id: string | undefined, options?: { polling?: boolean }) {
  return useQuery({
    queryKey: uploadKeys.status(id!),
    queryFn: () => getListStatus(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      if (!options?.polling) return false;
      // Stop polling when complete or failed
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });
}

/**
 * Hook to fetch list items with pagination
 */
export function useListItems(
  id: string | undefined,
  params?: { page?: number; pageSize?: number; status?: string }
) {
  return useQuery({
    queryKey: uploadKeys.items(id!, { page: params?.page, status: params?.status }),
    queryFn: () =>
      getListItems(id!, {
        page: params?.page,
        page_size: params?.pageSize,
        status: params?.status,
      }),
    enabled: !!id,
  });
}

/**
 * Hook to upload a new CSV file
 */
export function useUploadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadList,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.lists() });
      notifications.show({
        title: 'Upload Successful',
        message: `${data.total_rows} rows detected in ${data.name}`,
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
 * Hook to confirm column mapping
 */
export function useConfirmMappingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mapping }: { id: string; mapping: ColumnMapping }) =>
      confirmMapping(id, mapping),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.list(variables.id) });
      notifications.show({
        title: 'Mapping Confirmed',
        message: 'Column mapping has been saved',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Mapping Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to validate a list
 */
export function useValidateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: validateList,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.list(id) });
      queryClient.invalidateQueries({ queryKey: uploadKeys.status(id) });
      notifications.show({
        title: 'Validation Complete',
        message: `${data.valid} valid, ${data.invalid} invalid rows`,
        color: data.invalid > 0 ? 'yellow' : 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Validation Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to start enrichment
 */
export function useStartEnrichmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      options,
    }: {
      id: string;
      options?: { priority?: string; modules?: string[] };
    }) => startEnrichment(id, options),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.list(variables.id) });
      queryClient.invalidateQueries({ queryKey: uploadKeys.status(variables.id) });
      notifications.show({
        title: 'Enrichment Started',
        message: `Processing ${data.total_items} items`,
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Enrichment Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to download results
 */
export function useDownloadResultsMutation() {
  return useMutation({
    mutationFn: ({
      id,
      format,
      includeErrors,
    }: {
      id: string;
      format?: 'csv' | 'json';
      includeErrors?: boolean;
    }) => downloadResults(id, format, includeErrors),
    onSuccess: (data, variables) => {
      // Create download link
      const url = window.URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enriched-results-${variables.id}.${variables.format || 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      notifications.show({
        title: 'Download Started',
        message: 'Your file is being downloaded',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Download Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to delete a list
 */
export function useDeleteListMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteList,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.lists() });
      queryClient.removeQueries({ queryKey: uploadKeys.list(id) });
      notifications.show({
        title: 'List Deleted',
        message: 'The list has been removed',
        color: 'green',
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
 * Hook to retry failed items
 */
export function useRetryFailedMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: retryFailed,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: uploadKeys.list(id) });
      queryClient.invalidateQueries({ queryKey: uploadKeys.status(id) });
      notifications.show({
        title: 'Retry Started',
        message: `Retrying ${data.total_items} failed items`,
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
