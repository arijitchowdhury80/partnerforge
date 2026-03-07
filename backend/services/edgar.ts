import { HttpClient } from './http-client';
import { config } from '../config';
import { APIResponse, SourceCitation } from '../types';
import { logger } from '../utils/logger';

/**
 * SEC EDGAR API Client
 *
 * Provides access to SEC filings (10-K, 10-Q, 8-K) for public companies.
 * Used for investor intelligence, risk factors, and executive quotes.
 *
 * Rate Limit: 10 req/s (SEC enforced)
 * Cost: FREE (public API)
 * Cache TTL: 30 days (filings never change once published)
 *
 * @see https://www.sec.gov/edgar/sec-api-documentation
 */
export class EdgarClient {
  private http: HttpClient;
  private readonly baseURL = 'https://www.sec.gov';
  private readonly cacheTTL = 2592000; // 30 days (filings are immutable)
  private readonly costPerCall = 0; // Free API
  private readonly rateLimitKey = 'edgar';

  constructor() {
    this.http = new HttpClient(
      this.baseURL,
      this.cacheTTL
    );

    // SEC requires User-Agent header
    this.http['client'].defaults.headers.common['User-Agent'] =
      'Algolia-Arian/1.0 (arijit.chowdhury@algolia.com)';

    logger.info('SEC EDGAR client initialized', {
      baseURL: this.baseURL,
      cacheTTL: this.cacheTTL,
      rateLimit: config.rateLimit.edgar || 10
    });
  }

  /**
   * Search for company filings by ticker symbol or CIK
   *
   * Finds 10-K, 10-Q, and 8-K filings for a company.
   * Returns accession numbers that can be used to fetch full filing content.
   *
   * @param identifier - Stock ticker (e.g., "COST") or CIK number
   * @param filingType - Type of filing to search for
   * @param limit - Maximum number of results (default: 10)
   * @returns List of filings with metadata
   *
   * @example
   * ```typescript
   * const edgar = new EdgarClient();
   *
   * // Search by ticker
   * const filings = await edgar.searchFilings('COST', '10-K', 5);
   *
   * // Returns:
   * // {
   * //   data: {
   * //     filings: [
   * //       {
   * //         accession_number: '0000909832-24-000012',
   * //         filing_date: '2024-09-27',
   * //         fiscal_year: '2024',
   * //         form_type: '10-K',
   * //         file_url: 'https://www.sec.gov/Archives/edgar/data/909832/...'
   * //       }
   * //     ],
   * //     company: {
   * //       cik: '0000909832',
   * //       name: 'COSTCO WHOLESALE CORP /NEW',
   * //       ticker: 'COST'
   * //     }
   * //   },
   * //   source: { provider: 'SEC EDGAR', ... }
   * // }
   * ```
   */
  async searchFilings(
    identifier: string,
    filingType: '10-K' | '10-Q' | '8-K' = '10-K',
    limit: number = 10
  ): Promise<APIResponse<FilingSearchResponse>> {
    // Resolve ticker to CIK if needed
    const cik = await this.resolveCIK(identifier);

    logger.debug('EDGAR: Searching filings', {
      identifier,
      cik,
      filingType,
      limit
    });

    // SEC EDGAR API endpoint
    const url = `/cgi-bin/browse-edgar`;
    const params = {
      action: 'getcompany',
      CIK: cik,
      type: filingType,
      dateb: '', // No date restriction
      owner: 'exclude',
      count: limit,
      output: 'atom'
    };

    const response = await this.http.get<any>(
      url,
      params,
      {
        rateLimitKey: this.rateLimitKey,
        cacheTTL: this.cacheTTL,
        costUsd: this.costPerCall
      }
    );

    // Parse ATOM feed response
    const filings = this.parseAtomFeed(response.data);
    const companyInfo = this.extractCompanyInfo(response.data);

    const result: FilingSearchResponse = {
      filings,
      company: companyInfo
    };

    const source: SourceCitation = {
      provider: 'SEC EDGAR',
      endpoint: url,
      url: `${this.baseURL}${url}?${new URLSearchParams(params as any).toString()}`,
      accessed_at: new Date().toISOString(),
      cache_hit: response.meta?.cached || false
    };

    return {
      data: result,
      source,
      meta: response.meta || {}
    };
  }

  /**
   * Get full filing content (10-K or 10-Q document)
   *
   * Downloads the complete filing document including:
   * - Business description
   * - Risk factors
   * - MD&A (Management Discussion & Analysis)
   * - Financial statements
   * - Executive compensation
   *
   * @param accessionNumber - Filing accession number (from searchFilings)
   * @param cik - Company CIK number
   * @returns Full filing content as plain text
   *
   * @example
   * ```typescript
   * const edgar = new EdgarClient();
   * const content = await edgar.getFilingContent(
   *   '0000909832-24-000012',
   *   '0000909832'
   * );
   *
   * // Returns ~100-200KB of filing text
   * console.log(content.data.text.substring(0, 1000)); // First 1000 chars
   * ```
   */
  async getFilingContent(
    accessionNumber: string,
    cik: string
  ): Promise<APIResponse<FilingContent>> {
    // Format accession number for URL (remove dashes)
    const formattedAccession = accessionNumber.replace(/-/g, '');

    // Construct filing URL
    const paddedCIK = cik.padStart(10, '0');
    const url = `/Archives/edgar/data/${paddedCIK}/${formattedAccession}.txt`;

    logger.debug('EDGAR: Fetching filing content', {
      accessionNumber,
      cik,
      url
    });

    const response = await this.http.get<string>(
      url,
      {},
      {
        rateLimitKey: this.rateLimitKey,
        cacheTTL: this.cacheTTL,
        costUsd: this.costPerCall
      }
    );

    const result: FilingContent = {
      accession_number: accessionNumber,
      cik,
      text: response.data,
      size_bytes: response.data.length,
      url: `${this.baseURL}${url}`
    };

    const source: SourceCitation = {
      provider: 'SEC EDGAR',
      endpoint: url,
      url: `${this.baseURL}${url}`,
      accessed_at: new Date().toISOString(),
      cache_hit: response.meta?.cached || false
    };

    return {
      data: result,
      source,
      meta: response.meta || {}
    };
  }

  /**
   * Extract and parse risk factors from a 10-K filing
   *
   * Risk factors are a goldmine for strategic insights:
   * - Technology stack concerns → "Our legacy search infrastructure..."
   * - Competitive threats → "Competitors with better search experiences..."
   * - Growth challenges → "Scaling our platform to handle increased traffic..."
   * - Regulatory risks → compliance requirements
   *
   * @param filingContent - Full filing text (from getFilingContent)
   * @returns Structured risk factors with categories
   *
   * @example
   * ```typescript
   * const edgar = new EdgarClient();
   * const content = await edgar.getFilingContent('...', '...');
   * const risks = await edgar.parseRiskFactors(content.data.text);
   *
   * // Returns:
   * // {
   * //   data: {
   * //     risk_factors: [
   * //       {
   * //         category: 'Technology',
   * //         risk: 'Our legacy search infrastructure may not scale...',
   * //         severity: 'high',
   * //         algolia_relevance: 0.85
   * //       }
   * //     ],
   * //     total_risks: 15,
   * //     high_severity_count: 3
   * //   }
   * // }
   * ```
   */
  async parseRiskFactors(
    filingContent: string
  ): Promise<APIResponse<RiskFactors>> {
    logger.debug('EDGAR: Parsing risk factors');

    // Find "Item 1A. Risk Factors" section
    const riskSectionMatch = filingContent.match(
      /Item\s+1A\.?\s+Risk\s+Factors([\s\S]*?)(?=Item\s+1B|Item\s+2\.)/i
    );

    if (!riskSectionMatch) {
      logger.warn('EDGAR: Risk Factors section not found in filing');
      return {
        data: {
          risk_factors: [],
          total_risks: 0,
          high_severity_count: 0
        },
        source: {
          provider: 'SEC EDGAR',
          endpoint: '/parse/risk-factors',
          accessed_at: new Date().toISOString()
        },
        meta: {}
      };
    }

    const riskText = riskSectionMatch[1];

    // Split into individual risks (usually separated by headers or paragraphs)
    const riskParagraphs = riskText
      .split(/\n\n+/)
      .filter(p => p.trim().length > 100) // Filter out short paragraphs
      .slice(0, 20); // Limit to first 20 risks

    // Categorize and analyze each risk
    const riskFactors: RiskFactor[] = riskParagraphs.map(risk => {
      const category = this.categorizeRisk(risk);
      const severity = this.assessSeverity(risk);
      const algoliaRelevance = this.calculateAlgoliaRelevance(risk);

      return {
        category,
        risk: risk.trim().substring(0, 500), // First 500 chars
        severity,
        algolia_relevance: algoliaRelevance
      };
    });

    // Sort by Algolia relevance (highest first)
    riskFactors.sort((a, b) => b.algolia_relevance - a.algolia_relevance);

    const result: RiskFactors = {
      risk_factors: riskFactors,
      total_risks: riskFactors.length,
      high_severity_count: riskFactors.filter(r => r.severity === 'high').length
    };

    const source: SourceCitation = {
      provider: 'SEC EDGAR',
      endpoint: '/parse/risk-factors',
      accessed_at: new Date().toISOString()
    };

    return {
      data: result,
      source,
      meta: {}
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Resolve stock ticker to CIK number
   */
  private async resolveCIK(identifier: string): Promise<string> {
    // If already a CIK (numeric), return as-is
    if (/^\d+$/.test(identifier)) {
      return identifier.padStart(10, '0');
    }

    // Otherwise, look up ticker in SEC company tickers JSON
    // https://www.sec.gov/files/company_tickers.json
    try {
      const response = await this.http.get<any>(
        '/files/company_tickers.json',
        {},
        {
          rateLimitKey: this.rateLimitKey,
          cacheTTL: 86400 // Cache ticker lookup for 1 day
        }
      );

      // Find company by ticker
      const companies = Object.values(response.data || {}) as any[];
      const company = companies.find(
        c => c.ticker?.toUpperCase() === identifier.toUpperCase()
      );

      if (company && company.cik_str) {
        return String(company.cik_str).padStart(10, '0');
      }

      throw new Error(`Ticker ${identifier} not found in SEC database`);
    } catch (error) {
      logger.error('EDGAR: Failed to resolve ticker to CIK', { identifier, error });
      throw error;
    }
  }

  /**
   * Parse ATOM feed response to extract filing metadata
   */
  private parseAtomFeed(atomXml: string): Filing[] {
    // Simple regex parsing (in production, use an XML parser like 'fast-xml-parser')
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    const filings: Filing[] = [];

    let match;
    while ((match = entryRegex.exec(atomXml)) !== null) {
      const entry = match[1];

      const accessionNumber = this.extractXmlTag(entry, 'accession-number');
      const filingDate = this.extractXmlTag(entry, 'filing-date');
      const formType = this.extractXmlTag(entry, 'filing-type');
      const fileUrl = this.extractXmlTag(entry, 'filing-href');
      const fiscalYear = this.extractXmlTag(entry, 'fiscal-year');

      if (accessionNumber && filingDate) {
        filings.push({
          accession_number: accessionNumber,
          filing_date: filingDate,
          fiscal_year: fiscalYear || '',
          form_type: formType || '',
          file_url: fileUrl || ''
        });
      }
    }

    return filings;
  }

  /**
   * Extract company info from ATOM feed
   */
  private extractCompanyInfo(atomXml: string): CompanyInfo {
    const cik = this.extractXmlTag(atomXml, 'cik');
    const name = this.extractXmlTag(atomXml, 'company-name');

    return {
      cik: cik || '',
      name: name || '',
      ticker: '' // Not available in ATOM feed
    };
  }

  /**
   * Extract tag value from XML string
   */
  private extractXmlTag(xml: string, tagName: string): string {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Categorize risk by keywords
   */
  private categorizeRisk(riskText: string): RiskCategory {
    const text = riskText.toLowerCase();

    if (text.match(/technology|system|infrastructure|platform|cyber|data breach|security/i)) {
      return 'Technology';
    }
    if (text.match(/competition|competitor|market share|disruption/i)) {
      return 'Competition';
    }
    if (text.match(/growth|scale|expand|volume|traffic/i)) {
      return 'Growth';
    }
    if (text.match(/regulation|compliance|legal|law|gdpr|privacy/i)) {
      return 'Regulatory';
    }
    if (text.match(/finance|revenue|profit|cost|expense/i)) {
      return 'Financial';
    }
    if (text.match(/operation|supply chain|logistics|personnel/i)) {
      return 'Operational';
    }

    return 'Other';
  }

  /**
   * Assess risk severity based on keywords
   */
  private assessSeverity(riskText: string): 'high' | 'medium' | 'low' {
    const text = riskText.toLowerCase();

    // High severity indicators
    if (text.match(/material adverse|significantly|substantial|critical|severe/i)) {
      return 'high';
    }

    // Low severity indicators
    if (text.match(/may|could|possible|potential/i)) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Calculate Algolia relevance score (0-1)
   * Based on search/search experience keywords
   */
  private calculateAlgoliaRelevance(riskText: string): number {
    const text = riskText.toLowerCase();
    let score = 0;

    // Direct search mentions
    if (text.match(/search|find|discover|query/i)) score += 0.4;

    // User experience
    if (text.match(/user experience|customer experience|satisfaction/i)) score += 0.3;

    // Technology/platform
    if (text.match(/technology|platform|infrastructure|system/i)) score += 0.2;

    // Performance/scale
    if (text.match(/performance|speed|scale|latency|response time/i)) score += 0.2;

    // E-commerce specific
    if (text.match(/e-commerce|online|website|conversion|cart/i)) score += 0.1;

    // Competition
    if (text.match(/competitor|competitive advantage/i)) score += 0.1;

    return Math.min(score, 1.0);
  }
}

// ============================================================================
// Type Definitions
// ============================================================================

export interface Filing {
  accession_number: string;  // "0000909832-24-000012"
  filing_date: string;        // "2024-09-27"
  fiscal_year: string;        // "2024"
  form_type: string;          // "10-K"
  file_url: string;           // Full URL to filing
}

export interface CompanyInfo {
  cik: string;                // "0000909832"
  name: string;               // "COSTCO WHOLESALE CORP /NEW"
  ticker: string;             // "COST"
}

export interface FilingSearchResponse {
  filings: Filing[];
  company: CompanyInfo;
}

export interface FilingContent {
  accession_number: string;
  cik: string;
  text: string;               // Full filing text (100-200KB)
  size_bytes: number;
  url: string;
}

export type RiskCategory =
  | 'Technology'
  | 'Competition'
  | 'Growth'
  | 'Regulatory'
  | 'Financial'
  | 'Operational'
  | 'Other';

export interface RiskFactor {
  category: RiskCategory;
  risk: string;               // Risk description (first 500 chars)
  severity: 'high' | 'medium' | 'low';
  algolia_relevance: number;  // 0-1 score
}

export interface RiskFactors {
  risk_factors: RiskFactor[];
  total_risks: number;
  high_severity_count: number;
}
