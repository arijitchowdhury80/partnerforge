/**
 * BuiltWith API Client
 *
 * Implements all 7 BuiltWith API endpoints with smart fallbacks
 * and technology categorization for partner intelligence.
 *
 * @see https://api.builtwith.com/
 */

// ============================================================================
// Types
// ============================================================================

export interface BuiltWithTechnology {
  name: string;
  tag: string;
  categories: string[];
  first_detected?: string;
  last_detected?: string;
  spend_estimate?: number;
}

export interface BuiltWithTechStack {
  domain: string;
  technologies: BuiltWithTechnology[];
  // Categorized for easy access
  cms: string[];
  ecommerce: string[];
  analytics: string[];
  search: string[];
  cdn: string[];
  payment: string[];
  marketing: string[];
  frameworks: string[];
  hosting: string[];
  security: string[];
}

export interface BuiltWithRelationships {
  domain: string;
  related_domains: Array<{
    domain: string;
    relationship_type: string;
    confidence: number;
  }>;
  corporate_parent?: string;
  subsidiaries: string[];
}

export interface BuiltWithRecommendations {
  similar_tech_sites: Array<{
    domain: string;
    tech_overlap_score: number;
    shared_technologies: string[];
  }>;
}

export interface BuiltWithFinancials {
  domain: string;
  estimated_annual_tech_spend: number;
  spend_by_category: Record<string, number>;
  primary_vendors: Array<{
    vendor: string;
    category: string;
    estimated_spend: number;
  }>;
}

export interface BuiltWithSocial {
  domain: string;
  facebook_app_id?: string;
  twitter_handle?: string;
  linkedin_company_id?: string;
  social_profiles: Array<{
    platform: string;
    url: string;
  }>;
}

export interface BuiltWithTrust {
  domain: string;
  ssl_certificate: {
    issuer: string;
    valid_until: string;
    grade: string;
  } | null;
  trust_badges: string[];
  compliance_certifications: string[];
  security_headers: string[];
}

export interface BuiltWithFullData {
  tech_stack: BuiltWithTechStack;
  relationships: BuiltWithRelationships | null;
  recommendations: BuiltWithRecommendations | null;
  financials: BuiltWithFinancials | null;
  social: BuiltWithSocial | null;
  trust: BuiltWithTrust | null;
  fetched_at: string;
}

// ============================================================================
// Raw API Response Types (internal)
// ============================================================================

interface RawTechnology {
  Name?: string;
  Tag?: string;
  Categories?: string[];
  FirstDetected?: number;
  LastDetected?: number;
  FirstIndexed?: number;
  LastIndexed?: number;
  IsPremium?: string;
  Spend?: number;
}

interface RawPath {
  Technologies?: RawTechnology[];
  FirstIndexed?: number;
  LastIndexed?: number;
  Domain?: string;
  Url?: string;
  SubDomain?: string;
}

interface RawResult {
  Paths?: RawPath[];
  Lookup?: string;
  IsDB?: boolean;
  Attributes?: Record<string, unknown>;
  Redirect?: string;
}

interface RawFreeTechResponse {
  groups?: Array<{
    name: string;
    categories?: Array<{
      name: string;
      live?: Array<{
        name: string;
        link?: string;
        tag?: string;
        description?: string;
      }>;
    }>;
  }>;
  Errors?: Array<{ Message?: string }>;
}

interface RawProTechResponse {
  Results?: RawResult[];
  Errors?: Array<{ Message?: string }>;
}

interface RawRelationshipsResponse {
  Results?: Array<{
    Domain?: string;
    Identifiers?: Array<{
      Type?: string;
      Value?: string;
      Matches?: Array<{
        Domain?: string;
        Match?: string;
      }>;
    }>;
  }>;
  Errors?: Array<{ Message?: string }>;
}

interface RawRecommendationsResponse {
  Results?: Array<{
    Domain?: string;
    Score?: number;
    Technologies?: string[];
  }>;
  Errors?: Array<{ Message?: string }>;
}

interface RawFinancialsResponse {
  Results?: Array<{
    Domain?: string;
    Spend?: number;
    SpendByCategory?: Record<string, number>;
    Vendors?: Array<{
      Name?: string;
      Category?: string;
      Spend?: number;
    }>;
  }>;
  Errors?: Array<{ Message?: string }>;
}

interface RawSocialResponse {
  Results?: Array<{
    Domain?: string;
    Facebook?: string;
    Twitter?: string;
    LinkedIn?: string;
    Profiles?: Array<{
      Platform?: string;
      Url?: string;
    }>;
  }>;
  Errors?: Array<{ Message?: string }>;
}

interface RawTrustResponse {
  Results?: Array<{
    Domain?: string;
    SSL?: {
      Issuer?: string;
      ValidTo?: string;
      Grade?: string;
    };
    Badges?: string[];
    Compliance?: string[];
    Headers?: string[];
  }>;
  Errors?: Array<{ Message?: string }>;
}

// ============================================================================
// Technology Category Patterns
// ============================================================================

const TECH_CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  cms: [
    /wordpress/i, /drupal/i, /joomla/i, /contentful/i, /sanity/i,
    /prismic/i, /strapi/i, /adobe experience manager/i, /aem/i,
    /sitecore/i, /kentico/i, /umbraco/i, /ghost/i, /squarespace/i,
    /wix/i, /webflow/i, /amplience/i, /contentstack/i, /bloomreach/i,
  ],
  ecommerce: [
    /shopify/i, /magento/i, /woocommerce/i, /bigcommerce/i,
    /salesforce commerce/i, /commercetools/i, /spryker/i,
    /prestashop/i, /opencart/i, /vtex/i, /sap commerce/i,
    /oracle commerce/i, /elastic path/i, /kibo/i, /shopware/i,
  ],
  analytics: [
    /google analytics/i, /adobe analytics/i, /mixpanel/i,
    /amplitude/i, /heap/i, /segment/i, /hotjar/i, /fullstory/i,
    /crazy egg/i, /lucky orange/i, /mouseflow/i, /pendo/i,
    /google tag manager/i, /tealium/i, /matomo/i,
  ],
  search: [
    /algolia/i, /elasticsearch/i, /solr/i, /coveo/i,
    /constructor\.io/i, /searchspring/i, /klevu/i,
    /bloomreach search/i, /lucidworks/i, /swiftype/i,
    /doofinder/i, /hawksearch/i, /yext/i, /siteimprove/i,
    /fast search/i, /attraqt/i, /findify/i, /unbxd/i,
    /loop54/i, /prefixbox/i, /sooqr/i,
  ],
  cdn: [
    /cloudflare/i, /akamai/i, /fastly/i, /cloudfront/i,
    /azure cdn/i, /stackpath/i, /keycdn/i, /bunny/i,
    /limelight/i, /imperva/i, /sucuri/i, /incapsula/i,
  ],
  payment: [
    /stripe/i, /paypal/i, /adyen/i, /braintree/i, /square/i,
    /klarna/i, /affirm/i, /afterpay/i, /clearpay/i,
    /worldpay/i, /authorize\.net/i, /cybersource/i,
    /sagepay/i, /checkout\.com/i, /mollie/i,
  ],
  marketing: [
    /hubspot/i, /marketo/i, /salesforce marketing/i, /pardot/i,
    /mailchimp/i, /klaviyo/i, /mailgun/i, /sendgrid/i,
    /constant contact/i, /campaign monitor/i, /drip/i,
    /omnisend/i, /dotdigital/i, /emarsys/i, /braze/i,
    /iterable/i, /customer\.io/i, /intercom/i, /drift/i,
  ],
  frameworks: [
    /react/i, /vue/i, /angular/i, /next\.js/i, /nuxt/i,
    /gatsby/i, /svelte/i, /ember/i, /backbone/i,
    /jquery/i, /bootstrap/i, /tailwind/i, /material ui/i,
    /express/i, /node\.js/i, /django/i, /rails/i, /laravel/i,
  ],
  hosting: [
    /amazon web services/i, /aws/i, /azure/i, /google cloud/i,
    /gcp/i, /vercel/i, /netlify/i, /heroku/i, /digitalocean/i,
    /linode/i, /vultr/i, /rackspace/i, /godaddy/i,
    /bluehost/i, /siteground/i, /wpengine/i, /pantheon/i,
  ],
  security: [
    /hsts/i, /content.security.policy/i, /csp/i,
    /x-frame-options/i, /x-content-type/i, /sri/i,
    /subresource integrity/i, /lets encrypt/i, /digicert/i,
    /comodo/i, /globalsign/i, /sectigo/i, /verisign/i,
    /norton/i, /mcafee/i, /trustwave/i, /pci/i, /gdpr/i,
    /soc.?2/i, /iso.?27001/i, /hipaa/i,
  ],
};

// ============================================================================
// Search Provider Detection
// ============================================================================

const SEARCH_PROVIDERS = [
  { pattern: /algolia/i, name: 'Algolia' },
  { pattern: /elasticsearch/i, name: 'Elasticsearch' },
  { pattern: /solr/i, name: 'Apache Solr' },
  { pattern: /coveo/i, name: 'Coveo' },
  { pattern: /constructor\.io/i, name: 'Constructor.io' },
  { pattern: /searchspring/i, name: 'SearchSpring' },
  { pattern: /klevu/i, name: 'Klevu' },
  { pattern: /bloomreach/i, name: 'Bloomreach' },
  { pattern: /lucidworks/i, name: 'Lucidworks' },
  { pattern: /swiftype/i, name: 'Swiftype' },
  { pattern: /doofinder/i, name: 'Doofinder' },
  { pattern: /hawksearch/i, name: 'HawkSearch' },
  { pattern: /yext/i, name: 'Yext' },
  { pattern: /attraqt/i, name: 'Attraqt' },
  { pattern: /findify/i, name: 'Findify' },
  { pattern: /unbxd/i, name: 'Unbxd' },
  { pattern: /loop54/i, name: 'Loop54' },
  { pattern: /prefixbox/i, name: 'Prefixbox' },
  { pattern: /sooqr/i, name: 'Sooqr' },
];

// ============================================================================
// Partner Tech Detection
// ============================================================================

const PARTNER_TECH = [
  { pattern: /adobe experience manager|aem/i, name: 'Adobe Experience Manager' },
  { pattern: /amplience/i, name: 'Amplience' },
  { pattern: /spryker/i, name: 'Spryker' },
  { pattern: /commercetools/i, name: 'commercetools' },
  { pattern: /contentful/i, name: 'Contentful' },
  { pattern: /salesforce commerce/i, name: 'Salesforce Commerce Cloud' },
  { pattern: /sap commerce|hybris/i, name: 'SAP Commerce Cloud' },
  { pattern: /magento/i, name: 'Adobe Commerce (Magento)' },
  { pattern: /shopify plus/i, name: 'Shopify Plus' },
  { pattern: /bigcommerce/i, name: 'BigCommerce' },
  { pattern: /vtex/i, name: 'VTEX' },
  { pattern: /elastic path/i, name: 'Elastic Path' },
  { pattern: /oracle commerce/i, name: 'Oracle Commerce Cloud' },
];

// ============================================================================
// BuiltWith Client
// ============================================================================

export class BuiltWithClient {
  private apiKey: string;
  private baseUrls = {
    free: 'https://api.builtwith.com/free1/api.json',
    pro: 'https://api.builtwith.com/v21/api.json',
    relationships: 'https://api.builtwith.com/rv1/api.json',
    recommendations: 'https://api.builtwith.com/rec1/api.json',
    financial: 'https://api.builtwith.com/fin1/api.json',
    social: 'https://api.builtwith.com/soc1/api.json',
    trust: 'https://api.builtwith.com/trust1/api.json',
  };

  constructor(apiKey?: string) {
    // Handle both Vite runtime and Node.js test environments
    // Use nullish coalescing to allow explicit empty string
    if (apiKey !== undefined) {
      this.apiKey = apiKey;
    } else {
      this.apiKey = typeof import.meta?.env?.VITE_BUILTWITH_API_KEY === 'string'
        ? import.meta.env.VITE_BUILTWITH_API_KEY
        : '';
    }
  }

  // ==========================================================================
  // Core Endpoints
  // ==========================================================================

  /**
   * Get tech stack using free tier endpoint
   */
  async getTechStackFree(domain: string): Promise<BuiltWithTechStack | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.free}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawFreeTechResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Free] API error:', response?.Errors);
        return null;
      }

      return this.categorizeTechnologiesFree(cleanDomain, response);
    } catch (error) {
      console.error('[BuiltWith Free] Fetch error:', error);
      return null;
    }
  }

  /**
   * Get tech stack using pro tier endpoint (more details)
   */
  async getTechStackPro(domain: string): Promise<BuiltWithTechStack | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.pro}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawProTechResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Pro] API error:', response?.Errors);
        return null;
      }

      return this.categorizeTechnologiesPro(cleanDomain, response);
    } catch (error) {
      console.error('[BuiltWith Pro] Fetch error:', error);
      return null;
    }
  }

  /**
   * Smart tech stack - tries pro, falls back to free
   */
  async getTechStack(domain: string): Promise<BuiltWithTechStack | null> {
    // Try pro first for more detailed data
    const proResult = await this.getTechStackPro(domain);
    if (proResult && proResult.technologies.length > 0) {
      return proResult;
    }

    // Fall back to free tier
    console.log('[BuiltWith] Falling back to free tier');
    return this.getTechStackFree(domain);
  }

  /**
   * Get corporate relationships and related domains
   */
  async getRelationships(domain: string): Promise<BuiltWithRelationships | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.relationships}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawRelationshipsResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Relationships] API error:', response?.Errors);
        return null;
      }

      return this.parseRelationships(cleanDomain, response);
    } catch (error) {
      console.error('[BuiltWith Relationships] Fetch error:', error);
      return null;
    }
  }

  /**
   * Get recommended similar sites based on tech stack
   */
  async getRecommendations(domain: string): Promise<BuiltWithRecommendations | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.recommendations}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawRecommendationsResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Recommendations] API error:', response?.Errors);
        return null;
      }

      return this.parseRecommendations(response);
    } catch (error) {
      console.error('[BuiltWith Recommendations] Fetch error:', error);
      return null;
    }
  }

  /**
   * Get technology spend estimates
   */
  async getFinancials(domain: string): Promise<BuiltWithFinancials | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.financial}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawFinancialsResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Financials] API error:', response?.Errors);
        return null;
      }

      return this.parseFinancials(cleanDomain, response);
    } catch (error) {
      console.error('[BuiltWith Financials] Fetch error:', error);
      return null;
    }
  }

  /**
   * Get social media profiles
   */
  async getSocial(domain: string): Promise<BuiltWithSocial | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.social}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawSocialResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Social] API error:', response?.Errors);
        return null;
      }

      return this.parseSocial(cleanDomain, response);
    } catch (error) {
      console.error('[BuiltWith Social] Fetch error:', error);
      return null;
    }
  }

  /**
   * Get trust badges and security info
   */
  async getTrust(domain: string): Promise<BuiltWithTrust | null> {
    if (!this.apiKey) {
      console.warn('[BuiltWith] No API key provided');
      return null;
    }

    const cleanDomain = this.cleanDomain(domain);
    const url = `${this.baseUrls.trust}?KEY=${this.apiKey}&LOOKUP=${cleanDomain}`;

    try {
      const response = await this.fetchEndpoint<RawTrustResponse>(url);
      if (!response || response.Errors?.length) {
        console.warn('[BuiltWith Trust] API error:', response?.Errors);
        return null;
      }

      return this.parseTrust(cleanDomain, response);
    } catch (error) {
      console.error('[BuiltWith Trust] Fetch error:', error);
      return null;
    }
  }

  // ==========================================================================
  // Aggregated Endpoint
  // ==========================================================================

  /**
   * Get all available data from all endpoints
   */
  async getFullData(domain: string): Promise<BuiltWithFullData | null> {
    const techStack = await this.getTechStack(domain);
    if (!techStack) {
      console.warn('[BuiltWith] Could not get tech stack, aborting full data fetch');
      return null;
    }

    // Fetch other endpoints in parallel
    const [relationships, recommendations, financials, social, trust] = await Promise.all([
      this.getRelationships(domain).catch(() => null),
      this.getRecommendations(domain).catch(() => null),
      this.getFinancials(domain).catch(() => null),
      this.getSocial(domain).catch(() => null),
      this.getTrust(domain).catch(() => null),
    ]);

    return {
      tech_stack: techStack,
      relationships,
      recommendations,
      financials,
      social,
      trust,
      fetched_at: new Date().toISOString(),
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Detect the search provider from a tech stack
   */
  detectSearchProvider(techStack: BuiltWithTechStack): string | null {
    // Check categorized search first
    for (const tech of techStack.search) {
      for (const provider of SEARCH_PROVIDERS) {
        if (provider.pattern.test(tech)) {
          return provider.name;
        }
      }
    }

    // Check all technologies
    for (const tech of techStack.technologies) {
      const techName = tech.name || tech.tag || '';
      for (const provider of SEARCH_PROVIDERS) {
        if (provider.pattern.test(techName)) {
          return provider.name;
        }
      }
    }

    return null;
  }

  /**
   * Detect partner technologies from a tech stack
   */
  detectPartnerTech(techStack: BuiltWithTechStack): string[] {
    const detected: string[] = [];

    // Check all technologies
    for (const tech of techStack.technologies) {
      const techName = tech.name || tech.tag || '';
      for (const partner of PARTNER_TECH) {
        if (partner.pattern.test(techName) && !detected.includes(partner.name)) {
          detected.push(partner.name);
        }
      }
    }

    // Also check categorized CMS and ecommerce
    const categoriesToCheck = [...techStack.cms, ...techStack.ecommerce];
    for (const techName of categoriesToCheck) {
      for (const partner of PARTNER_TECH) {
        if (partner.pattern.test(techName) && !detected.includes(partner.name)) {
          detected.push(partner.name);
        }
      }
    }

    return detected;
  }

  /**
   * Check if a domain uses Algolia
   */
  usesAlgolia(techStack: BuiltWithTechStack): boolean {
    return this.detectSearchProvider(techStack) === 'Algolia';
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private cleanDomain(domain: string): string {
    return domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
  }

  private async fetchEndpoint<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[BuiltWith] HTTP ${response.status}: ${response.statusText}`);
        return null;
      }
      return await response.json() as T;
    } catch (error) {
      console.error('[BuiltWith] Network error:', error);
      return null;
    }
  }

  private categorizeTechnology(name: string, tag: string, categories: string[]): string[] {
    const matchedCategories: string[] = [];
    const searchText = `${name} ${tag} ${categories.join(' ')}`.toLowerCase();

    for (const [category, patterns] of Object.entries(TECH_CATEGORY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(searchText)) {
          matchedCategories.push(category);
          break;
        }
      }
    }

    return matchedCategories;
  }

  private categorizeTechnologiesFree(
    domain: string,
    response: RawFreeTechResponse
  ): BuiltWithTechStack {
    const technologies: BuiltWithTechnology[] = [];
    const categorized: Record<string, string[]> = {
      cms: [],
      ecommerce: [],
      analytics: [],
      search: [],
      cdn: [],
      payment: [],
      marketing: [],
      frameworks: [],
      hosting: [],
      security: [],
    };

    if (response.groups) {
      for (const group of response.groups) {
        const groupName = group.name || '';
        if (group.categories) {
          for (const category of group.categories) {
            const categoryName = category.name || '';
            if (category.live) {
              for (const tech of category.live) {
                const techObj: BuiltWithTechnology = {
                  name: tech.name || '',
                  tag: tech.tag || '',
                  categories: [groupName, categoryName].filter(Boolean),
                };

                technologies.push(techObj);

                // Categorize
                const matchedCategories = this.categorizeTechnology(
                  techObj.name,
                  techObj.tag,
                  techObj.categories
                );

                for (const cat of matchedCategories) {
                  if (categorized[cat] && !categorized[cat].includes(techObj.name)) {
                    categorized[cat].push(techObj.name);
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      domain,
      technologies,
      ...categorized,
    } as BuiltWithTechStack;
  }

  private categorizeTechnologiesPro(
    domain: string,
    response: RawProTechResponse
  ): BuiltWithTechStack {
    const technologies: BuiltWithTechnology[] = [];
    const categorized: Record<string, string[]> = {
      cms: [],
      ecommerce: [],
      analytics: [],
      search: [],
      cdn: [],
      payment: [],
      marketing: [],
      frameworks: [],
      hosting: [],
      security: [],
    };

    if (response.Results) {
      for (const result of response.Results) {
        if (result.Paths) {
          for (const path of result.Paths) {
            if (path.Technologies) {
              for (const tech of path.Technologies) {
                const techObj: BuiltWithTechnology = {
                  name: tech.Name || '',
                  tag: tech.Tag || '',
                  categories: tech.Categories || [],
                  first_detected: tech.FirstDetected
                    ? new Date(tech.FirstDetected).toISOString()
                    : undefined,
                  last_detected: tech.LastDetected
                    ? new Date(tech.LastDetected).toISOString()
                    : undefined,
                  spend_estimate: tech.Spend,
                };

                // Avoid duplicates
                if (!technologies.some(t => t.name === techObj.name && t.tag === techObj.tag)) {
                  technologies.push(techObj);

                  // Categorize
                  const matchedCategories = this.categorizeTechnology(
                    techObj.name,
                    techObj.tag,
                    techObj.categories
                  );

                  for (const cat of matchedCategories) {
                    if (categorized[cat] && !categorized[cat].includes(techObj.name)) {
                      categorized[cat].push(techObj.name);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      domain,
      technologies,
      ...categorized,
    } as BuiltWithTechStack;
  }

  private parseRelationships(
    domain: string,
    response: RawRelationshipsResponse
  ): BuiltWithRelationships {
    const related_domains: Array<{
      domain: string;
      relationship_type: string;
      confidence: number;
    }> = [];
    let corporate_parent: string | undefined;
    const subsidiaries: string[] = [];

    if (response.Results) {
      for (const result of response.Results) {
        if (result.Identifiers) {
          for (const identifier of result.Identifiers) {
            const type = identifier.Type || 'unknown';
            if (identifier.Matches) {
              for (const match of identifier.Matches) {
                const relatedDomain = match.Domain || '';
                if (relatedDomain && relatedDomain !== domain) {
                  related_domains.push({
                    domain: relatedDomain,
                    relationship_type: type,
                    confidence: match.Match === 'exact' ? 1.0 : 0.7,
                  });

                  // Heuristic: parent company detection
                  if (type.toLowerCase().includes('parent') || type.toLowerCase().includes('corporate')) {
                    corporate_parent = relatedDomain;
                  }
                  if (type.toLowerCase().includes('subsidiary') || type.toLowerCase().includes('child')) {
                    subsidiaries.push(relatedDomain);
                  }
                }
              }
            }
          }
        }
      }
    }

    return {
      domain,
      related_domains,
      corporate_parent,
      subsidiaries,
    };
  }

  private parseRecommendations(
    response: RawRecommendationsResponse
  ): BuiltWithRecommendations {
    const similar_tech_sites: Array<{
      domain: string;
      tech_overlap_score: number;
      shared_technologies: string[];
    }> = [];

    if (response.Results) {
      for (const result of response.Results) {
        similar_tech_sites.push({
          domain: result.Domain || '',
          tech_overlap_score: result.Score || 0,
          shared_technologies: result.Technologies || [],
        });
      }
    }

    return { similar_tech_sites };
  }

  private parseFinancials(
    domain: string,
    response: RawFinancialsResponse
  ): BuiltWithFinancials {
    const result = response.Results?.[0];

    const primary_vendors: Array<{
      vendor: string;
      category: string;
      estimated_spend: number;
    }> = [];

    if (result?.Vendors) {
      for (const vendor of result.Vendors) {
        primary_vendors.push({
          vendor: vendor.Name || '',
          category: vendor.Category || '',
          estimated_spend: vendor.Spend || 0,
        });
      }
    }

    return {
      domain,
      estimated_annual_tech_spend: result?.Spend || 0,
      spend_by_category: result?.SpendByCategory || {},
      primary_vendors,
    };
  }

  private parseSocial(
    domain: string,
    response: RawSocialResponse
  ): BuiltWithSocial {
    const result = response.Results?.[0];

    const social_profiles: Array<{
      platform: string;
      url: string;
    }> = [];

    if (result?.Profiles) {
      for (const profile of result.Profiles) {
        social_profiles.push({
          platform: profile.Platform || '',
          url: profile.Url || '',
        });
      }
    }

    // Add main profiles if not in list
    if (result?.Facebook && !social_profiles.some(p => p.platform === 'Facebook')) {
      social_profiles.push({ platform: 'Facebook', url: `https://facebook.com/${result.Facebook}` });
    }
    if (result?.Twitter && !social_profiles.some(p => p.platform === 'Twitter')) {
      social_profiles.push({ platform: 'Twitter', url: `https://twitter.com/${result.Twitter}` });
    }
    if (result?.LinkedIn && !social_profiles.some(p => p.platform === 'LinkedIn')) {
      social_profiles.push({ platform: 'LinkedIn', url: `https://linkedin.com/company/${result.LinkedIn}` });
    }

    return {
      domain,
      facebook_app_id: result?.Facebook,
      twitter_handle: result?.Twitter,
      linkedin_company_id: result?.LinkedIn,
      social_profiles,
    };
  }

  private parseTrust(
    domain: string,
    response: RawTrustResponse
  ): BuiltWithTrust {
    const result = response.Results?.[0];

    return {
      domain,
      ssl_certificate: result?.SSL
        ? {
            issuer: result.SSL.Issuer || '',
            valid_until: result.SSL.ValidTo || '',
            grade: result.SSL.Grade || '',
          }
        : null,
      trust_badges: result?.Badges || [],
      compliance_certifications: result?.Compliance || [],
      security_headers: result?.Headers || [],
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const builtWithClient = new BuiltWithClient();
