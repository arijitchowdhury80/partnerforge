/**
 * SEC EDGAR API Client
 *
 * Fetches SEC filings (10-K, 10-Q, 8-K) directly from SEC EDGAR.
 * No API key required - free public API.
 *
 * Endpoints:
 * 1. Company Search - Find CIK by company name or ticker
 * 2. Company Submissions - Get all filings for a CIK
 * 3. Filing Content - Fetch actual filing documents
 * 4. Full-Text Search - Search across all filings
 *
 * Rate Limits:
 * - SEC requests max 10 requests/second
 * - User-Agent header required
 */

// ============================================================================
// Types
// ============================================================================

export interface SecCompany {
  cik: string;
  cik_str: string;
  name: string;
  ticker?: string;
  exchange?: string;
  sic?: string;
  sicDescription?: string;
  stateOfIncorporation?: string;
  fiscalYearEnd?: string;
}

export interface SecFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  form: string; // '10-K', '10-Q', '8-K', etc.
  primaryDocument: string;
  primaryDocDescription: string;
  fileNumber: string;
  filmNumber: string;
  items?: string;
  size: number;
  isXBRL: boolean;
  isInlineXBRL: boolean;
  url: string;
}

export interface SecFilingDetail {
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate: string;
  company: SecCompany;
  documents: SecDocument[];
  exhibits: SecExhibit[];
}

export interface SecDocument {
  sequence: string;
  description: string;
  documentUrl: string;
  type: string;
  size: number;
}

export interface SecExhibit {
  sequence: string;
  description: string;
  documentUrl: string;
  type: string;
}

export interface Sec10KData {
  accessionNumber: string;
  filingDate: string;
  fiscalYearEnd: string;
  company: SecCompany;

  // Business description (Item 1)
  businessDescription?: string;

  // Risk factors (Item 1A)
  riskFactors: SecRiskFactor[];

  // MD&A highlights (Item 7)
  mdaHighlights: string[];

  // Financial highlights
  financialHighlights?: {
    totalRevenue?: number;
    netIncome?: number;
    totalAssets?: number;
    totalDebt?: number;
  };

  // Key metrics mentioned
  keyMetrics: Array<{
    metric: string;
    value: string;
    context?: string;
  }>;

  // Digital/technology mentions
  digitalMentions: string[];
  searchMentions: string[];

  documentUrl: string;
}

export interface Sec10QData {
  accessionNumber: string;
  filingDate: string;
  fiscalQuarter: string; // 'Q1', 'Q2', 'Q3'
  fiscalYear: number;
  company: SecCompany;

  // MD&A highlights
  mdaHighlights: string[];

  // Quarter performance
  quarterlyHighlights?: {
    revenue?: number;
    revenueChange?: number;
    netIncome?: number;
    eps?: number;
  };

  // Risk updates
  riskUpdates: string[];

  // Digital mentions
  digitalMentions: string[];

  documentUrl: string;
}

export interface Sec8KData {
  accessionNumber: string;
  filingDate: string;
  company: SecCompany;
  items: Sec8KItem[];
  documentUrl: string;
}

export interface Sec8KItem {
  itemNumber: string;
  itemTitle: string;
  content: string;
}

export interface SecRiskFactor {
  title: string;
  summary: string;
  category: 'technology' | 'competition' | 'regulatory' | 'operational' | 'financial' | 'market' | 'other';
  relevanceToAlgolia: 'high' | 'medium' | 'low';
  fullText?: string;
}

export interface SecFullData {
  company: SecCompany;
  filings: {
    tenK: Sec10KData[];
    tenQ: Sec10QData[];
    eightK: Sec8KData[];
  };
  recentFilings: SecFiling[];
  riskFactors: SecRiskFactor[];
  digitalTransformationStage: 'early' | 'mid' | 'advanced' | 'unknown';
  fetchedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

// Ticker to CIK mapping for common retail companies
const TICKER_CIK_MAP: Record<string, string> = {
  // Retail
  'WMT': '0000104169',
  'TGT': '0000027419',
  'COST': '0000909832',
  'HD': '0000354950',
  'LOW': '0000060667',
  'BBY': '0000764478',

  // Fashion & Apparel
  'NKE': '0000320187',
  'LULU': '0001397187',
  'GPS': '0000039911',
  'ANF': '0001018840',
  'AEO': '0000919012',
  'URBN': '0000912615',

  // Luxury
  'TPR': '0001116132', // Tapestry (Coach)
  'CPRI': '0001530721', // Capri (Michael Kors)

  // Home & Furniture
  'W': '0001616707', // Wayfair
  'WSM': '0000719955', // Williams-Sonoma
  'RH': '0001528849',

  // Beauty
  'ULTA': '0001469229',
  'ELF': '0001600033',
  'EL': '0001001250',

  // Auto Parts
  'AZO': '0000866787',
  'ORLY': '0000898173',
  'AAP': '0001158449',

  // Pet
  'CHWY': '0001766502',
  'WOOF': '0001826470',

  // E-commerce
  'AMZN': '0001018724',
  'SHOP': '0001594805',
  'EBAY': '0001065088',

  // Luxury Resale
  'REAL': '0001573221', // The RealReal
  'POSH': '0001825155',
  'TDUP': '0001737339',

  // Tech
  'AAPL': '0000320193',
  'GOOGL': '0001652044',
  'MSFT': '0000789019',
  'META': '0001326801',
  'CRM': '0001108524',
  'ADBE': '0000796343',

  // Dollar Stores
  'DG': '0000029534',
  'DLTR': '0000935703',

  // Sporting Goods
  'DKS': '0001089063',
  'FL': '0000850209',
};

// Risk factor categories with Algolia relevance
const RISK_CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  category: SecRiskFactor['category'];
  relevance: SecRiskFactor['relevanceToAlgolia'];
}> = [
  // High relevance to Algolia
  { pattern: /technology|system|software|platform|digital|cyber|data|IT infrastructure/i, category: 'technology', relevance: 'high' },
  { pattern: /e-commerce|online|website|mobile|app|search|discovery/i, category: 'technology', relevance: 'high' },
  { pattern: /customer experience|user experience|conversion|engagement/i, category: 'operational', relevance: 'high' },

  // Medium relevance
  { pattern: /competition|competitive|market share|pricing pressure/i, category: 'competition', relevance: 'medium' },
  { pattern: /customer acquisition|customer retention|brand/i, category: 'market', relevance: 'medium' },
  { pattern: /supply chain|inventory|logistics|fulfillment/i, category: 'operational', relevance: 'medium' },

  // Low relevance
  { pattern: /regulatory|compliance|legal|litigation/i, category: 'regulatory', relevance: 'low' },
  { pattern: /debt|credit|liquidity|interest rate/i, category: 'financial', relevance: 'low' },
  { pattern: /macroeconomic|recession|inflation/i, category: 'market', relevance: 'low' },
];

// Digital transformation keywords
const DIGITAL_KEYWORDS = [
  'digital transformation', 'digital strategy', 'digital initiatives',
  'e-commerce', 'ecommerce', 'online sales', 'direct-to-consumer', 'D2C', 'DTC',
  'omnichannel', 'omni-channel', 'unified commerce',
  'mobile app', 'mobile commerce', 'mcommerce',
  'personalization', 'AI', 'artificial intelligence', 'machine learning',
  'customer experience', 'CX', 'user experience', 'UX',
  'technology investment', 'IT modernization', 'cloud',
];

const SEARCH_KEYWORDS = [
  'search', 'site search', 'product search', 'search functionality',
  'discovery', 'product discovery', 'findability',
  'relevance', 'search relevance', 'search results',
  'recommendations', 'product recommendations',
  'browse', 'navigation', 'filtering', 'faceted search',
];

// ============================================================================
// SEC EDGAR Client Class
// ============================================================================

export class SecEdgarClient {
  private baseUrl = 'https://data.sec.gov';
  private archivesUrl = 'https://www.sec.gov/Archives/edgar/data';
  private searchUrl = 'https://efts.sec.gov/LATEST/search-index';

  private headers = {
    'User-Agent': 'PartnerForge/1.0 (contact@algolia.com)',
    'Accept': 'application/json',
  };

  // Rate limiting
  private lastRequestTime = 0;
  private minRequestInterval = 100; // 100ms = 10 requests/second max

  // -------------------------------------------------------------------------
  // Rate Limiting
  // -------------------------------------------------------------------------

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  // -------------------------------------------------------------------------
  // CIK Resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve a ticker symbol to CIK
   */
  async resolveCik(ticker: string): Promise<string | null> {
    const upperTicker = ticker.toUpperCase();

    // Check static mapping first
    if (TICKER_CIK_MAP[upperTicker]) {
      return TICKER_CIK_MAP[upperTicker];
    }

    // Try SEC company tickers endpoint
    try {
      await this.rateLimit();
      const response = await fetch(`${this.baseUrl}/submissions/company_tickers.json`, {
        headers: this.headers,
      });

      if (!response.ok) return null;

      const data = await response.json();
      // Format: { "0": { "cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc." }, ... }
      for (const key of Object.keys(data)) {
        if (data[key].ticker === upperTicker) {
          return String(data[key].cik_str).padStart(10, '0');
        }
      }
    } catch (error) {
      console.error('Error resolving CIK:', error);
    }

    return null;
  }

  /**
   * Resolve a domain to CIK (via ticker)
   */
  async resolveCikFromDomain(domain: string): Promise<string | null> {
    // Import ticker map from Yahoo Finance client
    const domainTickerMap: Record<string, string> = {
      'walmart.com': 'WMT',
      'target.com': 'TGT',
      'costco.com': 'COST',
      'homedepot.com': 'HD',
      'lowes.com': 'LOW',
      'bestbuy.com': 'BBY',
      'nike.com': 'NKE',
      'lululemon.com': 'LULU',
      'gap.com': 'GPS',
      'coach.com': 'TPR',
      'tapestry.com': 'TPR',
      'wayfair.com': 'W',
      'williams-sonoma.com': 'WSM',
      'rh.com': 'RH',
      'ulta.com': 'ULTA',
      'autozone.com': 'AZO',
      'oreillyauto.com': 'ORLY',
      'chewy.com': 'CHWY',
      'amazon.com': 'AMZN',
      'therealreal.com': 'REAL',
      'dickssportinggoods.com': 'DKS',
    };

    const normalized = domain.toLowerCase().replace(/^www\./, '');
    const ticker = domainTickerMap[normalized];
    if (ticker) {
      return this.resolveCik(ticker);
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Company Information
  // -------------------------------------------------------------------------

  /**
   * Get company information and recent filings by CIK
   */
  async getCompanySubmissions(cik: string): Promise<{
    company: SecCompany;
    filings: SecFiling[];
  } | null> {
    try {
      await this.rateLimit();
      const paddedCik = cik.padStart(10, '0');
      const url = `${this.baseUrl}/submissions/CIK${paddedCik}.json`;

      const response = await fetch(url, {
        headers: this.headers,
      });

      if (!response.ok) {
        console.error(`SEC EDGAR error: ${response.status}`);
        return null;
      }

      const data = await response.json();

      const company: SecCompany = {
        cik: data.cik,
        cik_str: paddedCik,
        name: data.name,
        ticker: data.tickers?.[0],
        exchange: data.exchanges?.[0],
        sic: data.sic,
        sicDescription: data.sicDescription,
        stateOfIncorporation: data.stateOfIncorporation,
        fiscalYearEnd: data.fiscalYearEnd,
      };

      // Parse recent filings
      const recentFilings = data.filings?.recent || {};
      const filings: SecFiling[] = [];

      const accessionNumbers = recentFilings.accessionNumber || [];
      const filingDates = recentFilings.filingDate || [];
      const reportDates = recentFilings.reportDate || [];
      const forms = recentFilings.form || [];
      const primaryDocs = recentFilings.primaryDocument || [];
      const primaryDocDescs = recentFilings.primaryDocDescription || [];
      const fileNumbers = recentFilings.fileNumber || [];
      const filmNumbers = recentFilings.filmNumber || [];
      const items = recentFilings.items || [];
      const sizes = recentFilings.size || [];
      const isXBRLs = recentFilings.isXBRL || [];
      const isInlineXBRLs = recentFilings.isInlineXBRL || [];

      // Parse all filings to ensure we get 10-K and 10-Q (they may be after many Form 4s)
      for (let i = 0; i < accessionNumbers.length; i++) {
        const accession = accessionNumbers[i].replace(/-/g, '');
        filings.push({
          accessionNumber: accessionNumbers[i],
          filingDate: filingDates[i],
          reportDate: reportDates[i],
          form: forms[i],
          primaryDocument: primaryDocs[i],
          primaryDocDescription: primaryDocDescs[i] || '',
          fileNumber: fileNumbers[i],
          filmNumber: filmNumbers[i],
          items: items[i],
          size: sizes[i],
          isXBRL: isXBRLs[i] === 1,
          isInlineXBRL: isInlineXBRLs[i] === 1,
          url: `${this.archivesUrl}/${data.cik}/${accession}/${primaryDocs[i]}`,
        });
      }

      return { company, filings };
    } catch (error) {
      console.error('Error fetching company submissions:', error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Filing Retrieval
  // -------------------------------------------------------------------------

  /**
   * Get filings by type (10-K, 10-Q, 8-K)
   */
  async getFilingsByType(
    cik: string,
    formType: '10-K' | '10-Q' | '8-K',
    limit: number = 5
  ): Promise<SecFiling[]> {
    const submissions = await this.getCompanySubmissions(cik);
    if (!submissions) return [];

    return submissions.filings
      .filter(f => f.form === formType)
      .slice(0, limit);
  }

  /**
   * Get most recent 10-K filing
   */
  async getMostRecent10K(cik: string): Promise<SecFiling | null> {
    const filings = await this.getFilingsByType(cik, '10-K', 1);
    return filings[0] || null;
  }

  /**
   * Get most recent 10-Q filing
   */
  async getMostRecent10Q(cik: string): Promise<SecFiling | null> {
    const filings = await this.getFilingsByType(cik, '10-Q', 1);
    return filings[0] || null;
  }

  /**
   * Get recent 8-K filings
   */
  async getRecent8Ks(cik: string, limit: number = 5): Promise<SecFiling[]> {
    return this.getFilingsByType(cik, '8-K', limit);
  }

  // -------------------------------------------------------------------------
  // 10-K Analysis
  // -------------------------------------------------------------------------

  /**
   * Fetch and parse 10-K filing for key information
   */
  async analyze10K(filing: SecFiling, company: SecCompany): Promise<Sec10KData> {
    const data: Sec10KData = {
      accessionNumber: filing.accessionNumber,
      filingDate: filing.filingDate,
      fiscalYearEnd: company.fiscalYearEnd || '',
      company,
      riskFactors: [],
      mdaHighlights: [],
      keyMetrics: [],
      digitalMentions: [],
      searchMentions: [],
      documentUrl: filing.url,
    };

    try {
      // Fetch the filing document
      await this.rateLimit();
      const response = await fetch(filing.url, {
        headers: {
          ...this.headers,
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        console.warn(`Could not fetch 10-K document: ${response.status}`);
        return data;
      }

      const html = await response.text();

      // Extract risk factors
      data.riskFactors = this.extractRiskFactors(html);

      // Extract MD&A highlights
      data.mdaHighlights = this.extractMdaHighlights(html);

      // Extract digital/search mentions
      data.digitalMentions = this.extractKeywordMentions(html, DIGITAL_KEYWORDS);
      data.searchMentions = this.extractKeywordMentions(html, SEARCH_KEYWORDS);

    } catch (error) {
      console.error('Error analyzing 10-K:', error);
    }

    return data;
  }

  /**
   * Extract risk factors from 10-K HTML
   */
  private extractRiskFactors(html: string): SecRiskFactor[] {
    const riskFactors: SecRiskFactor[] = [];

    // Look for Item 1A section
    const item1AMatch = html.match(/Item\s*1A[.\s]*Risk\s*Factors([\s\S]*?)(?=Item\s*1B|Item\s*2|<\/body)/i);
    if (!item1AMatch) return riskFactors;

    const riskSection = item1AMatch[1];

    // Extract individual risk factor headers (typically bold or larger text)
    const riskHeaders = riskSection.match(/<b[^>]*>([^<]+)<\/b>|<strong[^>]*>([^<]+)<\/strong>|<p[^>]*style="[^"]*font-weight:\s*bold[^"]*"[^>]*>([^<]+)<\/p>/gi);

    if (riskHeaders) {
      for (const header of riskHeaders.slice(0, 20)) { // Limit to 20 risk factors
        const titleMatch = header.match(/>([^<]+)</);
        if (!titleMatch) continue;

        const title = titleMatch[1].trim();
        if (title.length < 10 || title.length > 500) continue; // Skip too short or too long

        // Categorize the risk factor
        let category: SecRiskFactor['category'] = 'other';
        let relevance: SecRiskFactor['relevanceToAlgolia'] = 'low';

        for (const pattern of RISK_CATEGORY_PATTERNS) {
          if (pattern.pattern.test(title)) {
            category = pattern.category;
            relevance = pattern.relevance;
            break;
          }
        }

        riskFactors.push({
          title: title.substring(0, 200), // Truncate long titles
          summary: title,
          category,
          relevanceToAlgolia: relevance,
        });
      }
    }

    return riskFactors;
  }

  /**
   * Extract MD&A highlights from 10-K HTML
   */
  private extractMdaHighlights(html: string): string[] {
    const highlights: string[] = [];

    // Look for Item 7 section
    const item7Match = html.match(/Item\s*7[.\s]*Management['']?s?\s*Discussion([\s\S]*?)(?=Item\s*7A|Item\s*8|<\/body)/i);
    if (!item7Match) return highlights;

    const mdaSection = item7Match[1];

    // Extract key sentences mentioning important business metrics
    const importantPatterns = [
      /revenue\s+(?:increased|decreased|grew|declined)[^.]+\./gi,
      /net\s+(?:income|sales)[^.]+\./gi,
      /(?:digital|e-commerce|online)\s+sales[^.]+\./gi,
      /customer\s+(?:acquisition|retention|experience)[^.]+\./gi,
      /(?:invested|investing|investment)\s+in\s+technology[^.]+\./gi,
    ];

    for (const pattern of importantPatterns) {
      const matches = mdaSection.match(pattern);
      if (matches) {
        for (const match of matches.slice(0, 3)) {
          const cleaned = match.replace(/<[^>]+>/g, '').trim();
          if (cleaned.length > 20 && cleaned.length < 500) {
            highlights.push(cleaned);
          }
        }
      }
    }

    return highlights.slice(0, 10);
  }

  /**
   * Extract keyword mentions from HTML
   */
  private extractKeywordMentions(html: string, keywords: string[]): string[] {
    const mentions: string[] = [];
    const plainText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    for (const keyword of keywords) {
      const regex = new RegExp(`[^.]*\\b${keyword}\\b[^.]*\\.`, 'gi');
      const matches = plainText.match(regex);
      if (matches) {
        for (const match of matches.slice(0, 2)) {
          const cleaned = match.trim();
          if (cleaned.length > 30 && cleaned.length < 500) {
            mentions.push(cleaned);
          }
        }
      }
    }

    return [...new Set(mentions)].slice(0, 15);
  }

  // -------------------------------------------------------------------------
  // 10-Q Analysis
  // -------------------------------------------------------------------------

  /**
   * Fetch and parse 10-Q filing
   */
  async analyze10Q(filing: SecFiling, company: SecCompany): Promise<Sec10QData> {
    // Determine fiscal quarter from filing date
    const filingMonth = new Date(filing.filingDate).getMonth();
    let quarter = 'Q1';
    if (filingMonth >= 6 && filingMonth < 9) quarter = 'Q2';
    else if (filingMonth >= 9) quarter = 'Q3';
    else if (filingMonth >= 3 && filingMonth < 6) quarter = 'Q1';

    const data: Sec10QData = {
      accessionNumber: filing.accessionNumber,
      filingDate: filing.filingDate,
      fiscalQuarter: quarter,
      fiscalYear: new Date(filing.filingDate).getFullYear(),
      company,
      mdaHighlights: [],
      riskUpdates: [],
      digitalMentions: [],
      documentUrl: filing.url,
    };

    try {
      await this.rateLimit();
      const response = await fetch(filing.url, {
        headers: {
          ...this.headers,
          'Accept': 'text/html',
        },
      });

      if (!response.ok) return data;

      const html = await response.text();

      // Extract MD&A highlights
      data.mdaHighlights = this.extractMdaHighlights(html);

      // Extract digital mentions
      data.digitalMentions = this.extractKeywordMentions(html, DIGITAL_KEYWORDS);

    } catch (error) {
      console.error('Error analyzing 10-Q:', error);
    }

    return data;
  }

  // -------------------------------------------------------------------------
  // Full Data Aggregation
  // -------------------------------------------------------------------------

  /**
   * Get full SEC data for a company by ticker
   */
  async getFullDataByTicker(ticker: string): Promise<SecFullData | null> {
    const cik = await this.resolveCik(ticker);
    if (!cik) {
      console.log(`No CIK found for ticker: ${ticker}`);
      return null;
    }

    return this.getFullData(cik);
  }

  /**
   * Get full SEC data for a company by domain
   */
  async getFullDataByDomain(domain: string): Promise<SecFullData | null> {
    const cik = await this.resolveCikFromDomain(domain);
    if (!cik) {
      console.log(`No CIK found for domain: ${domain}`);
      return null;
    }

    return this.getFullData(cik);
  }

  /**
   * Get full SEC data for a company by CIK
   */
  async getFullData(cik: string): Promise<SecFullData | null> {
    const submissions = await this.getCompanySubmissions(cik);
    if (!submissions) return null;

    const { company, filings } = submissions;

    // Get recent filings by type
    const tenKFilings = filings.filter(f => f.form === '10-K').slice(0, 3);
    const tenQFilings = filings.filter(f => f.form === '10-Q').slice(0, 4);
    const eightKFilings = filings.filter(f => f.form === '8-K').slice(0, 5);

    // Analyze most recent 10-K
    const tenKAnalyses: Sec10KData[] = [];
    if (tenKFilings.length > 0) {
      const analysis = await this.analyze10K(tenKFilings[0], company);
      tenKAnalyses.push(analysis);
    }

    // Analyze recent 10-Qs
    const tenQAnalyses: Sec10QData[] = [];
    for (const filing of tenQFilings.slice(0, 2)) {
      const analysis = await this.analyze10Q(filing, company);
      tenQAnalyses.push(analysis);
    }

    // Aggregate risk factors from 10-K
    const allRiskFactors = tenKAnalyses.flatMap(a => a.riskFactors);

    // Determine digital transformation stage
    const digitalMentionCount = tenKAnalyses.reduce((sum, a) => sum + a.digitalMentions.length, 0);
    const searchMentionCount = tenKAnalyses.reduce((sum, a) => sum + a.searchMentions.length, 0);
    const totalMentions = digitalMentionCount + searchMentionCount;

    let digitalStage: SecFullData['digitalTransformationStage'] = 'unknown';
    if (totalMentions >= 20) digitalStage = 'advanced';
    else if (totalMentions >= 10) digitalStage = 'mid';
    else if (totalMentions >= 3) digitalStage = 'early';

    return {
      company,
      filings: {
        tenK: tenKAnalyses,
        tenQ: tenQAnalyses,
        eightK: [], // 8-K analysis not implemented yet
      },
      recentFilings: filings.slice(0, 20),
      riskFactors: allRiskFactors,
      digitalTransformationStage: digitalStage,
      fetchedAt: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Convenience Methods
  // -------------------------------------------------------------------------

  /**
   * Get high-relevance risk factors only
   */
  async getHighRelevanceRisks(cik: string): Promise<SecRiskFactor[]> {
    const data = await this.getFullData(cik);
    if (!data) return [];

    return data.riskFactors.filter(r => r.relevanceToAlgolia === 'high');
  }

  /**
   * Check if company has recent filings (within last year)
   */
  async hasRecentFilings(cik: string): Promise<boolean> {
    const submissions = await this.getCompanySubmissions(cik);
    if (!submissions || submissions.filings.length === 0) return false;

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const mostRecent = new Date(submissions.filings[0].filingDate);
    return mostRecent > oneYearAgo;
  }

  /**
   * Get filing URLs for a company
   */
  async getFilingUrls(cik: string, formType: '10-K' | '10-Q' | '8-K', limit: number = 3): Promise<string[]> {
    const filings = await this.getFilingsByType(cik, formType, limit);
    return filings.map(f => f.url);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const secEdgarClient = new SecEdgarClient();
