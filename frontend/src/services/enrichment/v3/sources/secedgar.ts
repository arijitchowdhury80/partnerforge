/**
 * SEC EDGAR Source Module
 *
 * Provides: SEC filings, risk factors, digital/search mentions
 * API: SEC EDGAR public API (free, no key needed)
 */

import type { SourceModule, SourceResult, SecEdgarData, SourceOptions } from '../types';

const BASE_URL = 'https://data.sec.gov';

// Common ticker to CIK mapping
const TICKER_CIK_MAP: Record<string, string> = {
  'WMT': '0000104169', 'TGT': '0000027419', 'COST': '0000909832',
  'HD': '0000354950', 'LOW': '0000060667', 'BBY': '0000764478',
  'M': '0000794367', 'JWN': '0000072333', 'KSS': '0000885639',
  'GPS': '0000039911', 'NKE': '0000320187', 'LULU': '0001397187',
  'TPR': '0001116132', 'CPRI': '0001530721',
  'W': '0001616707', 'WSM': '0000719955', 'RH': '0001528849',
  'ULTA': '0001403568', 'ELF': '0001640147',
  'AZO': '0000866787', 'ORLY': '0000898173', 'AAP': '0001158449',
  'CHWY': '0001766502', 'WOOF': '0001826470',
  'KR': '0000056873', 'ACI': '0001646972',
  'REAL': '0001573221', 'POSH': '0001825155', 'TDUP': '0001815529',
  'DKS': '0001089063', 'FL': '0000850209',
  'AMZN': '0001018724', 'AAPL': '0000320193', 'SHOP': '0001594805',
};

// Keywords indicating Algolia-relevant risk factors
const ALGOLIA_RELEVANT_KEYWORDS = [
  'search', 'discovery', 'findability', 'browse', 'navigation',
  'digital', 'e-commerce', 'ecommerce', 'online', 'website',
  'customer experience', 'conversion', 'personalization',
  'technology', 'infrastructure', 'platform', 'system',
];

function categorizeRelevance(text: string): 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  const searchTerms = ['search', 'discovery', 'findability', 'browse'];
  const digitalTerms = ['e-commerce', 'ecommerce', 'digital', 'online'];

  if (searchTerms.some(t => lower.includes(t))) return 'high';
  if (digitalTerms.some(t => lower.includes(t))) return 'medium';
  return 'low';
}

export const secedgar: SourceModule<SecEdgarData> = {
  id: 'secedgar',
  name: 'SEC EDGAR',

  // Always available - no API key needed
  isAvailable: () => true,

  async enrich(domain: string, options?: SourceOptions): Promise<SourceResult<SecEdgarData>> {
    const startTime = Date.now();

    const ticker = options?.ticker;
    if (!ticker) {
      return {
        source: 'secedgar',
        success: false,
        data: null,
        error: 'Ticker required for SEC EDGAR lookup',
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }

    const cik = TICKER_CIK_MAP[ticker.toUpperCase()];
    if (!cik) {
      return {
        source: 'secedgar',
        success: false,
        data: null,
        error: `No CIK mapping for ticker ${ticker}`,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }

    try {
      // Fetch company submissions (includes recent filings)
      const url = `${BASE_URL}/submissions/CIK${cik}.json`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'PartnerForge/1.0 (support@algolia.com)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const raw = await response.json();
      const recent = raw.filings?.recent || {};

      // Extract filings
      const filings: SecEdgarData['filings'] = [];
      const forms = recent.form || [];
      const dates = recent.filingDate || [];
      const accessions = recent.accessionNumber || [];

      for (let i = 0; i < Math.min(forms.length, 10); i++) {
        const form = forms[i];
        if (['10-K', '10-Q', '8-K'].includes(form)) {
          filings.push({
            type: form as '10-K' | '10-Q' | '8-K',
            date: dates[i] || '',
            url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${form}`,
          });
        }
      }

      // Note: Full risk factor extraction would require fetching the actual filing documents
      // For now, we return the basic filing info
      const data: SecEdgarData = {
        cik,
        ticker,
        company_name: raw.name || options?.companyName || ticker,
        filings,
        risk_factors: [], // Would need to parse actual 10-K for this
        digital_mentions: [],
        search_mentions: [],
      };

      console.log(`[SEC EDGAR] ${ticker}: ${filings.length} filings found (${Date.now() - startTime}ms)`);

      return {
        source: 'secedgar',
        success: true,
        data,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[SEC EDGAR] ${ticker}: ${error}`);

      return {
        source: 'secedgar',
        success: false,
        data: null,
        error,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }
  },
};

export default secedgar;
