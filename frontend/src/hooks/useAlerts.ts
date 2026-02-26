/**
 * useAlerts Hook
 *
 * TanStack Query hooks for alert management operations.
 * Includes alert fetching, rule management, and mutations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiClient } from '@/services/api';
import type { Alert, AlertRule, AlertStatus, AlertPriority } from '@/components/alerts';
import type { ModuleId } from '@/types';

// =============================================================================
// Query Keys
// =============================================================================

export const alertKeys = {
  all: ['alerts'] as const,
  list: (filters?: AlertFilters) => [...alertKeys.all, 'list', filters] as const,
  unread: () => [...alertKeys.all, 'unread'] as const,
  digest: () => [...alertKeys.all, 'digest'] as const,
  byDomain: (domain: string) => [...alertKeys.all, 'domain', domain] as const,
  rules: () => [...alertKeys.all, 'rules'] as const,
  rule: (ruleId: string) => [...alertKeys.all, 'rule', ruleId] as const,
};

// =============================================================================
// Types
// =============================================================================

export interface AlertFilters {
  domain?: string;
  module?: ModuleId;
  status?: AlertStatus;
  priority?: AlertPriority;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AlertDigest {
  total: number;
  unread: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  by_module: Record<ModuleId, number>;
  recent_domains: string[];
}

// =============================================================================
// Mock API Functions (until backend is ready)
// =============================================================================

// In-memory store for mock data
let mockAlerts: Alert[] = generateMockAlerts();
let mockRules: AlertRule[] = generateMockRules();

function generateMockAlerts(): Alert[] {
  const now = new Date();
  return [
    {
      id: '1',
      domain: 'mercedes-benz.com',
      company_name: 'Mercedes-Benz',
      module_id: 'm03_traffic',
      change_type: 'value_change',
      field: 'Monthly Visits',
      old_value: '45.2M',
      new_value: '52.8M',
      priority: 'high',
      status: 'unread',
      message: 'Mercedes-Benz traffic increased by 16.8%',
      details: 'Significant traffic growth detected.',
      detected_at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      rule_name: 'Traffic Spike Alert',
    },
    {
      id: '2',
      domain: 'infiniti.com',
      company_name: 'Infiniti',
      module_id: 'm06_hiring',
      change_type: 'new_data',
      field: 'VP of Digital Experience',
      new_value: 'New leadership role posted',
      priority: 'high',
      status: 'unread',
      message: 'Infiniti posted VP of Digital Experience role',
      detected_at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      rule_name: 'Executive Hiring',
    },
    {
      id: '3',
      domain: 'marks.com',
      company_name: "Mark's",
      module_id: 'm02_tech_stack',
      change_type: 'status_change',
      field: 'Search Provider',
      old_value: 'Elasticsearch',
      new_value: 'Elasticsearch (RFP initiated)',
      priority: 'high',
      status: 'unread',
      message: "Mark's initiated search platform RFP",
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      rule_name: 'Tech Change Alert',
    },
    {
      id: '4',
      domain: 'allianz.com',
      company_name: 'Allianz',
      module_id: 'm04_financials',
      change_type: 'value_change',
      field: 'Stock Price',
      old_value: '$285.40',
      new_value: '$298.75',
      priority: 'medium',
      status: 'read',
      message: 'Allianz stock price increased 4.7%',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: '5',
      domain: 'chevrolet.com.mx',
      company_name: 'Chevrolet Mexico',
      module_id: 'm09_executive',
      change_type: 'new_data',
      field: 'Executive Quote',
      new_value: 'CEO emphasized digital commerce priority',
      priority: 'medium',
      status: 'read',
      message: 'Chevrolet Mexico CEO mentioned digital commerce focus',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      rule_name: 'Executive Statement',
    },
  ];
}

function generateMockRules(): AlertRule[] {
  return [
    {
      id: 'rule-1',
      name: 'Traffic Spike Alert',
      description: 'Alert when traffic increases by more than 15%',
      domains: 'all',
      modules: ['m03_traffic'],
      change_types: ['value_change'],
      priority: 'any',
      thresholds: [{ field: 'monthly_visits_change', operator: 'gt', value: 15 }],
      channels: ['in_app', 'email'],
      is_active: true,
      created_at: '2026-02-01T10:00:00Z',
    },
    {
      id: 'rule-2',
      name: 'Executive Hiring',
      description: 'Alert on VP+ level hires',
      domains: 'all',
      modules: ['m06_hiring'],
      change_types: ['new_data'],
      priority: 'high',
      thresholds: [],
      channels: ['in_app', 'slack'],
      is_active: true,
      created_at: '2026-02-05T14:30:00Z',
    },
    {
      id: 'rule-3',
      name: 'Tech Change Alert',
      description: 'Alert when search provider status changes',
      domains: ['marks.com', 'mercedes-benz.com'],
      modules: ['m02_tech_stack'],
      change_types: ['status_change', 'value_change'],
      priority: 'any',
      thresholds: [],
      channels: ['in_app', 'email', 'slack'],
      is_active: true,
      created_at: '2026-02-10T09:00:00Z',
    },
  ];
}

// Mock API implementations
async function fetchAlerts(filters?: AlertFilters): Promise<Alert[]> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 200));

  let filtered = [...mockAlerts];

  if (filters?.domain) {
    filtered = filtered.filter((a) => a.domain === filters.domain);
  }
  if (filters?.module) {
    filtered = filtered.filter((a) => a.module_id === filters.module);
  }
  if (filters?.status) {
    filtered = filtered.filter((a) => a.status === filters.status);
  }
  if (filters?.priority) {
    filtered = filtered.filter((a) => a.priority === filters.priority);
  }
  if (filters?.limit) {
    filtered = filtered.slice(0, filters.limit);
  }

  return filtered;
}

async function fetchAlertDigest(): Promise<AlertDigest> {
  await new Promise((resolve) => setTimeout(resolve, 100));

  const alerts = mockAlerts;
  const byModule: Partial<Record<ModuleId, number>> = {};

  alerts.forEach((a) => {
    byModule[a.module_id] = (byModule[a.module_id] || 0) + 1;
  });

  return {
    total: alerts.length,
    unread: alerts.filter((a) => a.status === 'unread').length,
    high_priority: alerts.filter((a) => a.priority === 'high').length,
    medium_priority: alerts.filter((a) => a.priority === 'medium').length,
    low_priority: alerts.filter((a) => a.priority === 'low').length,
    by_module: byModule as Record<ModuleId, number>,
    recent_domains: [...new Set(alerts.map((a) => a.domain))].slice(0, 5),
  };
}

async function fetchRules(): Promise<AlertRule[]> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return [...mockRules];
}

async function markAlertsRead(ids: string[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  mockAlerts = mockAlerts.map((a) =>
    ids.includes(a.id) ? { ...a, status: 'read' as AlertStatus, read_at: new Date().toISOString() } : a
  );
}

async function dismissAlerts(ids: string[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  mockAlerts = mockAlerts.map((a) =>
    ids.includes(a.id) ? { ...a, status: 'dismissed' as AlertStatus } : a
  );
}

async function createRule(rule: Omit<AlertRule, 'id' | 'created_at'>): Promise<AlertRule> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const newRule: AlertRule = {
    ...rule,
    id: `rule-${Date.now()}`,
    created_at: new Date().toISOString(),
  };
  mockRules.push(newRule);
  return newRule;
}

async function updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule> {
  await new Promise((resolve) => setTimeout(resolve, 200));
  const index = mockRules.findIndex((r) => r.id === ruleId);
  if (index === -1) throw new Error('Rule not found');
  mockRules[index] = { ...mockRules[index], ...updates, updated_at: new Date().toISOString() };
  return mockRules[index];
}

async function deleteRule(ruleId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  mockRules = mockRules.filter((r) => r.id !== ruleId);
}

// =============================================================================
// Alert Query Hooks
// =============================================================================

/**
 * Hook to fetch all alerts with optional filters
 */
export function useAlerts(filters?: AlertFilters) {
  return useQuery({
    queryKey: alertKeys.list(filters),
    queryFn: () => fetchAlerts(filters),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to fetch unread alerts only
 */
export function useUnreadAlerts() {
  return useQuery({
    queryKey: alertKeys.unread(),
    queryFn: () => fetchAlerts({ status: 'unread' }),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60, // Refetch every minute for real-time feel
  });
}

/**
 * Hook to fetch unread count (for badges)
 */
export function useUnreadAlertCount() {
  const { data: alerts } = useUnreadAlerts();
  return alerts?.length || 0;
}

/**
 * Hook to fetch alert digest/summary
 */
export function useAlertDigest() {
  return useQuery({
    queryKey: alertKeys.digest(),
    queryFn: fetchAlertDigest,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to fetch alerts for a specific domain
 */
export function useAlertsByDomain(domain: string | undefined) {
  return useQuery({
    queryKey: alertKeys.byDomain(domain!),
    queryFn: () => fetchAlerts({ domain }),
    enabled: !!domain,
    staleTime: 1000 * 30,
  });
}

// =============================================================================
// Alert Rule Query Hooks
// =============================================================================

/**
 * Hook to fetch all alert rules
 */
export function useAlertRules() {
  return useQuery({
    queryKey: alertKeys.rules(),
    queryFn: fetchRules,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch a single rule by ID
 */
export function useAlertRule(ruleId: string | undefined) {
  const { data: rules } = useAlertRules();
  return rules?.find((r) => r.id === ruleId);
}

/**
 * Hook to get active rules count
 */
export function useActiveRulesCount() {
  const { data: rules } = useAlertRules();
  return rules?.filter((r) => r.is_active).length || 0;
}

// =============================================================================
// Alert Mutation Hooks
// =============================================================================

/**
 * Hook to mark alerts as read
 */
export function useMarkRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => markAlertsRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Mark Read',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to mark all alerts as read
 */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const { data: alerts } = useUnreadAlerts();

  return useMutation({
    mutationFn: async () => {
      const ids = alerts?.map((a) => a.id) || [];
      if (ids.length > 0) {
        await markAlertsRead(ids);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      notifications.show({
        title: 'All Alerts Read',
        message: 'All alerts have been marked as read',
        color: 'blue',
      });
    },
  });
}

/**
 * Hook to dismiss alerts
 */
export function useDismissAlerts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => dismissAlerts(ids),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.all });
      notifications.show({
        title: 'Alerts Dismissed',
        message: `Dismissed ${ids.length} alert${ids.length !== 1 ? 's' : ''}`,
        color: 'gray',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Dismiss',
        message: error.message,
        color: 'red',
      });
    },
  });
}

// =============================================================================
// Alert Rule Mutation Hooks
// =============================================================================

/**
 * Hook to create a new alert rule
 */
export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rule: Omit<AlertRule, 'id' | 'created_at'>) => createRule(rule),
    onSuccess: (newRule) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() });
      notifications.show({
        title: 'Rule Created',
        message: `"${newRule.name}" has been created`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Create Rule',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to update an existing alert rule
 */
export function useUpdateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, updates }: { ruleId: string; updates: Partial<AlertRule> }) =>
      updateRule(ruleId, updates),
    onSuccess: (updatedRule) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() });
      notifications.show({
        title: 'Rule Updated',
        message: `"${updatedRule.name}" has been updated`,
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Update Rule',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to delete an alert rule
 */
export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleId: string) => deleteRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() });
      notifications.show({
        title: 'Rule Deleted',
        message: 'Alert rule has been deleted',
        color: 'red',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Failed to Delete Rule',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to toggle a rule's active status
 */
export function useToggleRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) =>
      updateRule(ruleId, { is_active: isActive }),
    onSuccess: (updatedRule) => {
      queryClient.invalidateQueries({ queryKey: alertKeys.rules() });
      notifications.show({
        title: updatedRule.is_active ? 'Rule Enabled' : 'Rule Paused',
        message: `"${updatedRule.name}" has been ${updatedRule.is_active ? 'enabled' : 'paused'}`,
        color: updatedRule.is_active ? 'green' : 'yellow',
      });
    },
  });
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to invalidate all alert-related queries
 */
export function useInvalidateAlerts() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: alertKeys.all });
  };
}

/**
 * Hook to prefetch alerts for a domain (on hover)
 */
export function usePrefetchDomainAlerts() {
  const queryClient = useQueryClient();

  return (domain: string) => {
    queryClient.prefetchQuery({
      queryKey: alertKeys.byDomain(domain),
      queryFn: () => fetchAlerts({ domain }),
      staleTime: 1000 * 30,
    });
  };
}
