/**
 * SEC EDGAR API Client Tests
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SecEdgarClient,
  secEdgarClient,
  SecFiling,
  SecCompany,
  Sec10KData,
  SecRiskFactor,
} from '../clients/secedgar';

// ============================================================================
// Mock Data
// ============================================================================

const mockCompanySubmissions = {
  cik: '909832',
  name: 'COSTCO WHOLESALE CORP',
  tickers: ['COST'],
  exchanges: ['NASDAQ'],
  sic: '5311',
  sicDescription: 'Retail-Department Stores',
  stateOfIncorporation: 'WA',
  fiscalYearEnd: '0831',
  filings: {
    recent: {
      accessionNumber: ['0000909832-24-000045', '0000909832-24-000032'],
      filingDate: ['2024-10-15', '2024-07-12'],
      reportDate: ['2024-09-01', '2024-06-30'],
      form: ['10-K', '10-Q'],
      primaryDocument: ['cost10k_20240901.htm', 'cost10q_20240630.htm'],
      primaryDocDescription: ['10-K', '10-Q'],
      fileNumber: ['0-20355', '0-20355'],
      filmNumber: ['241234567', '241234568'],
      items: ['', ''],
      size: [15000000, 8000000],
      isXBRL: [1, 1],
      isInlineXBRL: [1, 1],
    },
  },
};

const mock10KHtml = `
<!DOCTYPE html>
<html>
<body>
<h1>COSTCO WHOLESALE CORPORATION</h1>

<h2>Item 1A. Risk Factors</h2>
<p>
<b>Our technology systems may be inadequate or may fail to operate effectively.</b>
We rely heavily on technology systems for our operations. A failure or breach could impact our business.
</p>
<p>
<b>Competition in the retail industry is intense.</b>
We face significant competition from traditional retailers and e-commerce companies.
</p>
<p>
<b>We may be subject to regulatory requirements.</b>
Compliance with various regulations could increase our costs.
</p>

<h2>Item 7. Management's Discussion and Analysis</h2>
<p>Revenue increased by 8% compared to the prior year, driven by strong e-commerce growth.</p>
<p>Net sales grew across all merchandise categories.</p>
<p>Digital sales continued to show strong momentum with investments in technology infrastructure.</p>
<p>We invested in technology to improve customer experience and operational efficiency.</p>
<p>Our search functionality improvements led to better product discovery.</p>

</body>
</html>
`;

// ============================================================================
// Tests
// ============================================================================

describe('SecEdgarClient', () => {
  let client: SecEdgarClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new SecEdgarClient();
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // CIK Resolution
  // -------------------------------------------------------------------------

  describe('resolveCik', () => {
    it('should resolve ticker from static mapping', async () => {
      const cik = await client.resolveCik('COST');
      expect(cik).toBe('0000909832');
    });

    it('should resolve ticker case-insensitively', async () => {
      const cik = await client.resolveCik('cost');
      expect(cik).toBe('0000909832');
    });

    it('should return null for unknown ticker without API fallback', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const cik = await client.resolveCik('UNKNOWNTICKER');
      expect(cik).toBeNull();
    });

    it('should resolve common retail tickers', async () => {
      expect(await client.resolveCik('WMT')).toBe('0000104169');
      expect(await client.resolveCik('TGT')).toBe('0000027419');
      expect(await client.resolveCik('AZO')).toBe('0000866787');
      expect(await client.resolveCik('NKE')).toBe('0000320187');
    });

    it('should resolve tech company tickers', async () => {
      expect(await client.resolveCik('AMZN')).toBe('0001018724');
      expect(await client.resolveCik('AAPL')).toBe('0000320193');
      expect(await client.resolveCik('GOOGL')).toBe('0001652044');
    });
  });

  describe('resolveCikFromDomain', () => {
    it('should resolve domain to CIK', async () => {
      const cik = await client.resolveCikFromDomain('costco.com');
      expect(cik).toBe('0000909832');
    });

    it('should handle www prefix', async () => {
      const cik = await client.resolveCikFromDomain('www.costco.com');
      expect(cik).toBe('0000909832');
    });

    it('should return null for unknown domain', async () => {
      const cik = await client.resolveCikFromDomain('unknowndomain.com');
      expect(cik).toBeNull();
    });

    it('should resolve common retail domains', async () => {
      expect(await client.resolveCikFromDomain('walmart.com')).toBe('0000104169');
      expect(await client.resolveCikFromDomain('target.com')).toBe('0000027419');
      expect(await client.resolveCikFromDomain('autozone.com')).toBe('0000866787');
    });
  });

  // -------------------------------------------------------------------------
  // Company Submissions
  // -------------------------------------------------------------------------

  describe('getCompanySubmissions', () => {
    it('should fetch and parse company submissions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const result = await client.getCompanySubmissions('909832');

      expect(result).not.toBeNull();
      expect(result!.company.name).toBe('COSTCO WHOLESALE CORP');
      expect(result!.company.ticker).toBe('COST');
      expect(result!.filings.length).toBe(2);
    });

    it('should build correct filing URLs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const result = await client.getCompanySubmissions('909832');

      expect(result!.filings[0].url).toContain('sec.gov/Archives/edgar/data');
      expect(result!.filings[0].url).toContain('909832');
    });

    it('should pad CIK with zeros', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      await client.getCompanySubmissions('909832');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('CIK0000909832.json'),
        expect.any(Object)
      );
    });

    it('should return null on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await client.getCompanySubmissions('invalid');
      expect(result).toBeNull();
    });

    it('should include required headers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      await client.getCompanySubmissions('909832');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('PartnerForge'),
          }),
        })
      );
    });
  });

  // -------------------------------------------------------------------------
  // Filing Retrieval
  // -------------------------------------------------------------------------

  describe('getFilingsByType', () => {
    it('should filter filings by type', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const filings = await client.getFilingsByType('909832', '10-K', 5);

      expect(filings.length).toBe(1);
      expect(filings[0].form).toBe('10-K');
    });

    it('should respect limit parameter', async () => {
      const manyFilings = {
        ...mockCompanySubmissions,
        filings: {
          recent: {
            ...mockCompanySubmissions.filings.recent,
            form: ['10-K', '10-K', '10-K', '10-K', '10-K'],
            accessionNumber: ['1', '2', '3', '4', '5'],
            filingDate: ['2024-01-01', '2023-01-01', '2022-01-01', '2021-01-01', '2020-01-01'],
            reportDate: ['2024-01-01', '2023-01-01', '2022-01-01', '2021-01-01', '2020-01-01'],
            primaryDocument: ['a.htm', 'b.htm', 'c.htm', 'd.htm', 'e.htm'],
            primaryDocDescription: ['', '', '', '', ''],
            fileNumber: ['', '', '', '', ''],
            filmNumber: ['', '', '', '', ''],
            items: ['', '', '', '', ''],
            size: [1, 1, 1, 1, 1],
            isXBRL: [1, 1, 1, 1, 1],
            isInlineXBRL: [1, 1, 1, 1, 1],
          },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(manyFilings),
      });

      const filings = await client.getFilingsByType('909832', '10-K', 3);
      expect(filings.length).toBe(3);
    });
  });

  describe('getMostRecent10K', () => {
    it('should return most recent 10-K', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const filing = await client.getMostRecent10K('909832');

      expect(filing).not.toBeNull();
      expect(filing!.form).toBe('10-K');
      expect(filing!.filingDate).toBe('2024-10-15');
    });

    it('should return null if no 10-K exists', async () => {
      const no10K = {
        ...mockCompanySubmissions,
        filings: {
          recent: {
            ...mockCompanySubmissions.filings.recent,
            form: ['10-Q', '8-K'],
          },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(no10K),
      });

      const filing = await client.getMostRecent10K('909832');
      expect(filing).toBeNull();
    });
  });

  describe('getMostRecent10Q', () => {
    it('should return most recent 10-Q', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const filing = await client.getMostRecent10Q('909832');

      expect(filing).not.toBeNull();
      expect(filing!.form).toBe('10-Q');
    });
  });

  // -------------------------------------------------------------------------
  // 10-K Analysis
  // -------------------------------------------------------------------------

  describe('analyze10K', () => {
    const mockFiling: SecFiling = {
      accessionNumber: '0000909832-24-000045',
      filingDate: '2024-10-15',
      reportDate: '2024-09-01',
      form: '10-K',
      primaryDocument: 'cost10k.htm',
      primaryDocDescription: '10-K',
      fileNumber: '0-20355',
      filmNumber: '241234567',
      size: 15000000,
      isXBRL: true,
      isInlineXBRL: true,
      url: 'https://www.sec.gov/Archives/edgar/data/909832/cost10k.htm',
    };

    const mockCompany: SecCompany = {
      cik: '909832',
      cik_str: '0000909832',
      name: 'COSTCO WHOLESALE CORP',
      ticker: 'COST',
      fiscalYearEnd: '0831',
    };

    it('should extract risk factors from 10-K', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      expect(analysis.riskFactors.length).toBeGreaterThan(0);
    });

    it('should categorize risk factors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      const techRisks = analysis.riskFactors.filter(r => r.category === 'technology');
      const competitionRisks = analysis.riskFactors.filter(r => r.category === 'competition');

      expect(techRisks.length).toBeGreaterThan(0);
      expect(competitionRisks.length).toBeGreaterThan(0);
    });

    it('should assign Algolia relevance to risk factors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      const highRelevance = analysis.riskFactors.filter(r => r.relevanceToAlgolia === 'high');
      expect(highRelevance.length).toBeGreaterThan(0);
    });

    it('should extract MD&A highlights', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      expect(analysis.mdaHighlights.length).toBeGreaterThan(0);
    });

    it('should extract digital mentions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      expect(analysis.digitalMentions.length).toBeGreaterThan(0);
    });

    it('should extract search mentions', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      expect(analysis.searchMentions.length).toBeGreaterThan(0);
    });

    it('should handle fetch errors gracefully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const analysis = await client.analyze10K(mockFiling, mockCompany);

      expect(analysis.accessionNumber).toBe(mockFiling.accessionNumber);
      expect(analysis.riskFactors).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Full Data
  // -------------------------------------------------------------------------

  describe('getFullData', () => {
    it('should aggregate all company SEC data', async () => {
      // First call: company submissions
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      // Second call: 10-K document
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      // Third call: 10-Q document
      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body>Quarterly report</body></html>'),
      });

      const data = await client.getFullData('909832');

      expect(data).not.toBeNull();
      expect(data!.company.name).toBe('COSTCO WHOLESALE CORP');
      expect(data!.filings.tenK.length).toBeGreaterThan(0);
      expect(data!.fetchedAt).toBeDefined();
    });

    it('should determine digital transformation stage', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      });

      const data = await client.getFullData('909832');

      expect(['early', 'mid', 'advanced', 'unknown']).toContain(data!.digitalTransformationStage);
    });

    it('should return null for invalid CIK', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const data = await client.getFullData('invalid');
      expect(data).toBeNull();
    });
  });

  describe('getFullDataByTicker', () => {
    it('should resolve ticker and get full data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      });

      const data = await client.getFullDataByTicker('COST');

      expect(data).not.toBeNull();
      expect(data!.company.ticker).toBe('COST');
    });

    it('should return null for unknown ticker', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const data = await client.getFullDataByTicker('UNKNOWNTICKER');
      expect(data).toBeNull();
    });
  });

  describe('getFullDataByDomain', () => {
    it('should resolve domain and get full data', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      });

      const data = await client.getFullDataByDomain('costco.com');

      expect(data).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Convenience Methods
  // -------------------------------------------------------------------------

  describe('getHighRelevanceRisks', () => {
    it('should return only high relevance risks', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mock10KHtml),
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('<html><body></body></html>'),
      });

      const risks = await client.getHighRelevanceRisks('909832');

      expect(risks.every(r => r.relevanceToAlgolia === 'high')).toBe(true);
    });
  });

  describe('hasRecentFilings', () => {
    it('should return true for recent filings', async () => {
      // Use current date for recent filings
      const recentDate = new Date().toISOString().split('T')[0];
      const recentFilings = {
        ...mockCompanySubmissions,
        filings: {
          recent: {
            ...mockCompanySubmissions.filings.recent,
            filingDate: [recentDate, recentDate],
          },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(recentFilings),
      });

      const hasRecent = await client.hasRecentFilings('909832');
      expect(hasRecent).toBe(true);
    });

    it('should return false for old filings', async () => {
      const oldFilings = {
        ...mockCompanySubmissions,
        filings: {
          recent: {
            ...mockCompanySubmissions.filings.recent,
            filingDate: ['2020-01-01', '2019-01-01'],
          },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(oldFilings),
      });

      const hasRecent = await client.hasRecentFilings('909832');
      expect(hasRecent).toBe(false);
    });
  });

  describe('getFilingUrls', () => {
    it('should return filing URLs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const urls = await client.getFilingUrls('909832', '10-K', 3);

      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toContain('sec.gov');
    });
  });

  // -------------------------------------------------------------------------
  // Rate Limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('should enforce minimum request interval', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCompanySubmissions),
      });

      const start = Date.now();

      // Make multiple rapid requests
      await client.getCompanySubmissions('909832');
      await client.getCompanySubmissions('909832');
      await client.getCompanySubmissions('909832');

      const elapsed = Date.now() - start;

      // Should take at least 200ms for 3 requests with 100ms interval
      expect(elapsed).toBeGreaterThanOrEqual(150);
    });
  });

  // -------------------------------------------------------------------------
  // Singleton Export
  // -------------------------------------------------------------------------

  describe('singleton export', () => {
    it('should export singleton instance', () => {
      expect(secEdgarClient).toBeInstanceOf(SecEdgarClient);
    });
  });
});
