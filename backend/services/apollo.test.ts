import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApolloClient } from './apollo';
import { HttpClient } from './http-client';

// Mock the HttpClient
vi.mock('./http-client');
vi.mock('../config', () => ({
  config: {
    apiKeys: {
      apollo: 'test-api-key'
    },
    rateLimit: {
      apollo: 5
    }
  }
}));

describe('ApolloClient', () => {
  let apolloClient: ApolloClient;
  let mockHttpGet: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock for http.get
    mockHttpGet = vi.fn();
    HttpClient.prototype.get = mockHttpGet;

    apolloClient = new ApolloClient();
  });

  describe('searchPeople', () => {
    it('should search for people with correct parameters', async () => {
      const mockResponse = {
        data: {
          people: [
            {
              id: 'person123',
              first_name: 'Richard',
              last_name: 'Galanti',
              name: 'Richard Galanti',
              title: 'CFO',
              email: 'richard.galanti@costco.com',
              email_status: 'verified',
              phone_numbers: [
                {
                  raw_number: '+1-425-313-8100',
                  sanitized_number: '+14253138100',
                  type: 'work',
                  position: 1,
                  status: 'valid'
                }
              ],
              linkedin_url: 'https://linkedin.com/in/richardgalanti',
              organization: {
                id: 'org123',
                name: 'Costco Wholesale',
                website_url: 'https://costco.com',
                primary_domain: 'costco.com'
              },
              employment_history: [],
              state: 'WA',
              city: 'Issaquah',
              country: 'United States',
              headline: null,
              photo_url: null,
              present_raw_address: null,
              linkedin_uid: null,
              extrapolated_email_confidence: null,
              salesforce_id: null,
              salesforce_lead_id: null,
              salesforce_contact_id: null,
              salesforce_account_id: null,
              crm_owner_id: null,
              created_at: '2025-01-01T00:00:00Z',
              lead_request_id: null,
              test_creation_date: null,
              contact_campaign_statuses: [],
              label_names: [],
              organization_id: 'org123',
              headline_from_employment: null,
              twitter_url: null,
              github_url: null,
              facebook_url: null
            }
          ],
          pagination: {
            page: 1,
            per_page: 25,
            total_entries: 1,
            total_pages: 1
          },
          breadcrumbs: []
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-01-01T00:00:00Z',
          latency_ms: 150
        }
      };

      mockHttpGet.mockResolvedValue(mockResponse);

      const result = await apolloClient.searchPeople(
        'costco.com',
        ['CFO', 'CTO', 'CIO'],
        25
      );

      expect(mockHttpGet).toHaveBeenCalledWith(
        '/mixed_people/search',
        {
          q_organization_domains: 'costco.com',
          person_titles: ['CFO', 'CTO', 'CIO'],
          per_page: 25,
          page: 1
        },
        {
          rateLimitKey: 'apollo',
          cacheTTL: 604800
        }
      );

      expect(result.data.people).toHaveLength(1);
      expect(result.data.people[0].title).toBe('CFO');
      expect(result.data.people[0].email).toBe('richard.galanti@costco.com');
    });

    it('should use default limit of 25', async () => {
      mockHttpGet.mockResolvedValue({
        data: { people: [], pagination: {}, breadcrumbs: [] },
        meta: {}
      });

      await apolloClient.searchPeople('example.com', ['CEO']);

      expect(mockHttpGet).toHaveBeenCalledWith(
        '/mixed_people/search',
        expect.objectContaining({
          per_page: 25
        }),
        expect.any(Object)
      );
    });
  });

  describe('getIntentSignals', () => {
    it('should get intent signals with correct parameters', async () => {
      const mockResponse = {
        data: {
          organization: {
            id: 'org123',
            name: 'Costco Wholesale',
            website_url: 'https://costco.com',
            domain: 'costco.com',
            industry: 'Retail',
            keywords: ['retail', 'wholesale'],
            estimated_num_employees: 304000,
            industries: ['Retail', 'Warehouse'],
            publicly_traded_symbol: 'COST',
            publicly_traded_exchange: 'NASDAQ',
            logo_url: 'https://example.com/logo.png',
            crunchbase_url: null,
            primary_phone: {
              number: '+1-425-313-8100',
              source: 'manual'
            },
            sanitized_phone: '+14253138100',
            linkedin_url: 'https://linkedin.com/company/costco-wholesale',
            facebook_url: null,
            twitter_url: null,
            blog_url: null,
            angellist_url: null,
            founded_year: 1983,
            raw_address: '999 Lake Drive, Issaquah, WA 98027',
            city: 'Issaquah',
            state: 'Washington',
            postal_code: '98027',
            country: 'United States',
            languages: ['en'],
            alexa_ranking: 1000,
            persona_counts: {},
            market_cap: '$100B',
            fiscal_year_end: '08-31',
            total_funding: null,
            total_funding_printed: null,
            latest_funding_round_date: null,
            latest_funding_stage: null,
            funding_events: [],
            technology_names: ['Shopify Plus', 'Google Analytics'],
            current_technologies: [
              {
                uid: 'tech1',
                name: 'Shopify Plus',
                category: 'eCommerce'
              }
            ],
            account_id: null,
            account: null,
            departments: [
              {
                name: 'Engineering',
                headcount: 5000,
                headcount_growth_rate: 15.5
              }
            ],
            seo_description: 'Leading warehouse club',
            short_description: 'Warehouse club retailer',
            annual_revenue_printed: '$254.5B',
            annual_revenue: '254500000000',
            total_funding_usd: null,
            phone: '+1-425-313-8100'
          }
        },
        meta: {
          source: 'cache',
          cached: true,
          timestamp: '2025-01-01T00:00:00Z',
          latency_ms: 10
        }
      };

      mockHttpGet.mockResolvedValue(mockResponse);

      const result = await apolloClient.getIntentSignals('costco.com');

      expect(mockHttpGet).toHaveBeenCalledWith(
        '/organizations/enrich',
        {
          domain: 'costco.com'
        },
        {
          rateLimitKey: 'apollo',
          cacheTTL: 604800
        }
      );

      expect(result.data.organization.name).toBe('Costco Wholesale');
      expect(result.data.organization.estimated_num_employees).toBe(304000);
      expect(result.data.organization.departments).toHaveLength(1);
      expect(result.data.organization.departments[0].headcount_growth_rate).toBe(15.5);
    });
  });

  describe('getOrganization', () => {
    it('should get organization details with correct parameters', async () => {
      const mockResponse = {
        data: {
          organization: {
            id: 'org123',
            name: 'Costco Wholesale',
            website_url: 'https://costco.com',
            domain: 'costco.com',
            industry: 'Retail',
            estimated_num_employees: 304000,
            publicly_traded_symbol: 'COST',
            publicly_traded_exchange: 'NASDAQ',
            logo_url: 'https://example.com/logo.png',
            crunchbase_url: null,
            linkedin_url: 'https://linkedin.com/company/costco-wholesale',
            facebook_url: null,
            twitter_url: null,
            founded_year: 1983,
            city: 'Issaquah',
            state: 'Washington',
            country: 'United States',
            phone: '+1-425-313-8100',
            annual_revenue_printed: '$254.5B',
            total_funding_printed: null,
            technology_names: ['Shopify Plus', 'Google Analytics']
          }
        },
        meta: {
          source: 'api',
          cached: false,
          timestamp: '2025-01-01T00:00:00Z',
          latency_ms: 200
        }
      };

      mockHttpGet.mockResolvedValue(mockResponse);

      const result = await apolloClient.getOrganization('costco.com');

      expect(mockHttpGet).toHaveBeenCalledWith(
        '/organizations/enrich',
        {
          domain: 'costco.com'
        },
        {
          rateLimitKey: 'apollo',
          cacheTTL: 604800
        }
      );

      expect(result.data.organization.name).toBe('Costco Wholesale');
      expect(result.data.organization.estimated_num_employees).toBe(304000);
      expect(result.data.organization.technology_names).toContain('Shopify Plus');
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from HttpClient', async () => {
      const error = new Error('API rate limit exceeded');
      mockHttpGet.mockRejectedValue(error);

      await expect(
        apolloClient.searchPeople('example.com', ['CEO'])
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('Caching behavior', () => {
    it('should use 7-day cache TTL', async () => {
      mockHttpGet.mockResolvedValue({
        data: { people: [], pagination: {}, breadcrumbs: [] },
        meta: {}
      });

      await apolloClient.searchPeople('example.com', ['CEO']);

      expect(mockHttpGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTTL: 604800 // 7 days in seconds
        })
      );
    });

    it('should use apollo rate limit key', async () => {
      mockHttpGet.mockResolvedValue({
        data: { organization: {} },
        meta: {}
      });

      await apolloClient.getOrganization('example.com');

      expect(mockHttpGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          rateLimitKey: 'apollo'
        })
      );
    });
  });
});
