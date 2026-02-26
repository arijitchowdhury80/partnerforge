/**
 * Hooks Barrel Export
 */

// Legacy list hooks (for backwards compatibility)
export {
  useLists,
  useListDetail,
  useUploadList as useLegacyUploadList,
  useDeleteList as useLegacyDeleteList,
  useStartEnrichment as useLegacyStartEnrichment,
  useRetryEnrichment,
  useExportList,
  listKeys,
  type UploadListPayload,
  type ListFilters,
} from './useLists';

// Upload hooks
export {
  uploadKeys,
  useUploadLists,
  useUploadList,
  useListStatus,
  useListItems,
  useUploadMutation,
  useConfirmMappingMutation,
  useValidateMutation,
  useStartEnrichmentMutation,
  useDownloadResultsMutation,
  useDeleteListMutation,
  useRetryFailedMutation,
} from './useUpload';

// Target hooks
export {
  targetKeys,
  useDashboardStats,
  useTargets,
  useInfiniteTargets,
  useTarget,
  usePrefetchTarget,
  useCreateTargetMutation,
  useHotLeads,
  useWarmLeads,
  useSearchTargets,
  useTargetsByPartner,
  useInvalidateTargets,
  useTargetStatusCounts,
  useTargetExists,
} from './useTargets';

// Intelligence hooks
export {
  intelligenceKeys,
  useIntelligenceOverview,
  useEnrichmentStatus,
  useModuleData,
  useCompanyContext,
  useTechStack,
  useTraffic,
  useFinancials,
  useCompetitors,
  useHiring,
  useInvestor,
  useExecutiveQuotes,
  useIcpPriority,
  useSignalScoring,
  useStrategicBrief,
  useAllModules,
  useTriggerEnrichmentMutation,
  useTriggerWaveEnrichmentMutation,
  useTriggerModuleEnrichmentMutation,
  useInvalidateIntelligence,
  useModuleCompletionStatus,
  usePrefetchModule,
} from './useIntelligence';

// Column detection hooks
export {
  useColumnDetection,
  useManualColumnMapping,
  type ColumnDetectionResult,
  type UseColumnDetectionOptions,
} from './useColumnDetection';
