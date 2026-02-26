/**
 * useIntelligence Hook
 *
 * TanStack Query hooks for intelligence module operations.
 * Handles fetching module data, enrichment status, and triggers.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import {
  getIntelOverview,
  getModuleData,
  getEnrichmentStatus,
  triggerEnrichment,
  triggerWaveEnrichment,
  triggerModuleEnrichment,
} from '@/services/api';
import type {
  ModuleId,
  ModuleResult,
  EnrichmentStatus,
  EnrichmentJob,
  CompanyContextData,
  TechStackData,
  TrafficData,
  FinancialData,
  CompetitorData,
  HiringData,
  InvestorData,
  ExecutiveData,
  IcpPriorityData,
  SignalScoringData,
  StrategicBriefData,
} from '@/types';

// =============================================================================
// Query Keys
// =============================================================================

export const intelligenceKeys = {
  all: ['intelligence'] as const,
  overview: (domain: string) => [...intelligenceKeys.all, 'overview', domain] as const,
  module: (domain: string, moduleId: ModuleId) =>
    [...intelligenceKeys.all, 'module', domain, moduleId] as const,
  status: (domain: string) => [...intelligenceKeys.all, 'status', domain] as const,
  jobs: (domain: string) => [...intelligenceKeys.all, 'jobs', domain] as const,
};

// =============================================================================
// Module Type Mapping
// =============================================================================

type ModuleDataMap = {
  m01_company_context: CompanyContextData;
  m02_tech_stack: TechStackData;
  m03_traffic: TrafficData;
  m04_financials: FinancialData;
  m05_competitors: CompetitorData;
  m06_hiring: HiringData;
  m07_strategic: unknown;
  m08_investor: InvestorData;
  m09_executive: ExecutiveData;
  m10_buying_committee: unknown;
  m11_displacement: unknown;
  m12_case_study: unknown;
  m13_icp_priority: IcpPriorityData;
  m14_signal_scoring: SignalScoringData;
  m15_strategic_brief: StrategicBriefData;
};

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to fetch intelligence overview for a domain
 */
export function useIntelligenceOverview(domain: string | undefined) {
  return useQuery({
    queryKey: intelligenceKeys.overview(domain!),
    queryFn: () => getIntelOverview(domain!),
    enabled: !!domain,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to fetch enrichment status
 */
export function useEnrichmentStatus(domain: string | undefined, options?: { polling?: boolean }) {
  return useQuery({
    queryKey: intelligenceKeys.status(domain!),
    queryFn: () => getEnrichmentStatus(domain!),
    enabled: !!domain,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: (query) => {
      if (!options?.polling) return false;
      // Stop polling when not running
      const data = query.state.data;
      if (data?.overall_status !== 'running') {
        return false;
      }
      return 2000; // Poll every 2 seconds while running
    },
  });
}

/**
 * Generic hook to fetch module data
 */
export function useModuleData<M extends ModuleId>(
  domain: string | undefined,
  moduleId: M
) {
  return useQuery({
    queryKey: intelligenceKeys.module(domain!, moduleId),
    queryFn: () => getModuleData<ModuleDataMap[M]>(domain!, moduleId),
    enabled: !!domain,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch company context module
 */
export function useCompanyContext(domain: string | undefined) {
  return useModuleData(domain, 'm01_company_context');
}

/**
 * Hook to fetch tech stack module
 */
export function useTechStack(domain: string | undefined) {
  return useModuleData(domain, 'm02_tech_stack');
}

/**
 * Hook to fetch traffic module
 */
export function useTraffic(domain: string | undefined) {
  return useModuleData(domain, 'm03_traffic');
}

/**
 * Hook to fetch financials module
 */
export function useFinancials(domain: string | undefined) {
  return useModuleData(domain, 'm04_financials');
}

/**
 * Hook to fetch competitors module
 */
export function useCompetitors(domain: string | undefined) {
  return useModuleData(domain, 'm05_competitors');
}

/**
 * Hook to fetch hiring module
 */
export function useHiring(domain: string | undefined) {
  return useModuleData(domain, 'm06_hiring');
}

/**
 * Hook to fetch investor module
 */
export function useInvestor(domain: string | undefined) {
  return useModuleData(domain, 'm08_investor');
}

/**
 * Hook to fetch executive quotes module
 */
export function useExecutiveQuotes(domain: string | undefined) {
  return useModuleData(domain, 'm09_executive');
}

/**
 * Hook to fetch ICP priority module
 */
export function useIcpPriority(domain: string | undefined) {
  return useModuleData(domain, 'm13_icp_priority');
}

/**
 * Hook to fetch signal scoring module
 */
export function useSignalScoring(domain: string | undefined) {
  return useModuleData(domain, 'm14_signal_scoring');
}

/**
 * Hook to fetch strategic brief module
 */
export function useStrategicBrief(domain: string | undefined) {
  return useModuleData(domain, 'm15_strategic_brief');
}

/**
 * Hook to fetch all modules for a domain
 */
export function useAllModules(domain: string | undefined) {
  const companyContext = useCompanyContext(domain);
  const techStack = useTechStack(domain);
  const traffic = useTraffic(domain);
  const financials = useFinancials(domain);
  const competitors = useCompetitors(domain);
  const hiring = useHiring(domain);
  const investor = useInvestor(domain);
  const executiveQuotes = useExecutiveQuotes(domain);
  const icpPriority = useIcpPriority(domain);
  const signalScoring = useSignalScoring(domain);
  const strategicBrief = useStrategicBrief(domain);

  const isLoading =
    companyContext.isLoading ||
    techStack.isLoading ||
    traffic.isLoading ||
    financials.isLoading ||
    competitors.isLoading ||
    hiring.isLoading ||
    investor.isLoading ||
    executiveQuotes.isLoading ||
    icpPriority.isLoading ||
    signalScoring.isLoading ||
    strategicBrief.isLoading;

  return {
    companyContext,
    techStack,
    traffic,
    financials,
    competitors,
    hiring,
    investor,
    executiveQuotes,
    icpPriority,
    signalScoring,
    strategicBrief,
    isLoading,
  };
}

// =============================================================================
// Mutation Hooks
// =============================================================================

/**
 * Hook to trigger full enrichment
 */
export function useTriggerEnrichmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ domain, force = false }: { domain: string; force?: boolean }) =>
      triggerEnrichment(domain, force),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: intelligenceKeys.status(variables.domain),
      });
      notifications.show({
        title: 'Enrichment Started',
        message: `Processing all modules for ${variables.domain}`,
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
 * Hook to trigger wave enrichment
 */
export function useTriggerWaveEnrichmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      domain,
      wave,
      force = false,
    }: {
      domain: string;
      wave: 1 | 2 | 3 | 4;
      force?: boolean;
    }) => triggerWaveEnrichment(domain, wave, force),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: intelligenceKeys.status(variables.domain),
      });
      notifications.show({
        title: `Wave ${variables.wave} Started`,
        message: `Processing wave ${variables.wave} for ${variables.domain}`,
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Wave Enrichment Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to trigger single module enrichment
 */
export function useTriggerModuleEnrichmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      domain,
      moduleId,
      force = false,
    }: {
      domain: string;
      moduleId: ModuleId;
      force?: boolean;
    }) => triggerModuleEnrichment(domain, moduleId, force),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: intelligenceKeys.module(variables.domain, variables.moduleId),
      });
      queryClient.invalidateQueries({
        queryKey: intelligenceKeys.status(variables.domain),
      });
      notifications.show({
        title: 'Module Enrichment Started',
        message: `Processing ${variables.moduleId} for ${variables.domain}`,
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Module Enrichment Failed',
        message: error.message,
        color: 'red',
      });
    },
  });
}

/**
 * Hook to invalidate all intelligence data for a domain
 */
export function useInvalidateIntelligence() {
  const queryClient = useQueryClient();

  return (domain: string) => {
    queryClient.invalidateQueries({
      queryKey: [...intelligenceKeys.all, 'module', domain],
    });
    queryClient.invalidateQueries({
      queryKey: intelligenceKeys.overview(domain),
    });
    queryClient.invalidateQueries({
      queryKey: intelligenceKeys.status(domain),
    });
  };
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to check module completion status
 */
export function useModuleCompletionStatus(domain: string | undefined) {
  const { data: status } = useEnrichmentStatus(domain);

  if (!status?.modules) {
    return {
      total: 15,
      completed: 0,
      running: 0,
      pending: 15,
      errored: 0,
      percentage: 0,
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
  };
}

/**
 * Hook to prefetch module data
 */
export function usePrefetchModule() {
  const queryClient = useQueryClient();

  return (domain: string, moduleId: ModuleId) => {
    queryClient.prefetchQuery({
      queryKey: intelligenceKeys.module(domain, moduleId),
      queryFn: () => getModuleData(domain, moduleId),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  };
}
