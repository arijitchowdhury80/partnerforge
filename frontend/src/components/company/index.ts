/**
 * Company Components - Barrel Export
 */

export { CompanyView } from './CompanyView';
export { CompanyHeader } from './CompanyHeader';
export { IntelligenceModules, MODULE_CONFIGS, WAVE_LABELS } from './IntelligenceModules';
export type { ModuleConfig, ModuleData } from './IntelligenceModules';
export { ChangeTimeline } from './ChangeTimeline';
export type { ChangeEntry, Significance, ChangeTimelineProps } from './ChangeTimeline';
export { EnrichmentProgress, ENRICHMENT_STEPS } from './EnrichmentProgress';
export type {
  EnrichmentProgressProps,
  EnrichmentStepStatus,
  EnrichmentStep,
  FailedSource,
} from './EnrichmentProgress';
