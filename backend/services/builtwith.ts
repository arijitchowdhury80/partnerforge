import { HttpClient } from './http-client';
import { config } from '../config';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * BuiltWith API Client
 *
 * Provides technology detection and analysis using BuiltWith's comprehensive database.
 * All endpoints use 7-day caching and token bucket rate limiting (5 req/s).
 *
 * Base URL: https://api.builtwith.com
 * Rate Limit: 5 requests/second
 * Cache TTL: 7 days (604800 seconds)
 * Cost per call: $0.02
 *
 * @see https://api.builtwith.com/
 */
export class BuiltWithClient {
  private http: HttpClient;
  private apiKey: string;
  private readonly CACHE_TTL = 604800; // 7 days
  private readonly COST_PER_CALL = 0.02;

  constructor() {
    this.http = new HttpClient(
      'https://api.builtwith.com',
      this.CACHE_TTL
    );

    this.apiKey = process.env.BUILTWITH_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('BUILTWITH_API_KEY not configured - API calls will fail');
    }
  }

  /**
   * Get complete technology stack for a domain
   *
   * Returns all detected technologies across categories (CMS, eCommerce, Analytics, etc.)
   * with first/last detection timestamps.
   *
   * @param domain - Domain to analyze (e.g., "costco.com")
   * @returns Technology stack with detection history
   *
   * @example
   * ```typescript
   * const client = new BuiltWithClient();
   * const techStack = await client.getDomainTechnologies('costco.com');
   * console.log(techStack.data.Results[0].Result.Paths[0].Technologies);
   * ```
   */
  async getDomainTechnologies(domain: string): Promise<APIResponse<TechStackData>> {
    logger.info(`BuiltWith: Fetching tech stack for ${domain}`);

    return this.http.get<TechStackData>(
      '/v20/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get technology relationships (what techs are used together)
   *
   * Returns data on technology combinations - e.g., how many sites
   * use Shopify + Klaviyo together.
   *
   * @param domain - Domain to analyze
   * @returns Technology combination data
   *
   * @example
   * ```typescript
   * const relationships = await client.getRelationships('shopify.com');
   * // Find sites using Shopify + specific marketing tools
   * ```
   */
  async getRelationships(domain: string): Promise<APIResponse<RelationshipData>> {
    logger.info(`BuiltWith: Fetching relationships for ${domain}`);

    return this.http.get<RelationshipData>(
      '/v13/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get recommended technologies based on current stack
   *
   * Suggests technologies that similar companies use, based on
   * the target domain's existing tech stack.
   *
   * @param domain - Domain to analyze
   * @returns Recommended technologies with adoption metrics
   *
   * @example
   * ```typescript
   * const recs = await client.getRecommendations('example.com');
   * // Identify missing capabilities in their stack
   * ```
   */
  async getRecommendations(domain: string): Promise<APIResponse<RecommendationData>> {
    logger.info(`BuiltWith: Fetching recommendations for ${domain}`);

    return this.http.get<RecommendationData>(
      '/v16/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get company financial estimates
   *
   * Returns estimated company size, revenue, and employee count
   * based on technology spend and online presence.
   *
   * @param domain - Domain to analyze
   * @returns Financial estimates and company size metrics
   *
   * @example
   * ```typescript
   * const financials = await client.getFinancials('stripe.com');
   * // Use for ICP scoring and qualification
   * ```
   */
  async getFinancials(domain: string): Promise<APIResponse<FinancialData>> {
    logger.info(`BuiltWith: Fetching financials for ${domain}`);

    return this.http.get<FinancialData>(
      '/v17/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get social media profiles
   *
   * Returns company social media presence across platforms
   * (Twitter, LinkedIn, Facebook, etc.) with follower counts.
   *
   * @param domain - Domain to analyze
   * @returns Social media profile URLs and engagement metrics
   *
   * @example
   * ```typescript
   * const social = await client.getSocialProfiles('airbnb.com');
   * // Identify social reach and engagement
   * ```
   */
  async getSocialProfiles(domain: string): Promise<APIResponse<SocialData>> {
    logger.info(`BuiltWith: Fetching social profiles for ${domain}`);

    return this.http.get<SocialData>(
      '/v18/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get trust and security indicators
   *
   * Returns SSL certificate status, security badges, trust seals,
   * and privacy policy compliance indicators.
   *
   * @param domain - Domain to analyze
   * @returns Trust signals and security metrics
   *
   * @example
   * ```typescript
   * const trust = await client.getTrustIndicators('amazon.com');
   * // Assess security posture and trust signals
   * ```
   */
  async getTrustIndicators(domain: string): Promise<APIResponse<TrustData>> {
    logger.info(`BuiltWith: Fetching trust indicators for ${domain}`);

    return this.http.get<TrustData>(
      '/v19/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get SEO keywords (BuiltWith's own keyword data)
   *
   * Returns keyword rankings and search visibility metrics
   * from BuiltWith's proprietary dataset.
   *
   * @param domain - Domain to analyze
   * @returns Keyword rankings and search metrics
   *
   * @example
   * ```typescript
   * const keywords = await client.getKeywords('zappos.com');
   * // Analyze search visibility and SEO strategy
   * ```
   */
  async getKeywords(domain: string): Promise<APIResponse<KeywordData>> {
    logger.info(`BuiltWith: Fetching keywords for ${domain}`);

    return this.http.get<KeywordData>(
      '/v21/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domain
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Batch lookup for multiple domains
   *
   * Efficiently fetch tech stacks for up to 100 domains in a single API call.
   * Useful for competitor analysis and market research.
   *
   * @param domains - Array of domains to analyze (max 100)
   * @returns Technology stacks for all domains
   *
   * @example
   * ```typescript
   * const competitors = ['target.com', 'walmart.com', 'kroger.com'];
   * const techStacks = await client.batchLookup(competitors);
   * // Compare tech stacks across competitors
   * ```
   */
  async batchLookup(domains: string[]): Promise<APIResponse<BatchTechStackData>> {
    if (domains.length === 0) {
      throw new Error('Batch lookup requires at least 1 domain');
    }

    if (domains.length > 100) {
      throw new Error('Batch lookup supports max 100 domains per call');
    }

    logger.info(`BuiltWith: Batch lookup for ${domains.length} domains`);

    return this.http.get<BatchTechStackData>(
      '/v20/api.json',
      {
        KEY: this.apiKey,
        LOOKUP: domains.join(',')
      },
      {
        rateLimitKey: 'builtwith',
        cacheTTL: this.CACHE_TTL
      }
    );
  }

  /**
   * Get API usage statistics
   *
   * Returns current API quota usage and limits.
   * Useful for monitoring and cost tracking.
   *
   * @returns API usage statistics
   */
  async getUsageStats(): Promise<APIResponse<UsageStatsData>> {
    logger.info('BuiltWith: Fetching API usage stats');

    return this.http.get<UsageStatsData>(
      '/usage.json',
      {
        KEY: this.apiKey
      },
      {
        rateLimitKey: 'builtwith',
        skipCache: true // Always fetch fresh usage data
      }
    );
  }
}

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Technology detection result
 */
export interface Technology {
  Tag: string;          // Category (e.g., "CMS", "eCommerce", "Analytics")
  Name: string;         // Technology name (e.g., "Shopify Plus")
  FirstDetected: number; // Unix timestamp
  LastDetected: number;  // Unix timestamp
  IsPremium?: boolean;   // Premium/paid tier indicator
  Description?: string;  // Technology description
  Link?: string;         // Technology vendor URL
}

/**
 * Technology path (URL-level detection)
 */
export interface TechPath {
  Domain: string;       // Domain name
  Url: string;          // Specific URL analyzed
  Technologies: Technology[];
  SubDomain?: string;   // Subdomain if applicable
}

/**
 * Complete tech stack response
 */
export interface TechStackData {
  Results: Array<{
    Result: {
      Paths: TechPath[];
      IsDB?: boolean;     // Is this domain in BuiltWith's database?
      Lookup?: string;    // Original lookup domain
    };
  }>;
  Errors?: Array<{
    Domain: string;
    Message: string;
  }>;
}

/**
 * Batch tech stack response
 */
export interface BatchTechStackData {
  Results: Array<{
    Domain: string;
    Result: {
      Paths: TechPath[];
    };
  }>;
  Errors?: Array<{
    Domain: string;
    Message: string;
  }>;
}

/**
 * Technology relationship data
 */
export interface RelationshipData {
  Relationships: Array<{
    TechA: string;        // First technology
    TechB: string;        // Second technology
    Count: number;        // Sites using both
    Percentage?: number;  // Percentage of TechA users also using TechB
  }>;
}

/**
 * Technology recommendations
 */
export interface RecommendationData {
  Recommendations: Array<{
    Technology: string;   // Recommended technology name
    Category: string;     // Technology category
    Reason: string;       // Why recommended
    AdoptionRate: number; // % of similar sites using it
    Priority: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Company financial estimates
 */
export interface FinancialData {
  Company: string;
  Domain: string;
  Estimates: {
    Revenue: {
      Min: number;        // Minimum estimated revenue (USD)
      Max: number;        // Maximum estimated revenue (USD)
      Currency: string;   // Currency code (e.g., "USD")
    };
    Employees: {
      Min: number;        // Minimum employee count
      Max: number;        // Maximum employee count
    };
    CompanySize: 'small' | 'medium' | 'large' | 'enterprise';
    FundingStage?: string; // Funding stage (if startup)
    LastUpdated: string;   // ISO date string
  };
}

/**
 * Social media profile data
 */
export interface SocialData {
  Domain: string;
  Profiles: Array<{
    Platform: string;     // "Twitter", "LinkedIn", "Facebook", etc.
    Url: string;          // Profile URL
    Handle?: string;      // Social media handle
    Followers?: number;   // Follower count
    Verified?: boolean;   // Verified account indicator
    LastUpdated?: string; // ISO date string
  }>;
}

/**
 * Trust and security indicators
 */
export interface TrustData {
  Domain: string;
  Security: {
    HasSSL: boolean;
    SSLProvider?: string;
    SSLExpiry?: string;   // ISO date string
    HasHSTS?: boolean;    // HTTP Strict Transport Security
  };
  TrustSignals: {
    HasPrivacyPolicy: boolean;
    HasTermsOfService: boolean;
    HasCookieConsent: boolean;
    TrustBadges: string[]; // TrustPilot, BBB, etc.
  };
  Compliance: {
    GDPR?: boolean;
    CCPA?: boolean;
    PCI?: boolean;
  };
}

/**
 * SEO keyword data
 */
export interface KeywordData {
  Domain: string;
  Keywords: Array<{
    Keyword: string;      // Search term
    Rank: number;         // Search engine rank
    Volume: number;       // Monthly search volume
    Competition: 'low' | 'medium' | 'high';
    CPC?: number;         // Cost per click (USD)
    URL?: string;         // Ranking page URL
  }>;
  OrganicVisibility: number; // 0-100 score
}

/**
 * API usage statistics
 */
export interface UsageStatsData {
  ApiKey: string;        // Masked API key
  CurrentUsage: {
    CallsThisMonth: number;
    CallsToday: number;
    LastCallTimestamp: string;
  };
  Limits: {
    MonthlyLimit: number;
    DailyLimit: number;
    RateLimitPerSecond: number;
  };
  RemainingQuota: {
    Monthly: number;
    Daily: number;
  };
}

/**
 * Export singleton instance
 */
export const builtWithClient = new BuiltWithClient();
