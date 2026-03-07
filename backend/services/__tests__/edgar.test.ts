import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EdgarClient } from '../edgar';
import { HttpClient } from '../http-client';

// Mock the HttpClient
vi.mock('../http-client');
vi.mock('../../config', () => ({
  config: {
    rateLimit: {
      edgar: 10
    }
  }
}));

describe('EdgarClient', () => {
  let edgarClient: EdgarClient;
  let mockHttpGet: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock for http.get
    mockHttpGet = vi.fn();
    HttpClient.prototype.get = mockHttpGet;

    edgarClient = new EdgarClient();
  });

  describe('searchFilings', () => {
    it('should search filings by ticker symbol', async () => {
      // Mock ticker lookup
      mockHttpGet.mockResolvedValueOnce({
        data: {
          '0': { cik_str: 909832, ticker: 'COST', title: 'COSTCO WHOLESALE CORP /NEW' }
        },
        meta: {}
      });

      // Mock filings search
      const mockAtomFeed = `
        <feed>
          <entry>
            <accession-number>0000909832-24-000012</accession-number>
            <filing-date>2024-09-27</filing-date>
            <filing-type>10-K</filing-type>
            <fiscal-year>2024</fiscal-year>
            <filing-href>https://www.sec.gov/...</filing-href>
          </entry>
          <entry>
            <accession-number>0000909832-23-000015</accession-number>
            <filing-date>2023-09-29</filing-date>
            <filing-type>10-K</filing-type>
            <fiscal-year>2023</fiscal-year>
            <filing-href>https://www.sec.gov/...</filing-href>
          </entry>
        </feed>
      `;

      mockHttpGet.mockResolvedValueOnce({
        data: mockAtomFeed,
        meta: { cached: false }
      });

      const result = await edgarClient.searchFilings('COST', '10-K', 10);

      // Verify ticker lookup was called
      expect(mockHttpGet).toHaveBeenCalledWith(
        '/files/company_tickers.json',
        {},
        expect.objectContaining({
          rateLimitKey: 'edgar',
          cacheTTL: 86400
        })
      );

      // Verify filings search was called
      expect(mockHttpGet).toHaveBeenCalledWith(
        '/cgi-bin/browse-edgar',
        expect.objectContaining({
          action: 'getcompany',
          CIK: '0000909832',
          type: '10-K',
          count: 10
        }),
        expect.objectContaining({
          rateLimitKey: 'edgar',
          cacheTTL: 2592000,
          costUsd: 0
        })
      );

      // Verify response structure
      expect(result.data.filings).toHaveLength(2);
      expect(result.data.filings[0]).toMatchObject({
        accession_number: '0000909832-24-000012',
        filing_date: '2024-09-27',
        form_type: '10-K',
        fiscal_year: '2024'
      });

      expect(result.source.provider).toBe('SEC EDGAR');
      expect(result.source.cache_hit).toBe(false);
    });

    it('should handle CIK number directly', async () => {
      const mockAtomFeed = '<feed><entry><accession-number>123</accession-number></entry></feed>';

      mockHttpGet.mockResolvedValueOnce({
        data: mockAtomFeed,
        meta: {}
      });

      await edgarClient.searchFilings('0000909832', '10-K');

      // Should NOT call ticker lookup
      expect(mockHttpGet).toHaveBeenCalledTimes(1);
      expect(mockHttpGet).toHaveBeenCalledWith(
        '/cgi-bin/browse-edgar',
        expect.objectContaining({
          CIK: '0000909832'
        }),
        expect.any(Object)
      );
    });

    it('should use default limit of 10', async () => {
      mockHttpGet.mockResolvedValueOnce({
        data: { '0': { cik_str: 909832, ticker: 'COST' } },
        meta: {}
      });

      mockHttpGet.mockResolvedValueOnce({
        data: '<feed></feed>',
        meta: {}
      });

      await edgarClient.searchFilings('COST', '10-K');

      expect(mockHttpGet).toHaveBeenCalledWith(
        '/cgi-bin/browse-edgar',
        expect.objectContaining({
          count: 10
        }),
        expect.any(Object)
      );
    });
  });

  describe('getFilingContent', () => {
    it('should fetch full filing content', async () => {
      const mockFilingText = `
        UNITED STATES SECURITIES AND EXCHANGE COMMISSION
        FORM 10-K

        Item 1. Business
        Costco operates...

        Item 1A. Risk Factors
        Our business is subject to various risks...
      `;

      mockHttpGet.mockResolvedValueOnce({
        data: mockFilingText,
        meta: { cached: true }
      });

      const result = await edgarClient.getFilingContent(
        '0000909832-24-000012',
        '0000909832'
      );

      expect(mockHttpGet).toHaveBeenCalledWith(
        '/Archives/edgar/data/0000909832/000090983224000012.txt',
        {},
        expect.objectContaining({
          rateLimitKey: 'edgar',
          cacheTTL: 2592000,
          costUsd: 0
        })
      );

      expect(result.data.text).toContain('FORM 10-K');
      expect(result.data.text).toContain('Risk Factors');
      expect(result.data.accession_number).toBe('0000909832-24-000012');
      expect(result.data.size_bytes).toBeGreaterThan(0);
      expect(result.source.cache_hit).toBe(true);
    });

    it('should format accession number correctly', async () => {
      mockHttpGet.mockResolvedValueOnce({
        data: 'filing content',
        meta: {}
      });

      await edgarClient.getFilingContent('0000909832-24-000012', '909832');

      // Should pad CIK and remove dashes from accession number
      expect(mockHttpGet).toHaveBeenCalledWith(
        '/Archives/edgar/data/0000909832/000090983224000012.txt',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('parseRiskFactors', () => {
    it('should extract and categorize risk factors', async () => {
      const filingContent = `
        Item 1A. Risk Factors

        Our business depends on technology systems and infrastructure.
        If our legacy search infrastructure fails to scale or becomes obsolete,
        we may experience material adverse effects on our operations and revenue.

        We face significant competition from other retailers with superior
        e-commerce platforms and search experiences. This competitive pressure
        could substantially impact our market share.

        Regulatory changes related to data privacy and GDPR compliance may
        require us to modify our systems and processes.

        Item 1B. Unresolved Staff Comments
      `;

      const result = await edgarClient.parseRiskFactors(filingContent);

      expect(result.data.risk_factors.length).toBeGreaterThan(0);
      expect(result.data.total_risks).toBe(result.data.risk_factors.length);

      // Check for technology risk
      const techRisk = result.data.risk_factors.find(r => r.category === 'Technology');
      expect(techRisk).toBeDefined();
      expect(techRisk?.risk).toContain('technology systems');
      expect(techRisk?.severity).toBe('high'); // "material adverse"
      expect(techRisk?.algolia_relevance).toBeGreaterThan(0.5); // High relevance

      // Check for competition risk
      const compRisk = result.data.risk_factors.find(r => r.category === 'Competition');
      expect(compRisk).toBeDefined();
      expect(compRisk?.algolia_relevance).toBeGreaterThan(0.5); // Mentions search

      // Check for regulatory risk
      const regRisk = result.data.risk_factors.find(r => r.category === 'Regulatory');
      expect(regRisk).toBeDefined();
    });

    it('should handle missing risk factors section', async () => {
      const filingContent = `
        Item 1. Business
        We are a company.

        Item 2. Properties
      `;

      const result = await edgarClient.parseRiskFactors(filingContent);

      expect(result.data.risk_factors).toHaveLength(0);
      expect(result.data.total_risks).toBe(0);
      expect(result.data.high_severity_count).toBe(0);
    });

    it('should sort risks by Algolia relevance', async () => {
      const filingContent = `
        Item 1A. Risk Factors

        Our search functionality may not meet user expectations, impacting
        customer satisfaction and conversion rates on our e-commerce platform.

        We may face challenges in our supply chain operations.

        Competition in online retail and search experiences is intense, with
        competitors investing heavily in improving their search technology and
        platform performance.

        Item 1B. Next
      `;

      const result = await edgarClient.parseRiskFactors(filingContent);

      // First risk should have highest Algolia relevance (search + e-commerce + conversion)
      expect(result.data.risk_factors[0].algolia_relevance)
        .toBeGreaterThan(result.data.risk_factors[1].algolia_relevance);

      // Supply chain risk should have lowest relevance
      const supplyChainRisk = result.data.risk_factors.find(
        r => r.risk.includes('supply chain')
      );
      expect(supplyChainRisk?.algolia_relevance).toBeLessThan(0.3);
    });

    it('should count high severity risks', async () => {
      const filingContent = `
        Item 1A. Risk Factors

        A material adverse effect could occur if our systems fail.

        We may experience some difficulties in operations.

        Critical infrastructure issues could significantly impact our business.

        Item 1B. Next
      `;

      const result = await edgarClient.parseRiskFactors(filingContent);

      // Should have 2 high severity risks (material adverse, critical+significantly)
      expect(result.data.high_severity_count).toBeGreaterThan(0);

      const highRisks = result.data.risk_factors.filter(r => r.severity === 'high');
      expect(highRisks.length).toBe(result.data.high_severity_count);
    });
  });

  describe('Error Handling', () => {
    it('should handle ticker not found', async () => {
      mockHttpGet.mockResolvedValueOnce({
        data: {},
        meta: {}
      });

      await expect(
        edgarClient.searchFilings('INVALID', '10-K')
      ).rejects.toThrow('Ticker INVALID not found');
    });

    it('should handle API errors gracefully', async () => {
      mockHttpGet.mockRejectedValueOnce(new Error('SEC API unavailable'));

      await expect(
        edgarClient.getFilingContent('123', '456')
      ).rejects.toThrow();
    });
  });

  describe('Rate Limiting', () => {
    it('should use SEC rate limit (10 req/s)', async () => {
      mockHttpGet.mockResolvedValue({
        data: '<feed></feed>',
        meta: {}
      });

      await edgarClient.searchFilings('0000909832', '10-K');

      expect(mockHttpGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          rateLimitKey: 'edgar'
        })
      );
    });
  });

  describe('Caching', () => {
    it('should use 30-day cache for filings (immutable)', async () => {
      mockHttpGet.mockResolvedValue({
        data: 'content',
        meta: {}
      });

      await edgarClient.getFilingContent('123', '456');

      expect(mockHttpGet).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          cacheTTL: 2592000 // 30 days
        })
      );
    });

    it('should use 1-day cache for ticker lookup', async () => {
      mockHttpGet.mockResolvedValueOnce({
        data: { '0': { cik_str: 123, ticker: 'TEST' } },
        meta: {}
      });

      mockHttpGet.mockResolvedValueOnce({
        data: '<feed></feed>',
        meta: {}
      });

      await edgarClient.searchFilings('TEST', '10-K');

      expect(mockHttpGet).toHaveBeenNthCalledWith(
        1,
        '/files/company_tickers.json',
        {},
        expect.objectContaining({
          cacheTTL: 86400 // 1 day
        })
      );
    });
  });
});
