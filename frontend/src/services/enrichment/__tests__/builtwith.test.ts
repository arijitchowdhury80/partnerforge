/**
 * BuiltWith API Client Tests
 *
 * Comprehensive test suite for the BuiltWith client covering
 * all 7 endpoints, tech categorization, and detection helpers.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BuiltWithClient,
  builtWithClient,
  BuiltWithTechStack,
} from '../clients/builtwith';

// ============================================================================
// Mock Data
// ============================================================================

const mockFreeTechResponse = {
  groups: [
    {
      name: 'Web Technologies',
      categories: [
        {
          name: 'JavaScript Libraries',
          live: [
            { name: 'React', tag: 'react', description: 'React library' },
            { name: 'jQuery', tag: 'jquery', description: 'jQuery library' },
          ],
        },
        {
          name: 'Analytics',
          live: [
            { name: 'Google Analytics', tag: 'google-analytics', description: 'Analytics' },
          ],
        },
      ],
    },
    {
      name: 'Content Management',
      categories: [
        {
          name: 'CMS',
          live: [
            { name: 'Adobe Experience Manager', tag: 'aem', description: 'Enterprise CMS' },
          ],
        },
      ],
    },
    {
      name: 'Search',
      categories: [
        {
          name: 'Site Search',
          live: [
            { name: 'Algolia', tag: 'algolia', description: 'Search API' },
          ],
        },
      ],
    },
  ],
};

const mockProTechResponse = {
  Results: [
    {
      Lookup: 'example.com',
      Paths: [
        {
          Technologies: [
            {
              Name: 'React',
              Tag: 'react',
              Categories: ['JavaScript', 'Framework'],
              FirstDetected: Date.now() - 86400000 * 365,
              LastDetected: Date.now(),
              Spend: 5000,
            },
            {
              Name: 'Elasticsearch',
              Tag: 'elasticsearch',
              Categories: ['Search'],
              FirstDetected: Date.now() - 86400000 * 180,
              LastDetected: Date.now(),
              Spend: 25000,
            },
            {
              Name: 'Shopify',
              Tag: 'shopify',
              Categories: ['Ecommerce'],
              FirstDetected: Date.now() - 86400000 * 300,
              LastDetected: Date.now(),
              Spend: 15000,
            },
          ],
        },
      ],
    },
  ],
};

const mockRelationshipsResponse = {
  Results: [
    {
      Domain: 'example.com',
      Identifiers: [
        {
          Type: 'Google Analytics',
          Value: 'UA-12345',
          Matches: [
            { Domain: 'related-site.com', Match: 'exact' },
            { Domain: 'another-site.com', Match: 'partial' },
          ],
        },
        {
          Type: 'Parent Company',
          Value: 'CORP-ID',
          Matches: [
            { Domain: 'parent-corp.com', Match: 'exact' },
          ],
        },
        {
          Type: 'Subsidiary',
          Value: 'SUB-ID',
          Matches: [
            { Domain: 'subsidiary-one.com', Match: 'exact' },
          ],
        },
      ],
    },
  ],
};

const mockRecommendationsResponse = {
  Results: [
    { Domain: 'similar1.com', Score: 95, Technologies: ['React', 'Shopify'] },
    { Domain: 'similar2.com', Score: 85, Technologies: ['React', 'Elasticsearch'] },
    { Domain: 'similar3.com', Score: 75, Technologies: ['React'] },
  ],
};

const mockFinancialsResponse = {
  Results: [
    {
      Domain: 'example.com',
      Spend: 150000,
      SpendByCategory: {
        'Ecommerce': 50000,
        'Analytics': 20000,
        'Search': 30000,
        'Hosting': 50000,
      },
      Vendors: [
        { Name: 'Amazon Web Services', Category: 'Hosting', Spend: 50000 },
        { Name: 'Shopify', Category: 'Ecommerce', Spend: 30000 },
        { Name: 'Google Analytics', Category: 'Analytics', Spend: 20000 },
      ],
    },
  ],
};

const mockSocialResponse = {
  Results: [
    {
      Domain: 'example.com',
      Facebook: 'examplepage',
      Twitter: 'exampleco',
      LinkedIn: 'example-company',
      Profiles: [
        { Platform: 'Instagram', Url: 'https://instagram.com/example' },
        { Platform: 'YouTube', Url: 'https://youtube.com/example' },
      ],
    },
  ],
};

const mockTrustResponse = {
  Results: [
    {
      Domain: 'example.com',
      SSL: {
        Issuer: 'DigiCert Inc',
        ValidTo: '2025-12-31',
        Grade: 'A+',
      },
      Badges: ['Norton Secured', 'McAfee SECURE'],
      Compliance: ['PCI DSS', 'SOC 2 Type II'],
      Headers: ['HSTS', 'X-Frame-Options', 'Content-Security-Policy'],
    },
  ],
};

// ============================================================================
// Test Helpers
// ============================================================================

function createMockFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      }
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('BuiltWithClient', () => {
  let client: BuiltWithClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new BuiltWithClient('test-api-key');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // getTechStackFree
  // ==========================================================================

  describe('getTechStackFree', () => {
    it('should return categorized tech stack', async () => {
      global.fetch = createMockFetch({
        'free1/api.json': mockFreeTechResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTechStackFree('example.com');

      expect(result).not.toBeNull();
      expect(result!.domain).toBe('example.com');
      // 5 technologies: React, jQuery, Google Analytics, Adobe Experience Manager, Algolia
      expect(result!.technologies).toHaveLength(5);
      expect(result!.frameworks).toContain('React');
      expect(result!.analytics).toContain('Google Analytics');
      expect(result!.cms).toContain('Adobe Experience Manager');
      expect(result!.search).toContain('Algolia');
    });

    it('should handle missing API key', async () => {
      const noKeyClient = new BuiltWithClient('');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // No need to call the API - the client should return null immediately
      const result = await noKeyClient.getTechStackFree('example.com');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('[BuiltWith] No API key provided');

      consoleSpy.mockRestore();
    });

    it('should handle 404 for unknown domain', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
      ) as unknown as typeof fetch;

      const result = await client.getTechStackFree('nonexistent-domain.xyz');

      expect(result).toBeNull();
    });

    it('should handle API errors in response', async () => {
      global.fetch = createMockFetch({
        'free1/api.json': {
          Errors: [{ Message: 'Invalid API key' }],
        },
      }) as unknown as typeof fetch;

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await client.getTechStackFree('example.com');

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should clean domain URLs', async () => {
      global.fetch = createMockFetch({
        'free1/api.json': mockFreeTechResponse,
      }) as unknown as typeof fetch;

      await client.getTechStackFree('https://www.example.com/path/to/page');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('LOOKUP=example.com')
      );
    });
  });

  // ==========================================================================
  // getTechStackPro
  // ==========================================================================

  describe('getTechStackPro', () => {
    it('should return detailed tech with dates and spend', async () => {
      global.fetch = createMockFetch({
        'v21/api.json': mockProTechResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTechStackPro('example.com');

      expect(result).not.toBeNull();
      expect(result!.technologies).toHaveLength(3);

      const reactTech = result!.technologies.find(t => t.name === 'React');
      expect(reactTech).toBeDefined();
      expect(reactTech!.first_detected).toBeDefined();
      expect(reactTech!.last_detected).toBeDefined();
      expect(reactTech!.spend_estimate).toBe(5000);
    });

    it('should categorize technologies correctly', async () => {
      global.fetch = createMockFetch({
        'v21/api.json': mockProTechResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTechStackPro('example.com');

      expect(result!.frameworks).toContain('React');
      expect(result!.search).toContain('Elasticsearch');
      expect(result!.ecommerce).toContain('Shopify');
    });

    it('should handle empty results', async () => {
      global.fetch = createMockFetch({
        'v21/api.json': { Results: [] },
      }) as unknown as typeof fetch;

      const result = await client.getTechStackPro('example.com');

      expect(result).not.toBeNull();
      expect(result!.technologies).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getTechStack (smart fallback)
  // ==========================================================================

  describe('getTechStack', () => {
    it('should use pro endpoint first', async () => {
      global.fetch = createMockFetch({
        'v21/api.json': mockProTechResponse,
        'free1/api.json': mockFreeTechResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTechStack('example.com');

      // Pro response has 3 techs, free has 4 - we should get pro result
      expect(result!.technologies).toHaveLength(3);
    });

    it('should fall back to free when pro fails', async () => {
      global.fetch = vi.fn((url: string) => {
        if (url.includes('v21/api.json')) {
          return Promise.resolve({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockFreeTechResponse),
        });
      }) as unknown as typeof fetch;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const result = await client.getTechStack('example.com');

      expect(result).not.toBeNull();
      // Free response has 5 techs: React, jQuery, Google Analytics, Adobe Experience Manager, Algolia
      expect(result!.technologies).toHaveLength(5);
      expect(consoleSpy).toHaveBeenCalledWith('[BuiltWith] Falling back to free tier');
    });
  });

  // ==========================================================================
  // getRelationships
  // ==========================================================================

  describe('getRelationships', () => {
    it('should return related domains', async () => {
      global.fetch = createMockFetch({
        'rv1/api.json': mockRelationshipsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getRelationships('example.com');

      expect(result).not.toBeNull();
      expect(result!.related_domains).toHaveLength(4);
      expect(result!.related_domains[0]).toMatchObject({
        domain: 'related-site.com',
        relationship_type: 'Google Analytics',
        confidence: 1.0,
      });
    });

    it('should identify corporate parent', async () => {
      global.fetch = createMockFetch({
        'rv1/api.json': mockRelationshipsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getRelationships('example.com');

      expect(result!.corporate_parent).toBe('parent-corp.com');
    });

    it('should identify subsidiaries', async () => {
      global.fetch = createMockFetch({
        'rv1/api.json': mockRelationshipsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getRelationships('example.com');

      expect(result!.subsidiaries).toContain('subsidiary-one.com');
    });

    it('should handle partial match confidence', async () => {
      global.fetch = createMockFetch({
        'rv1/api.json': mockRelationshipsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getRelationships('example.com');

      const partialMatch = result!.related_domains.find(d => d.domain === 'another-site.com');
      expect(partialMatch!.confidence).toBe(0.7);
    });
  });

  // ==========================================================================
  // getRecommendations
  // ==========================================================================

  describe('getRecommendations', () => {
    it('should return sites with similar tech', async () => {
      global.fetch = createMockFetch({
        'rec1/api.json': mockRecommendationsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getRecommendations('example.com');

      expect(result).not.toBeNull();
      expect(result!.similar_tech_sites).toHaveLength(3);
      expect(result!.similar_tech_sites[0]).toMatchObject({
        domain: 'similar1.com',
        tech_overlap_score: 95,
        shared_technologies: ['React', 'Shopify'],
      });
    });

    it('should sort by tech overlap score', async () => {
      global.fetch = createMockFetch({
        'rec1/api.json': mockRecommendationsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getRecommendations('example.com');

      // Already sorted in mock, verify order is maintained
      const scores = result!.similar_tech_sites.map(s => s.tech_overlap_score);
      expect(scores).toEqual([95, 85, 75]);
    });
  });

  // ==========================================================================
  // getFinancials
  // ==========================================================================

  describe('getFinancials', () => {
    it('should return tech spend estimates', async () => {
      global.fetch = createMockFetch({
        'fin1/api.json': mockFinancialsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getFinancials('example.com');

      expect(result).not.toBeNull();
      expect(result!.estimated_annual_tech_spend).toBe(150000);
    });

    it('should return spend by category', async () => {
      global.fetch = createMockFetch({
        'fin1/api.json': mockFinancialsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getFinancials('example.com');

      expect(result!.spend_by_category).toEqual({
        'Ecommerce': 50000,
        'Analytics': 20000,
        'Search': 30000,
        'Hosting': 50000,
      });
    });

    it('should return primary vendors', async () => {
      global.fetch = createMockFetch({
        'fin1/api.json': mockFinancialsResponse,
      }) as unknown as typeof fetch;

      const result = await client.getFinancials('example.com');

      expect(result!.primary_vendors).toHaveLength(3);
      expect(result!.primary_vendors[0]).toMatchObject({
        vendor: 'Amazon Web Services',
        category: 'Hosting',
        estimated_spend: 50000,
      });
    });
  });

  // ==========================================================================
  // getSocial
  // ==========================================================================

  describe('getSocial', () => {
    it('should return social profiles', async () => {
      global.fetch = createMockFetch({
        'soc1/api.json': mockSocialResponse,
      }) as unknown as typeof fetch;

      const result = await client.getSocial('example.com');

      expect(result).not.toBeNull();
      expect(result!.social_profiles.length).toBeGreaterThan(0);
    });

    it('should include Facebook handle', async () => {
      global.fetch = createMockFetch({
        'soc1/api.json': mockSocialResponse,
      }) as unknown as typeof fetch;

      const result = await client.getSocial('example.com');

      expect(result!.facebook_app_id).toBe('examplepage');
      expect(result!.social_profiles.some(p => p.platform === 'Facebook')).toBe(true);
    });

    it('should include Twitter handle', async () => {
      global.fetch = createMockFetch({
        'soc1/api.json': mockSocialResponse,
      }) as unknown as typeof fetch;

      const result = await client.getSocial('example.com');

      expect(result!.twitter_handle).toBe('exampleco');
    });

    it('should include LinkedIn company ID', async () => {
      global.fetch = createMockFetch({
        'soc1/api.json': mockSocialResponse,
      }) as unknown as typeof fetch;

      const result = await client.getSocial('example.com');

      expect(result!.linkedin_company_id).toBe('example-company');
    });

    it('should include additional profiles', async () => {
      global.fetch = createMockFetch({
        'soc1/api.json': mockSocialResponse,
      }) as unknown as typeof fetch;

      const result = await client.getSocial('example.com');

      const instagram = result!.social_profiles.find(p => p.platform === 'Instagram');
      expect(instagram).toBeDefined();
      expect(instagram!.url).toBe('https://instagram.com/example');
    });
  });

  // ==========================================================================
  // getTrust
  // ==========================================================================

  describe('getTrust', () => {
    it('should return SSL and compliance data', async () => {
      global.fetch = createMockFetch({
        'trust1/api.json': mockTrustResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTrust('example.com');

      expect(result).not.toBeNull();
      expect(result!.ssl_certificate).toMatchObject({
        issuer: 'DigiCert Inc',
        valid_until: '2025-12-31',
        grade: 'A+',
      });
    });

    it('should return trust badges', async () => {
      global.fetch = createMockFetch({
        'trust1/api.json': mockTrustResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTrust('example.com');

      expect(result!.trust_badges).toContain('Norton Secured');
      expect(result!.trust_badges).toContain('McAfee SECURE');
    });

    it('should return compliance certifications', async () => {
      global.fetch = createMockFetch({
        'trust1/api.json': mockTrustResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTrust('example.com');

      expect(result!.compliance_certifications).toContain('PCI DSS');
      expect(result!.compliance_certifications).toContain('SOC 2 Type II');
    });

    it('should return security headers', async () => {
      global.fetch = createMockFetch({
        'trust1/api.json': mockTrustResponse,
      }) as unknown as typeof fetch;

      const result = await client.getTrust('example.com');

      expect(result!.security_headers).toContain('HSTS');
      expect(result!.security_headers).toContain('X-Frame-Options');
      expect(result!.security_headers).toContain('Content-Security-Policy');
    });

    it('should handle missing SSL', async () => {
      global.fetch = createMockFetch({
        'trust1/api.json': {
          Results: [{ Domain: 'example.com' }],
        },
      }) as unknown as typeof fetch;

      const result = await client.getTrust('example.com');

      expect(result!.ssl_certificate).toBeNull();
    });
  });

  // ==========================================================================
  // detectSearchProvider
  // ==========================================================================

  describe('detectSearchProvider', () => {
    it('should detect Algolia', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Algolia', tag: 'algolia', categories: ['Search'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: ['Algolia'],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.detectSearchProvider(techStack)).toBe('Algolia');
    });

    it('should detect Elasticsearch', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Elasticsearch', tag: 'elasticsearch', categories: ['Search'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: ['Elasticsearch'],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.detectSearchProvider(techStack)).toBe('Elasticsearch');
    });

    it('should detect Coveo', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Coveo Search', tag: 'coveo', categories: ['Search'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: ['Coveo Search'],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.detectSearchProvider(techStack)).toBe('Coveo');
    });

    it('should detect Constructor.io', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Constructor.io', tag: 'constructor', categories: ['Search'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: ['Constructor.io'],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.detectSearchProvider(techStack)).toBe('Constructor.io');
    });

    it('should return null for no search provider', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'React', tag: 'react', categories: ['Framework'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: [],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: ['React'],
        hosting: [],
        security: [],
      };

      expect(client.detectSearchProvider(techStack)).toBeNull();
    });

    it('should detect search provider from technologies array', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [
          { name: 'Klevu Search', tag: 'klevu', categories: ['JavaScript'] },
        ],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: [], // Not categorized yet
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.detectSearchProvider(techStack)).toBe('Klevu');
    });
  });

  // ==========================================================================
  // detectPartnerTech
  // ==========================================================================

  describe('detectPartnerTech', () => {
    it('should detect Adobe AEM', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Adobe Experience Manager', tag: 'aem', categories: ['CMS'] }],
        cms: ['Adobe Experience Manager'],
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

      const partners = client.detectPartnerTech(techStack);
      expect(partners).toContain('Adobe Experience Manager');
    });

    it('should detect Amplience', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Amplience', tag: 'amplience', categories: ['CMS'] }],
        cms: ['Amplience'],
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

      const partners = client.detectPartnerTech(techStack);
      expect(partners).toContain('Amplience');
    });

    it('should detect Spryker', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Spryker Commerce', tag: 'spryker', categories: ['Ecommerce'] }],
        cms: [],
        ecommerce: ['Spryker Commerce'],
        analytics: [],
        search: [],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      const partners = client.detectPartnerTech(techStack);
      expect(partners).toContain('Spryker');
    });

    it('should detect multiple partner technologies', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [
          { name: 'Adobe Experience Manager', tag: 'aem', categories: ['CMS'] },
          { name: 'commercetools', tag: 'commercetools', categories: ['Ecommerce'] },
        ],
        cms: ['Adobe Experience Manager'],
        ecommerce: ['commercetools'],
        analytics: [],
        search: [],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      const partners = client.detectPartnerTech(techStack);
      expect(partners).toContain('Adobe Experience Manager');
      expect(partners).toContain('commercetools');
      expect(partners).toHaveLength(2);
    });

    it('should not duplicate partner detections', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [
          { name: 'Amplience', tag: 'amplience', categories: ['CMS'] },
        ],
        cms: ['Amplience'],
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

      const partners = client.detectPartnerTech(techStack);
      expect(partners.filter(p => p === 'Amplience')).toHaveLength(1);
    });

    it('should return empty array for no partner tech', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'React', tag: 'react', categories: ['Framework'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: [],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: ['React'],
        hosting: [],
        security: [],
      };

      const partners = client.detectPartnerTech(techStack);
      expect(partners).toHaveLength(0);
    });
  });

  // ==========================================================================
  // usesAlgolia
  // ==========================================================================

  describe('usesAlgolia', () => {
    it('should return true when Algolia is detected', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Algolia', tag: 'algolia', categories: ['Search'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: ['Algolia'],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.usesAlgolia(techStack)).toBe(true);
    });

    it('should return false when another search provider is used', () => {
      const techStack: BuiltWithTechStack = {
        domain: 'example.com',
        technologies: [{ name: 'Elasticsearch', tag: 'elasticsearch', categories: ['Search'] }],
        cms: [],
        ecommerce: [],
        analytics: [],
        search: ['Elasticsearch'],
        cdn: [],
        payment: [],
        marketing: [],
        frameworks: [],
        hosting: [],
        security: [],
      };

      expect(client.usesAlgolia(techStack)).toBe(false);
    });
  });

  // ==========================================================================
  // getFullData
  // ==========================================================================

  describe('getFullData', () => {
    it('should aggregate all endpoints', async () => {
      global.fetch = createMockFetch({
        'v21/api.json': mockProTechResponse,
        'rv1/api.json': mockRelationshipsResponse,
        'rec1/api.json': mockRecommendationsResponse,
        'fin1/api.json': mockFinancialsResponse,
        'soc1/api.json': mockSocialResponse,
        'trust1/api.json': mockTrustResponse,
      }) as unknown as typeof fetch;

      const result = await client.getFullData('example.com');

      expect(result).not.toBeNull();
      expect(result!.tech_stack).toBeDefined();
      expect(result!.relationships).toBeDefined();
      expect(result!.recommendations).toBeDefined();
      expect(result!.financials).toBeDefined();
      expect(result!.social).toBeDefined();
      expect(result!.trust).toBeDefined();
      expect(result!.fetched_at).toBeDefined();
    });

    it('should handle partial API failures gracefully', async () => {
      global.fetch = vi.fn((url: string) => {
        // Only tech stack succeeds
        if (url.includes('v21/api.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockProTechResponse),
          });
        }
        // All others fail
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });
      }) as unknown as typeof fetch;

      const result = await client.getFullData('example.com');

      expect(result).not.toBeNull();
      expect(result!.tech_stack).toBeDefined();
      expect(result!.relationships).toBeNull();
      expect(result!.recommendations).toBeNull();
      expect(result!.financials).toBeNull();
      expect(result!.social).toBeNull();
      expect(result!.trust).toBeNull();
    });

    it('should return null if tech stack fails', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
      ) as unknown as typeof fetch;

      const result = await client.getFullData('example.com');

      expect(result).toBeNull();
    });

    it('should include fetched_at timestamp', async () => {
      global.fetch = createMockFetch({
        'v21/api.json': mockProTechResponse,
        'rv1/api.json': mockRelationshipsResponse,
        'rec1/api.json': mockRecommendationsResponse,
        'fin1/api.json': mockFinancialsResponse,
        'soc1/api.json': mockSocialResponse,
        'trust1/api.json': mockTrustResponse,
      }) as unknown as typeof fetch;

      const before = new Date().toISOString();
      const result = await client.getFullData('example.com');
      const after = new Date().toISOString();

      expect(result!.fetched_at).toBeDefined();
      expect(result!.fetched_at >= before).toBe(true);
      expect(result!.fetched_at <= after).toBe(true);
    });
  });

  // ==========================================================================
  // Singleton Export
  // ==========================================================================

  describe('singleton export', () => {
    it('should export a singleton instance', () => {
      expect(builtWithClient).toBeInstanceOf(BuiltWithClient);
    });
  });

  // ==========================================================================
  // Integration Tests (skipped by default)
  // ==========================================================================

  describe.skip('Integration', () => {
    it('should fetch real data for costco.com', async () => {
      // Use actual API key from environment
      const realClient = new BuiltWithClient();
      const result = await realClient.getTechStack('costco.com');

      expect(result).not.toBeNull();
      console.log('Costco tech stack:', JSON.stringify(result, null, 2));
    });

    it('should fetch full data for a real domain', async () => {
      const realClient = new BuiltWithClient();
      const result = await realClient.getFullData('shopify.com');

      expect(result).not.toBeNull();
      console.log('Shopify full data:', JSON.stringify(result, null, 2));
    });
  });
});
