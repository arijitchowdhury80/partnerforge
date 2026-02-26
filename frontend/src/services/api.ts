/**
 * PartnerForge API Service
 *
 * Centralized API client for all backend communication.
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  Company,
  DashboardStats,
  EnrichmentStatus,
  EnrichmentJob,
  ModuleId,
  ModuleResult,
  PaginatedResponse,
  FilterState,
  ApiError,
} from '@/types';

// =============================================================================
// API Client Configuration
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handler
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const message = error.response?.data?.detail || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// =============================================================================
// Health & Stats
// =============================================================================

export async function getHealth(): Promise<{
  status: string;
  app: string;
  version: string;
  database: { status: string; latency_ms: number };
}> {
  const { data } = await apiClient.get('/health');
  return data;
}

export async function getStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get('/stats');
  return data;
}

// =============================================================================
// Companies / Targets
// =============================================================================

export async function getCompanies(
  filters: FilterState & { page?: number; limit?: number }
): Promise<PaginatedResponse<Company>> {
  // Use the v1/targets endpoint which has the actual data
  const params = {
    page: filters.page || 1,
    per_page: filters.limit || 50,
    status: filters.status,
    partner: filters.partner,
    min_score: filters.min_score,
    sort_by: filters.sort_by || 'icp_score',
    sort_order: filters.sort_order || 'desc',
  };
  const { data } = await apiClient.get('/v1/targets', { params });
  // Transform response from targets format to PaginatedResponse format
  return {
    data: data.targets || [],
    pagination: data.pagination || { page: 1, limit: 50, total: 0, total_pages: 0 },
  };
}

export async function getCompany(domain: string): Promise<Company> {
  const { data } = await apiClient.get(`/v1/targets/${domain}`);
  return data;
}

export async function createCompany(domain: string): Promise<Company> {
  const { data } = await apiClient.post('/companies', { domain });
  return data;
}

// =============================================================================
// Intelligence Modules
// =============================================================================

export async function getIntelOverview(
  domain: string
): Promise<{ domain: string; modules: Record<ModuleId, { status: string; last_updated?: string }> }> {
  const { data } = await apiClient.get(`/intel/${domain}/overview`);
  return data;
}

export async function getModuleData<T>(
  domain: string,
  moduleId: ModuleId
): Promise<ModuleResult<T>> {
  const shortId = moduleId.substring(0, 3); // m01, m02, etc.
  const { data } = await apiClient.get(`/intel/${domain}/${shortId}`);
  return data;
}

// Convenience methods for each module
export const modules = {
  companyContext: (domain: string) => getModuleData(domain, 'm01_company_context'),
  techStack: (domain: string) => getModuleData(domain, 'm02_tech_stack'),
  traffic: (domain: string) => getModuleData(domain, 'm03_traffic'),
  financials: (domain: string) => getModuleData(domain, 'm04_financials'),
  competitors: (domain: string) => getModuleData(domain, 'm05_competitors'),
  hiring: (domain: string) => getModuleData(domain, 'm06_hiring'),
  strategic: (domain: string) => getModuleData(domain, 'm07_strategic'),
  investor: (domain: string) => getModuleData(domain, 'm08_investor'),
  executive: (domain: string) => getModuleData(domain, 'm09_executive'),
  buyingCommittee: (domain: string) => getModuleData(domain, 'm10_buying_committee'),
  displacement: (domain: string) => getModuleData(domain, 'm11_displacement'),
  caseStudy: (domain: string) => getModuleData(domain, 'm12_case_study'),
  icpPriority: (domain: string) => getModuleData(domain, 'm13_icp_priority'),
  signalScoring: (domain: string) => getModuleData(domain, 'm14_signal_scoring'),
  strategicBrief: (domain: string) => getModuleData(domain, 'm15_strategic_brief'),
};

// =============================================================================
// Enrichment
// =============================================================================

export async function triggerEnrichment(
  domain: string,
  force = false
): Promise<EnrichmentJob> {
  const { data } = await apiClient.post(`/enrich/${domain}`, null, {
    params: { force },
  });
  return data;
}

export async function triggerWaveEnrichment(
  domain: string,
  waveNum: 1 | 2 | 3 | 4,
  force = false
): Promise<EnrichmentJob> {
  const { data } = await apiClient.post(`/enrich/${domain}/wave/${waveNum}`, null, {
    params: { force },
  });
  return data;
}

export async function triggerModuleEnrichment(
  domain: string,
  moduleId: ModuleId,
  force = false
): Promise<EnrichmentJob> {
  const { data } = await apiClient.post(`/enrich/${domain}/module/${moduleId}`, null, {
    params: { force },
  });
  return data;
}

export async function getEnrichmentStatus(domain: string): Promise<EnrichmentStatus> {
  const { data } = await apiClient.get(`/enrich/${domain}/status`);
  return data;
}

export async function getActiveJobs(
  status?: 'queued' | 'running' | 'complete' | 'failed'
): Promise<{ jobs: EnrichmentJob[] }> {
  const { data } = await apiClient.get('/enrich/jobs', { params: { status } });
  return data;
}

// =============================================================================
// Cache Management
// =============================================================================

export async function getCacheStatus(): Promise<{
  total_cached: number;
  fresh: number;
  stale: number;
  expired: number;
}> {
  const { data } = await apiClient.get('/cache/status');
  return data;
}

export async function invalidateCache(
  domain: string,
  moduleId?: ModuleId
): Promise<{ invalidated: boolean }> {
  const { data } = await apiClient.post(`/cache/invalidate/${domain}`, null, {
    params: { module_id: moduleId },
  });
  return data;
}

// =============================================================================
// Export API Client for Custom Requests
// =============================================================================

export { apiClient };
