/**
 * useColumnDetection Hook
 *
 * Auto-detect column mappings from CSV headers.
 * Uses fuzzy matching and pattern recognition to identify common fields.
 *
 * Supports headers from:
 * - Salesforce exports
 * - Demandbase exports
 * - 6sense exports
 * - Custom/Manual exports
 */

import { useMemo, useCallback, useState } from 'react';
import type { ColumnMapping } from '@/types';

// =============================================================================
// Column Mapping Configuration
// =============================================================================

/**
 * Mapping of PartnerForge fields to common CSV header variations.
 * Order matters - first match wins.
 */
const COLUMN_MAPPING_CANDIDATES: Record<keyof ColumnMapping, string[]> = {
  // Domain (REQUIRED - primary key for enrichment)
  domain: [
    'domain',
    'website',
    'company_website',
    'url',
    'web',
    'company_domain',
    'website_url',
    'company_url',
    'site',
    'web_url',
    'company_site',
    'web_domain',
  ],

  // Company name
  company_name: [
    'account_name',
    'company',
    'company_name',
    'name',
    'account',
    'organization',
    'org_name',
    'business_name',
    'company_legal_name',
    'account_name_1',
  ],

  // Salesforce ID
  salesforce_id: [
    'account_id',
    '18_digit_account_id',
    'sf_id',
    'salesforce_id',
    'sfdc_id',
    'salesforce_account_id',
    '18_digit_id',
    'crm_id',
    'sf_account_id',
    'account_id_18',
  ],

  // Demandbase ID
  demandbase_id: [
    'abm_id',
    'demandbase_id',
    'db_id',
    'demandbase_account_id',
    'db_account_id',
    'abx_id',
  ],

  // Revenue (pre-existing data from CSV)
  revenue: [
    'revenue',
    'annual_revenue',
    'arr',
    'expected_revenue',
    'company_revenue',
    'annual_revenue_range',
    'estimated_revenue',
    'total_revenue',
    'yearly_revenue',
    'revenue_range',
  ],

  // Traffic (pre-existing data from CSV)
  traffic: [
    'traffic',
    'monthly_visits',
    'visits',
    'monthly_traffic',
    'website_traffic',
    'site_traffic',
    'monthly_visitors',
    'unique_visitors',
    'page_views',
  ],

  // Industry/Vertical
  industry: [
    'industry',
    'vertical',
    'demandbase_industry',
    'naics_description',
    'primary_industry',
    'sector',
    'industry_category',
    'company_industry',
    'business_type',
    'industry_vertical',
  ],

  // Account Owner
  owner: [
    'account_owner',
    'owner',
    'sales_rep',
    'ae',
    'demandbase_account_owner_name',
    'owner_name',
    'account_executive',
    'assigned_to',
    'sales_owner',
    'rep_name',
    'account_manager',
  ],

  // Sales Region
  region: [
    'sales_region',
    'region',
    'territory',
    'account_region',
    'geo',
    'geography',
    'sales_territory',
    'area',
    'zone',
    'market_region',
  ],

  // Journey Stage (ABM)
  journey_stage: [
    'journey_stage',
    'stage',
    'abx_status',
    'buyer_journey_stage',
    'abm_stage',
    'funnel_stage',
    'lifecycle_stage',
    'account_stage',
    'pipeline_stage',
    'engagement_stage',
  ],

  // Engagement Score
  engagement_score: [
    'engagement_points',
    'engagement_score',
    'score',
    'abm_score',
    'intent_score',
    'activity_score',
    'account_score',
    'lead_score',
    'priority_score',
    'qualification_score',
  ],
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Normalize a string for comparison.
 * Converts to lowercase, removes special characters, replaces spaces with underscores.
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');
}

/**
 * Calculate similarity score between two strings.
 * Returns a value between 0 (no match) and 1 (exact match).
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  // Exact match
  if (s1 === s2) return 1;

  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Word-level matching
  const words1 = s1.split('_');
  const words2 = s2.split('_');
  const commonWords = words1.filter((w) => words2.includes(w));
  if (commonWords.length > 0) {
    return commonWords.length / Math.max(words1.length, words2.length) * 0.7;
  }

  return 0;
}

/**
 * Find the best matching candidate for a header.
 */
function findBestMatch(
  header: string,
  candidates: string[]
): { match: string | null; score: number } {
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = calculateSimilarity(header, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  // Only return matches above threshold
  return bestScore >= 0.7 ? { match: bestMatch, score: bestScore } : { match: null, score: 0 };
}

// =============================================================================
// Hook Types
// =============================================================================

export interface ColumnDetectionResult {
  /** Detected column mappings */
  mapping: ColumnMapping;
  /** Headers that were successfully mapped */
  mappedHeaders: string[];
  /** Headers that could not be mapped */
  unmappedHeaders: string[];
  /** Whether domain (required) was detected */
  hasDomain: boolean;
  /** Confidence score (0-100) based on number of matched columns */
  confidence: number;
  /** Detection warnings or suggestions */
  warnings: string[];
}

export interface UseColumnDetectionOptions {
  /** Minimum similarity threshold for matching (0-1, default 0.7) */
  threshold?: number;
  /** Custom mapping overrides */
  overrides?: Partial<Record<keyof ColumnMapping, string[]>>;
}

// =============================================================================
// Main Hook
// =============================================================================

/**
 * Hook to auto-detect column mappings from CSV headers.
 *
 * @param headers - Array of CSV column headers
 * @param options - Detection options
 * @returns Detection result with mapping, confidence, and warnings
 *
 * @example
 * ```tsx
 * const { mapping, hasDomain, confidence, warnings } = useColumnDetection(csvHeaders);
 *
 * if (!hasDomain) {
 *   // Show column mapping UI for user to select domain column
 * }
 * ```
 */
export function useColumnDetection(
  headers: string[],
  options: UseColumnDetectionOptions = {}
): ColumnDetectionResult {
  const { threshold = 0.7, overrides = {} } = options;

  // Merge default candidates with overrides
  const candidates = useMemo(
    () => ({
      ...COLUMN_MAPPING_CANDIDATES,
      ...overrides,
    }),
    [overrides]
  );

  // Create normalized header map
  const headerMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const header of headers) {
      map[normalizeString(header)] = header;
    }
    return map;
  }, [headers]);

  // Detect mappings
  const result = useMemo<ColumnDetectionResult>(() => {
    const mapping: ColumnMapping = {};
    const mappedHeaders: string[] = [];
    const usedHeaders = new Set<string>();
    const warnings: string[] = [];

    // Process each field type
    for (const [field, fieldCandidates] of Object.entries(candidates) as [
      keyof ColumnMapping,
      string[]
    ][]) {
      // Check for exact matches first
      for (const candidate of fieldCandidates) {
        const normalizedCandidate = normalizeString(candidate);
        if (headerMap[normalizedCandidate] && !usedHeaders.has(headerMap[normalizedCandidate])) {
          mapping[field] = headerMap[normalizedCandidate];
          mappedHeaders.push(headerMap[normalizedCandidate]);
          usedHeaders.add(headerMap[normalizedCandidate]);
          break;
        }
      }

      // If no exact match, try fuzzy matching
      if (!mapping[field]) {
        for (const header of headers) {
          if (usedHeaders.has(header)) continue;

          const { match, score } = findBestMatch(header, fieldCandidates);
          if (match && score >= threshold) {
            mapping[field] = header;
            mappedHeaders.push(header);
            usedHeaders.add(header);
            break;
          }
        }
      }
    }

    // Calculate unmapped headers
    const unmappedHeaders = headers.filter((h) => !usedHeaders.has(h));

    // Calculate confidence
    const requiredFields: (keyof ColumnMapping)[] = ['domain'];
    const optionalFields: (keyof ColumnMapping)[] = [
      'company_name',
      'salesforce_id',
      'demandbase_id',
      'revenue',
      'traffic',
      'industry',
      'owner',
      'region',
      'journey_stage',
      'engagement_score',
    ];

    const requiredMapped = requiredFields.filter((f) => mapping[f]).length;
    const optionalMapped = optionalFields.filter((f) => mapping[f]).length;

    const confidence = Math.round(
      (requiredMapped / requiredFields.length) * 70 +
        (optionalMapped / optionalFields.length) * 30
    );

    // Generate warnings
    if (!mapping.domain) {
      warnings.push('Required field "domain" was not detected. Please map it manually.');
    }
    if (!mapping.company_name) {
      warnings.push('Company name was not detected. Companies will be identified by domain only.');
    }
    if (unmappedHeaders.length > headers.length / 2) {
      warnings.push(
        `${unmappedHeaders.length} columns could not be mapped. These will be preserved but not used for enrichment.`
      );
    }

    return {
      mapping,
      mappedHeaders,
      unmappedHeaders,
      hasDomain: !!mapping.domain,
      confidence,
      warnings,
    };
  }, [headers, candidates, headerMap, threshold]);

  return result;
}

// =============================================================================
// Utility Hook for Manual Mapping
// =============================================================================

/**
 * Hook to manage manual column mapping with validation.
 *
 * @param initialMapping - Initial mapping from auto-detection
 * @param headers - Available CSV headers
 * @returns Mapping state and handlers
 */
export function useManualColumnMapping(
  initialMapping: ColumnMapping,
  headers: string[]
) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);

  // Track which headers are used
  const usedHeaders = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping]
  );

  // Get available headers for a field
  const getAvailableHeaders = useCallback(
    (field: keyof ColumnMapping): string[] => {
      const currentValue = mapping[field];
      return headers.filter((h) => !usedHeaders.has(h) || h === currentValue);
    },
    [headers, mapping, usedHeaders]
  );

  // Update a single field mapping
  const updateMapping = useCallback(
    (field: keyof ColumnMapping, header: string | null) => {
      setMapping((prev) => ({
        ...prev,
        [field]: header || undefined,
      }));
    },
    []
  );

  // Reset to initial mapping
  const resetMapping = useCallback(() => {
    setMapping(initialMapping);
  }, [initialMapping]);

  // Validate mapping
  const isValid = useMemo(() => !!mapping.domain, [mapping]);

  return {
    mapping,
    setMapping,
    updateMapping,
    resetMapping,
    getAvailableHeaders,
    isValid,
    usedHeaders,
  };
}
