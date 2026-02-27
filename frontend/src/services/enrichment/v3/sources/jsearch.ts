/**
 * JSearch Source Module
 *
 * Provides: Hiring signals, job postings analysis
 * API: JSearch via RapidAPI (via Edge Function proxy)
 *
 * SECURITY: API key is stored in Supabase Secrets, NOT in frontend bundle
 */

import type { SourceModule, SourceResult, JSearchData, SourceOptions } from '../types';
import { callEnrichProxy } from '@/services/supabase';

// Tier 1: Decision makers (VP, C-suite, Director)
const TIER_1_PATTERNS = [
  /\b(vp|vice president)\b/i,
  /\b(cto|cio|cdo|cmo|cco|coo|ceo)\b/i,
  /\bchief\s+\w+\s+officer\b/i,
  /\bhead\s+of\b/i,
  /\bsvp|senior\s+vice\s+president\b/i,
  /\bdirector\b/i,
  /\bprincipal\b/i,
  /\bco-?founder\b/i,
];

// Tier 2: Influencers (Manager, Lead, Architect)
const TIER_2_PATTERNS = [
  /\bsenior\s+manager\b/i,
  /\bmanager\b/i,
  /\blead\b/i,
  /\barchitect\b/i,
  /\bsenior\s+product\b/i,
  /\bproduct\s+manager\b/i,
  /\bproduct\s+owner\b/i,
];

// Categories relevant to Algolia
const CATEGORIES: Record<string, string[]> = {
  'search': ['search', 'discovery', 'relevance', 'findability', 'browse', 'catalog', 'autocomplete'],
  'e-commerce': ['ecommerce', 'e-commerce', 'commerce', 'merchandis', 'retail tech'],
  'product': ['product manager', 'product owner', 'product lead', 'product director'],
  'engineering': ['engineer', 'developer', 'architect', 'devops', 'software', 'platform'],
  'data': ['data scientist', 'data engineer', 'analytics', 'ai', 'ml', 'machine learning'],
  'digital-cx': ['customer experience', 'cx', 'ux', 'user experience', 'conversion'],
  'merchandising': ['merchandis', 'category manager', 'assortment', 'site merchandis'],
};

function classifyTier(title: string): number {
  for (const pattern of TIER_1_PATTERNS) {
    if (pattern.test(title)) return 1;
  }
  for (const pattern of TIER_2_PATTERNS) {
    if (pattern.test(title)) return 2;
  }
  return 3;
}

function classifyCategories(title: string): string[] {
  const lower = title.toLowerCase();
  const matched: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) {
      matched.push(category);
    }
  }

  return matched;
}

function calculateSignalScore(
  tierBreakdown: { tier_1: number; tier_2: number; tier_3: number },
  categoryBreakdown: Record<string, number>
): number {
  let score = 0;

  // Tier scoring
  score += Math.min(60, tierBreakdown.tier_1 * 30);
  score += Math.min(45, tierBreakdown.tier_2 * 15);
  score += Math.min(20, tierBreakdown.tier_3 * 5);

  // Category bonuses
  if ((categoryBreakdown['search'] || 0) > 0) score += 25;
  if ((categoryBreakdown['e-commerce'] || 0) > 0) score += 15;
  if ((categoryBreakdown['merchandising'] || 0) > 0) score += 10;

  return Math.min(100, score);
}

function getSignalStrength(score: number): 'strong' | 'moderate' | 'weak' | 'none' {
  if (score >= 70) return 'strong';
  if (score >= 40) return 'moderate';
  if (score >= 15) return 'weak';
  return 'none';
}

interface RawJob {
  job_title?: string;
  employer_name?: string;
  job_apply_link?: string;
}

export const jsearch: SourceModule<JSearchData> = {
  id: 'jsearch',
  name: 'Job Search',

  // Edge Function availability checked at runtime
  isAvailable: () => true,

  async enrich(domain: string, options?: SourceOptions): Promise<SourceResult<JSearchData>> {
    const startTime = Date.now();

    // Extract company name from domain
    const companyName = options?.companyName || domain
      .replace(/^www\./, '')
      .split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());

    try {
      const { data: raw, error } = await callEnrichProxy<{
        status?: string;
        data?: RawJob[];
      }>({
        source: 'jsearch',
        domain,
        companyName,
      });

      if (error || !raw) {
        throw new Error(error || 'No data returned');
      }

      if (raw.status !== 'OK' || !raw.data) {
        throw new Error('API returned no data');
      }

      // Filter to company jobs only
      const companyLower = companyName.toLowerCase();
      const companyJobs = raw.data.filter((job: RawJob) =>
        job.employer_name?.toLowerCase().includes(companyLower)
      );

      if (companyJobs.length === 0) {
        const data: JSearchData = {
          total_jobs: 0,
          relevant_jobs: 0,
          signal_score: 0,
          signal_strength: 'none',
          tier_breakdown: { tier_1: 0, tier_2: 0, tier_3: 0 },
          category_breakdown: {},
          top_jobs: [],
        };

        return {
          source: 'jsearch',
          success: true,
          data,
          fetched_at: new Date().toISOString(),
          cached: false,
        };
      }

      // Analyze jobs
      const tierBreakdown = { tier_1: 0, tier_2: 0, tier_3: 0 };
      const categoryBreakdown: Record<string, number> = {};
      const matchedJobs: JSearchData['top_jobs'] = [];

      for (const job of companyJobs) {
        const title = job.job_title;
        if (!title) continue;

        const tier = classifyTier(title);
        const categories = classifyCategories(title);

        // Only count jobs with relevant categories
        if (categories.length > 0) {
          tierBreakdown[`tier_${tier}` as keyof typeof tierBreakdown]++;

          for (const cat of categories) {
            categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
          }

          matchedJobs.push({
            title,
            tier,
            categories,
            url: job.job_apply_link,
          });
        }
      }

      // Sort by tier (decision makers first)
      matchedJobs.sort((a, b) => a.tier - b.tier);

      const signalScore = calculateSignalScore(tierBreakdown, categoryBreakdown);
      const signalStrength = getSignalStrength(signalScore);

      const data: JSearchData = {
        total_jobs: companyJobs.length,
        relevant_jobs: matchedJobs.length,
        signal_score: signalScore,
        signal_strength: signalStrength,
        tier_breakdown: tierBreakdown,
        category_breakdown: categoryBreakdown,
        top_jobs: matchedJobs.slice(0, 20),
      };

      console.log(`[JSearch] ${companyName}: ${signalStrength} signal (${matchedJobs.length} relevant jobs) (${Date.now() - startTime}ms)`);

      return {
        source: 'jsearch',
        success: true,
        data,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[JSearch] ${companyName}: ${error}`);

      return {
        source: 'jsearch',
        success: false,
        data: null,
        error,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }
  },
};

export default jsearch;
