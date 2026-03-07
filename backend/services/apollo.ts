import { HttpClient } from './http-client';
import { config } from '../config';
import { APIResponse } from '../types';
import { logger } from '../utils/logger';

/**
 * Apollo.io API Client
 *
 * Provides access to Apollo.io's People Search and Intent Signals APIs
 * for identifying buying committee members and intent data.
 *
 * Rate Limit: 5 req/s (configured)
 * Cost: $0.02 per API call
 * Cache TTL: 7 days (604800 seconds)
 *
 * @see https://apolloio.github.io/apollo-api-docs/
 */
export class ApolloClient {
  private http: HttpClient;
  private readonly baseURL = 'https://api.apollo.io/v1';
  private readonly cacheTTL = 604800; // 7 days
  private readonly costPerCall = 0.02; // $0.02 USD
  private readonly rateLimitKey = 'apollo';

  constructor() {
    this.http = new HttpClient(
      this.baseURL,
      this.cacheTTL
    );

    // Set API key in axios client headers
    this.http['client'].defaults.headers.common['X-Api-Key'] = config.apiKeys?.apollo || '';

    logger.info('Apollo.io client initialized', {
      baseURL: this.baseURL,
      cacheTTL: this.cacheTTL,
      rateLimit: config.rateLimit.apollo
    });
  }

  /**
   * Search for people (executives/decision makers) at a company
   *
   * Finds buying committee members including C-level executives, VPs, and Directors
   * based on company domain and job titles.
   *
   * @param companyDomain - Company website domain (e.g., "costco.com")
   * @param titles - Array of job titles to search for (e.g., ["CEO", "CTO", "VP Engineering"])
   * @param limit - Maximum number of results to return (default: 25)
   * @returns List of people with contact information
   *
   * @example
   * ```typescript
   * const apollo = new ApolloClient();
   * const executives = await apollo.searchPeople('costco.com', [
   *   'CEO', 'CFO', 'CTO', 'CIO',
   *   'VP Engineering', 'VP Technology',
   *   'Director of Engineering'
   * ]);
   *
   * // Returns:
   * // {
   * //   data: {
   * //     people: [
   * //       {
   * //         id: "abc123",
   * //         first_name: "Richard",
   * //         last_name: "Galanti",
   * //         title: "CFO",
   * //         email: "richard.galanti@costco.com",
   * //         phone: "+1-425-313-8100",
   * //         linkedin_url: "https://linkedin.com/in/...",
   * //         organization: {
   * //           name: "Costco Wholesale",
   * //           domain: "costco.com"
   * //         }
   * //       }
   * //     ],
   * //     pagination: { page: 1, per_page: 25, total: 15 }
   * //   },
   * //   meta: { source: 'cache', cached: true, ... }
   * // }
   * ```
   */
  async searchPeople(
    companyDomain: string,
    titles: string[],
    limit: number = 25
  ): Promise<APIResponse<PeopleSearchResponse>> {
    const params: PeopleSearchParams = {
      q_organization_domains: companyDomain,
      person_titles: titles,
      per_page: limit,
      page: 1
    };

    logger.debug('Apollo.io: Searching people', {
      domain: companyDomain,
      titles,
      limit
    });

    return this.http.get<PeopleSearchResponse>(
      '/mixed_people/search',
      params,
      {
        rateLimitKey: this.rateLimitKey,
        cacheTTL: this.cacheTTL
      }
    );
  }

  /**
   * Get intent signals for a company
   *
   * Identifies buying signals and intent data such as:
   * - Hiring velocity (rapid hiring = expansion)
   * - Technology stack changes (migrating from X to Y)
   * - Funding announcements (Series A/B/C rounds)
   * - Leadership changes (new CTO = tech overhaul opportunity)
   *
   * @param companyDomain - Company website domain (e.g., "costco.com")
   * @returns Intent signals and buying indicators
   *
   * @example
   * ```typescript
   * const apollo = new ApolloClient();
   * const signals = await apollo.getIntentSignals('costco.com');
   *
   * // Returns:
   * // {
   * //   data: {
   * //     organization: {
   * //       name: "Costco Wholesale",
   * //       domain: "costco.com",
   * //       employee_count: 304000,
   * //       estimated_revenue: "$254.5B",
   * //       funding_stage: "Public (NASDAQ: COST)",
   * //       technologies: ["Shopify Plus", "Google Analytics", ...],
   * //       intent_signals: [
   * //         {
   * //           type: "hiring_velocity",
   * //           description: "28 engineering roles posted in last 30 days",
   * //           signal_strength: "high",
   * //           detected_at: "2025-12-15T10:00:00Z"
   * //         },
   * //         {
   * //           type: "leadership_change",
   * //           description: "New CTO hired 2 months ago",
   * //           signal_strength: "medium",
   * //           detected_at: "2025-10-20T10:00:00Z"
   * //         }
   * //       ],
   * //       recent_news: [...]
   * //     }
   * //   },
   * //   meta: { source: 'api', cached: false, ... }
   * // }
   * ```
   */
  async getIntentSignals(
    companyDomain: string
  ): Promise<APIResponse<IntentSignalsResponse>> {
    const params: IntentSignalsParams = {
      domain: companyDomain
    };

    logger.debug('Apollo.io: Getting intent signals', {
      domain: companyDomain
    });

    return this.http.get<IntentSignalsResponse>(
      '/organizations/enrich',
      params,
      {
        rateLimitKey: this.rateLimitKey,
        cacheTTL: this.cacheTTL
      }
    );
  }

  /**
   * Get organization details by domain
   *
   * Retrieves comprehensive company information including employee count,
   * revenue estimates, technology stack, and firmographic data.
   *
   * @param companyDomain - Company website domain (e.g., "costco.com")
   * @returns Organization details
   *
   * @example
   * ```typescript
   * const apollo = new ApolloClient();
   * const org = await apollo.getOrganization('costco.com');
   *
   * // Returns:
   * // {
   * //   data: {
   * //     organization: {
   * //       id: "xyz789",
   * //       name: "Costco Wholesale",
   * //       domain: "costco.com",
   * //       industry: "Retail",
   * //       employee_count: 304000,
   * //       estimated_annual_revenue: "$254.5B",
   * //       publicly_traded_symbol: "NASDAQ: COST",
   * //       phone: "+1-425-313-8100",
   * //       linkedin_url: "https://linkedin.com/company/costco-wholesale",
   * //       founded_year: 1983,
   * //       headquarters: {
   * //         city: "Issaquah",
   * //         state: "Washington",
   * //         country: "United States"
   * //       }
   * //     }
   * //   },
   * //   meta: { source: 'cache', cached: true, ... }
   * // }
   * ```
   */
  async getOrganization(
    companyDomain: string
  ): Promise<APIResponse<OrganizationResponse>> {
    const params: OrganizationParams = {
      domain: companyDomain
    };

    logger.debug('Apollo.io: Getting organization details', {
      domain: companyDomain
    });

    return this.http.get<OrganizationResponse>(
      '/organizations/enrich',
      params,
      {
        rateLimitKey: this.rateLimitKey,
        cacheTTL: this.cacheTTL
      }
    );
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * People Search Request Parameters
 */
interface PeopleSearchParams {
  q_organization_domains: string;
  person_titles: string[];
  per_page: number;
  page: number;
}

/**
 * People Search Response
 */
export interface PeopleSearchResponse {
  people: Person[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  breadcrumbs: Array<{
    label: string;
    signal_field_name: string;
    value: string;
    display_name: string;
  }>;
}

/**
 * Person entity (contact)
 */
export interface Person {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string;
  email: string | null;
  email_status: 'verified' | 'guessed' | 'unavailable';
  phone_numbers: Array<{
    raw_number: string;
    sanitized_number: string;
    type: 'work' | 'mobile' | 'home';
    position: number;
    status: 'valid' | 'invalid';
  }>;
  linkedin_url: string | null;
  twitter_url: string | null;
  github_url: string | null;
  facebook_url: string | null;
  organization: {
    id: string;
    name: string;
    website_url: string;
    blog_url: string | null;
    angellist_url: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    facebook_url: string | null;
    primary_phone: {
      number: string;
      source: string;
    } | null;
    languages: string[];
    alexa_ranking: number | null;
    phone: string | null;
    linkedin_uid: string | null;
    founded_year: number | null;
    publicly_traded_symbol: string | null;
    publicly_traded_exchange: string | null;
    logo_url: string | null;
    crunchbase_url: string | null;
    primary_domain: string;
  };
  employment_history: Array<{
    id: string;
    created_at: string;
    current: boolean;
    degree: string | null;
    description: string | null;
    emails: string[] | null;
    end_date: string | null;
    grade_level: string | null;
    kind: string | null;
    major: string | null;
    organization_id: string | null;
    organization_name: string | null;
    raw_address: string | null;
    start_date: string | null;
    title: string | null;
    updated_at: string;
    key: string;
  }>;
  state: string;
  city: string;
  country: string;
  headline: string | null;
  photo_url: string | null;
  present_raw_address: string | null;
  linkedin_uid: string | null;
  extrapolated_email_confidence: number | null;
  salesforce_id: string | null;
  salesforce_lead_id: string | null;
  salesforce_contact_id: string | null;
  salesforce_account_id: string | null;
  crm_owner_id: string | null;
  created_at: string;
  lead_request_id: string | null;
  test_creation_date: string | null;
  contact_campaign_statuses: any[];
  label_names: string[];
  organization_id: string | null;
  headline_from_employment: string | null;
}

/**
 * Intent Signals Request Parameters
 */
interface IntentSignalsParams {
  domain: string;
}

/**
 * Intent Signals Response
 */
export interface IntentSignalsResponse {
  organization: OrganizationWithSignals;
}

/**
 * Organization with Intent Signals
 */
export interface OrganizationWithSignals {
  id: string;
  name: string;
  website_url: string;
  domain: string;
  industry: string;
  keywords: string[];
  estimated_num_employees: number;
  industries: string[];
  publicly_traded_symbol: string | null;
  publicly_traded_exchange: string | null;
  logo_url: string | null;
  crunchbase_url: string | null;
  primary_phone: {
    number: string;
    source: string;
  } | null;
  sanitized_phone: string | null;
  linkedin_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  blog_url: string | null;
  angellist_url: string | null;
  founded_year: number | null;
  raw_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  languages: string[];
  alexa_ranking: number | null;
  persona_counts: Record<string, number>;
  market_cap: string | null;
  fiscal_year_end: string | null;
  total_funding: string | null;
  total_funding_printed: string | null;
  latest_funding_round_date: string | null;
  latest_funding_stage: string | null;
  funding_events: Array<{
    id: string;
    date: string;
    news_url: string | null;
    type: string;
    investors: string | null;
    amount: string | null;
    currency: string | null;
  }>;
  technology_names: string[];
  current_technologies: Array<{
    uid: string;
    name: string;
    category: string;
  }>;
  account_id: string | null;
  account: {
    id: string;
    domain: string;
    name: string;
    team_id: string;
    organization_id: string;
    account_stage_id: string | null;
    source: string;
    original_source: string;
    owner_id: string | null;
    created_at: string;
    phone: string | null;
    phone_status: string | null;
    test_predictive_score: number | null;
    hubspot_id: string | null;
    salesforce_id: string | null;
    crm_owner_id: string | null;
    parent_account_id: string | null;
    sanitized_phone: string | null;
    account_playbook_statuses: any[];
    existence_level: string;
    label_names: string[];
    typed_custom_fields: Record<string, any>;
    modality: string;
    persona_counts: Record<string, number>;
  } | null;
  departments: Array<{
    name: string;
    headcount: number;
    headcount_growth_rate: number;
  }>;
  seo_description: string | null;
  short_description: string | null;
  annual_revenue_printed: string | null;
  annual_revenue: string | null;
  total_funding_usd: number | null;
  phone: string | null;
}

/**
 * Organization Request Parameters
 */
interface OrganizationParams {
  domain: string;
}

/**
 * Organization Response (without signals)
 */
export interface OrganizationResponse {
  organization: {
    id: string;
    name: string;
    website_url: string;
    domain: string;
    industry: string;
    estimated_num_employees: number;
    publicly_traded_symbol: string | null;
    publicly_traded_exchange: string | null;
    logo_url: string | null;
    crunchbase_url: string | null;
    linkedin_url: string | null;
    facebook_url: string | null;
    twitter_url: string | null;
    founded_year: number | null;
    city: string | null;
    state: string | null;
    country: string | null;
    phone: string | null;
    annual_revenue_printed: string | null;
    total_funding_printed: string | null;
    technology_names: string[];
  };
}
