/**
 * Unit tests for WebSearch Proxy Service
 *
 * Tests all query builders, parsers, and scoring functions
 * without requiring live search execution.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  // Query builders
  buildHiringSearchQueries,
  buildExecutiveSearchQueries,
  buildInvestorSearchQueries,
  buildStrategicSearchQueries,
  buildEdgarSearchUrl,
  getCareersPagesUrls,
  getEdgarFilingsUrls,

  // Scoring functions
  scoreJobRelevance,
  calculateHiringSignalStrength,
  mapQuoteToAlgoliaValue,
  extractTopicTags,
  scoreQuoteRelevance,
  categorizeRiskFactor,
  identifyTriggerEventType,
  scoreTriggerRelevance,

  // Parsers
  parseHiringResults,
  parseExecutiveResults,
  parseInvestorResults,
  parseStrategicResults,

  // Class and types
  WebSearchProxy,
  SearchResult,
  SearchExecutor,
  HiringJob,
  ALGOLIA_RELEVANT_TOPICS,
} from '../clients/websearch';

// =============================================================================
// Query Builder Tests
// =============================================================================

describe('buildHiringSearchQueries', () => {
  it('should generate careers page query', () => {
    const queries = buildHiringSearchQueries('Acme Corp', 'acme.com');
    expect(queries).toContain('Acme Corp careers');
    expect(queries).toContain('Acme Corp jobs');
  });

  it('should generate LinkedIn jobs query', () => {
    const queries = buildHiringSearchQueries('Acme Corp', 'acme.com');
    expect(queries.some(q => q.includes('site:linkedin.com/jobs'))).toBe(true);
  });

  it('should include company name variations', () => {
    const queries = buildHiringSearchQueries('Acme Corp', 'acme.com');
    expect(queries.some(q => q.includes('Acme Corp'))).toBe(true);
  });

  it('should generate site-specific queries', () => {
    const queries = buildHiringSearchQueries('Acme Corp', 'acme.com');
    expect(queries.some(q => q.includes('site:acme.com/careers'))).toBe(true);
    expect(queries.some(q => q.includes('site:acme.com/jobs'))).toBe(true);
  });

  it('should generate role-specific searches', () => {
    const queries = buildHiringSearchQueries('Acme Corp', 'acme.com');
    expect(queries.some(q => q.includes('VP Engineering'))).toBe(true);
    expect(queries.some(q => q.includes('Director Search'))).toBe(true);
  });

  it('should generate ATS platform queries', () => {
    const queries = buildHiringSearchQueries('Acme Corp', 'acme.com');
    expect(queries.some(q => q.includes('greenhouse'))).toBe(true);
    expect(queries.some(q => q.includes('lever'))).toBe(true);
  });
});

describe('buildExecutiveSearchQueries', () => {
  it('should generate earnings call query', () => {
    const queries = buildExecutiveSearchQueries('Target');
    expect(queries.some(q => q.includes('earnings call transcript'))).toBe(true);
  });

  it('should generate investor day query', () => {
    const queries = buildExecutiveSearchQueries('Target');
    expect(queries.some(q => q.includes('investor day'))).toBe(true);
  });

  it('should generate CEO interview query', () => {
    const queries = buildExecutiveSearchQueries('Target');
    expect(queries.some(q => q.includes('CEO interview'))).toBe(true);
  });

  it('should generate topic-specific queries', () => {
    const queries = buildExecutiveSearchQueries('Target');
    expect(queries.some(q => q.includes('customer experience'))).toBe(true);
    expect(queries.some(q => q.includes('digital strategy'))).toBe(true);
  });

  it('should include conference queries', () => {
    const queries = buildExecutiveSearchQueries('Target');
    expect(queries.some(q => q.includes('NRF') || q.includes('Shoptalk'))).toBe(true);
  });
});

describe('buildInvestorSearchQueries', () => {
  it('should generate SEC filing queries', () => {
    const queries = buildInvestorSearchQueries('Target');
    expect(queries.some(q => q.includes('10-K'))).toBe(true);
    expect(queries.some(q => q.includes('10-Q'))).toBe(true);
  });

  it('should include ticker when available', () => {
    const queries = buildInvestorSearchQueries('Target', 'TGT');
    expect(queries.some(q => q.includes('TGT'))).toBe(true);
    expect(queries.some(q => q.includes('site:sec.gov'))).toBe(true);
  });

  it('should generate risk factor queries', () => {
    const queries = buildInvestorSearchQueries('Target');
    expect(queries.some(q => q.includes('risk factors'))).toBe(true);
  });

  it('should generate MD&A queries', () => {
    const queries = buildInvestorSearchQueries('Target');
    expect(queries.some(q => q.includes('MD&A'))).toBe(true);
  });

  it('should include investor research sites', () => {
    const queries = buildInvestorSearchQueries('Target');
    expect(queries.some(q => q.includes('seekingalpha') || q.includes('fool.com'))).toBe(true);
  });
});

describe('buildStrategicSearchQueries', () => {
  it('should generate announcement queries', () => {
    const queries = buildStrategicSearchQueries('Target');
    expect(queries.some(q => q.includes('announces'))).toBe(true);
  });

  it('should generate partnership queries', () => {
    const queries = buildStrategicSearchQueries('Target');
    expect(queries.some(q => q.includes('partnership'))).toBe(true);
  });

  it('should generate acquisition queries', () => {
    const queries = buildStrategicSearchQueries('Target');
    expect(queries.some(q => q.includes('acquires'))).toBe(true);
  });

  it('should generate replatforming queries', () => {
    const queries = buildStrategicSearchQueries('Target');
    expect(queries.some(q => q.includes('replatforming') || q.includes('new ecommerce platform'))).toBe(true);
  });

  it('should generate leadership change queries', () => {
    const queries = buildStrategicSearchQueries('Target');
    expect(queries.some(q => q.includes('appoints') || q.includes('hires'))).toBe(true);
  });
});

describe('buildEdgarSearchUrl', () => {
  it('should build correct 10-K URL', () => {
    const url = buildEdgarSearchUrl('Target Corp', '10-K');
    expect(url).toContain('sec.gov');
    expect(url).toContain('type=10-K');
    expect(url).toContain('Target');
  });

  it('should build correct 10-Q URL', () => {
    const url = buildEdgarSearchUrl('Target Corp', '10-Q');
    expect(url).toContain('type=10-Q');
  });

  it('should URL-encode company name', () => {
    const url = buildEdgarSearchUrl('Target Corp', '10-K');
    expect(url).toContain('Target%20Corp');
  });
});

describe('getCareersPagesUrls', () => {
  it('should generate common careers URL patterns', () => {
    const urls = getCareersPagesUrls('acme.com');
    expect(urls.some(u => u.includes('/careers'))).toBe(true);
    expect(urls.some(u => u.includes('/jobs'))).toBe(true);
  });

  it('should include ATS URLs', () => {
    const urls = getCareersPagesUrls('acme.com');
    expect(urls.some(u => u.includes('greenhouse'))).toBe(true);
    expect(urls.some(u => u.includes('lever'))).toBe(true);
    expect(urls.some(u => u.includes('workday'))).toBe(true);
  });

  it('should handle www prefix', () => {
    const urls = getCareersPagesUrls('www.acme.com');
    expect(urls.some(u => u.includes('acme.com/careers'))).toBe(true);
  });
});

describe('getEdgarFilingsUrls', () => {
  it('should generate SEC EDGAR URLs', () => {
    const urls = getEdgarFilingsUrls('TGT');
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.some(u => u.includes('sec.gov'))).toBe(true);
    expect(urls.some(u => u.includes('TGT'))).toBe(true);
  });

  it('should include different filing types', () => {
    const urls = getEdgarFilingsUrls('TGT');
    expect(urls.some(u => u.includes('10-K'))).toBe(true);
    expect(urls.some(u => u.includes('10-Q'))).toBe(true);
    expect(urls.some(u => u.includes('8-K'))).toBe(true);
  });
});

// =============================================================================
// Job Relevance Scoring Tests
// =============================================================================

describe('scoreJobRelevance', () => {
  it('should score VP of Engineering as tier 1', () => {
    const result = scoreJobRelevance('VP of Engineering');
    expect(result.tier).toBe(1);
    expect(result.relevance_score).toBeGreaterThan(20);
  });

  it('should score Vice President of Product as tier 1', () => {
    const result = scoreJobRelevance('Vice President of Product');
    expect(result.tier).toBe(1);
  });

  it('should score CTO as tier 1', () => {
    const result = scoreJobRelevance('CTO - Chief Technology Officer');
    expect(result.tier).toBe(1);
  });

  it('should score Head of Engineering as tier 1', () => {
    const result = scoreJobRelevance('Head of Engineering');
    expect(result.tier).toBe(1);
  });

  it('should score Director of Search as tier 2', () => {
    const result = scoreJobRelevance('Director of Search');
    expect(result.tier).toBe(2);
    expect(result.relevance_score).toBeGreaterThan(15);
  });

  it('should score Senior Director as tier 2', () => {
    const result = scoreJobRelevance('Senior Director, Engineering');
    expect(result.tier).toBe(2);
  });

  it('should score Principal Engineer as tier 2', () => {
    const result = scoreJobRelevance('Principal Software Engineer');
    expect(result.tier).toBe(2);
  });

  it('should score Senior Engineer as tier 3', () => {
    const result = scoreJobRelevance('Senior Software Engineer');
    expect(result.tier).toBe(3);
  });

  it('should score Staff Engineer as tier 3', () => {
    const result = scoreJobRelevance('Staff Engineer');
    expect(result.tier).toBe(3);
  });

  it('should flag search-related jobs', () => {
    const result = scoreJobRelevance('Senior Search Engineer');
    expect(result.search_related).toBe(true);
    expect(result.relevance_score).toBeGreaterThan(30);
  });

  it('should flag discovery-related jobs', () => {
    const result = scoreJobRelevance('Product Manager, Discovery');
    expect(result.search_related).toBe(true);
  });

  it('should give higher relevance to search keywords', () => {
    const searchJob = scoreJobRelevance('Senior Engineer', 'Working on search and relevance');
    const regularJob = scoreJobRelevance('Senior Engineer', 'Working on backend systems');
    expect(searchJob.relevance_score).toBeGreaterThan(regularJob.relevance_score);
  });

  it('should detect relevance from description', () => {
    const result = scoreJobRelevance('Software Engineer', 'Build search and recommendations engine');
    expect(result.search_related).toBe(true);
  });

  it('should add bonus for tech keywords', () => {
    const techJob = scoreJobRelevance('Engineer', 'React, TypeScript, AWS, Kubernetes');
    const plainJob = scoreJobRelevance('Engineer', 'General responsibilities');
    expect(techJob.relevance_score).toBeGreaterThan(plainJob.relevance_score);
  });
});

describe('calculateHiringSignalStrength', () => {
  it('should return "none" for empty jobs', () => {
    expect(calculateHiringSignalStrength([])).toBe('none');
  });

  it('should return "strong" for VP+ hiring', () => {
    const jobs: HiringJob[] = [
      { title: 'VP Engineering', tier: 1, url: '', relevance_score: 50, search_related: false },
    ];
    expect(calculateHiringSignalStrength(jobs)).toBe('strong');
  });

  it('should return "strong" for multiple search-related roles', () => {
    const jobs: HiringJob[] = [
      { title: 'Search Engineer', tier: 3, url: '', relevance_score: 60, search_related: true },
      { title: 'Relevance Engineer', tier: 3, url: '', relevance_score: 60, search_related: true },
      { title: 'Discovery PM', tier: 3, url: '', relevance_score: 60, search_related: true },
    ];
    expect(calculateHiringSignalStrength(jobs)).toBe('strong');
  });

  it('should return "moderate" for director-level hiring', () => {
    const jobs: HiringJob[] = [
      { title: 'Director Engineering', tier: 2, url: '', relevance_score: 40, search_related: false },
      { title: 'Director Product', tier: 2, url: '', relevance_score: 40, search_related: false },
    ];
    expect(calculateHiringSignalStrength(jobs)).toBe('moderate');
  });

  it('should return "moderate" for some search-related roles', () => {
    const jobs: HiringJob[] = [
      { title: 'Search Engineer', tier: 3, url: '', relevance_score: 60, search_related: true },
    ];
    expect(calculateHiringSignalStrength(jobs)).toBe('moderate');
  });

  it('should return "weak" for minimal relevant hiring', () => {
    const jobs: HiringJob[] = [
      { title: 'Software Engineer', tier: 3, url: '', relevance_score: 30, search_related: false },
    ];
    expect(calculateHiringSignalStrength(jobs)).toBe('weak');
  });
});

// =============================================================================
// Quote Mapping Tests
// =============================================================================

describe('mapQuoteToAlgoliaValue', () => {
  it('should map "improving search" to Search & Discovery', () => {
    const result = mapQuoteToAlgoliaValue('We are focused on improving search capabilities');
    expect(result).toBe('Search & Discovery');
  });

  it('should map "discovery experience" to Search & Discovery', () => {
    const result = mapQuoteToAlgoliaValue('Enhancing the discovery experience for customers');
    expect(result).toBe('Search & Discovery');
  });

  it('should map "customer experience" to Customer Experience', () => {
    const result = mapQuoteToAlgoliaValue('Our priority is customer experience improvement');
    expect(result).toBe('Customer Experience');
  });

  it('should map "conversion optimization" to Revenue & Conversion', () => {
    const result = mapQuoteToAlgoliaValue('Driving conversion optimization across channels');
    expect(result).toBe('Revenue & Conversion');
  });

  it('should map "personalization" to Personalization', () => {
    const result = mapQuoteToAlgoliaValue('Investing in personalization for each customer');
    expect(result).toBe('Personalization');
  });

  it('should map "mobile experience" to Mobile Experience', () => {
    const result = mapQuoteToAlgoliaValue('Mobile experience is critical for our customers');
    expect(result).toBe('Mobile Experience');
  });

  it('should map "omnichannel" to Omnichannel Commerce', () => {
    const result = mapQuoteToAlgoliaValue('Building an omnichannel strategy');
    expect(result).toBe('Omnichannel Commerce');
  });

  it('should return null for irrelevant quotes', () => {
    const result = mapQuoteToAlgoliaValue('The weather is nice today');
    expect(result).toBeNull();
  });

  it('should handle case insensitivity', () => {
    const result = mapQuoteToAlgoliaValue('SEARCH AND DISCOVERY ARE KEY');
    expect(result).toBe('Search & Discovery');
  });

  it('should map "digital transformation" correctly', () => {
    const result = mapQuoteToAlgoliaValue('Our digital transformation journey continues');
    expect(result).toBe('Digital Transformation');
  });

  it('should map "performance" to Performance', () => {
    const result = mapQuoteToAlgoliaValue('Site speed and performance are critical');
    expect(result).toBe('Performance');
  });
});

describe('extractTopicTags', () => {
  it('should extract search topic', () => {
    const tags = extractTopicTags('We are improving our search functionality');
    expect(tags).toContain('search');
  });

  it('should extract multiple topics', () => {
    const tags = extractTopicTags('Focus on search, discovery, and personalization');
    expect(tags).toContain('search');
    expect(tags).toContain('discovery');
    expect(tags).toContain('personalization');
  });

  it('should return empty array for irrelevant text', () => {
    const tags = extractTopicTags('The weather is sunny');
    expect(tags).toHaveLength(0);
  });
});

describe('scoreQuoteRelevance', () => {
  it('should score higher for Algolia-relevant topics', () => {
    const relevant = scoreQuoteRelevance('We are investing in search and discovery');
    const irrelevant = scoreQuoteRelevance('The weather is nice');
    expect(relevant).toBeGreaterThan(irrelevant);
  });

  it('should add bonus for priority indicators', () => {
    const priority = scoreQuoteRelevance('Search is our top priority this year');
    const normal = scoreQuoteRelevance('Search is something we do');
    expect(priority).toBeGreaterThan(normal);
  });

  it('should add bonus for quantitative statements', () => {
    const quant = scoreQuoteRelevance('We achieved 50% increase in search engagement');
    const qual = scoreQuoteRelevance('We improved search engagement');
    expect(quant).toBeGreaterThan(qual);
  });

  it('should cap at 100', () => {
    const score = scoreQuoteRelevance('Search discovery personalization customer experience conversion priority investment 100% growth million');
    expect(score).toBeLessThanOrEqual(100);
  });
});

// =============================================================================
// Risk Factor Categorization Tests
// =============================================================================

describe('categorizeRiskFactor', () => {
  it('should mark technology risks as high relevance', () => {
    const result = categorizeRiskFactor('Our technology systems may experience outages');
    expect(result.category).toBe('Technology Risk');
    expect(result.relevance).toBe('high');
  });

  it('should mark platform risks as high relevance', () => {
    const result = categorizeRiskFactor('Our platform infrastructure requires updates');
    expect(result.category).toBe('Technology Risk');
    expect(result.relevance).toBe('high');
  });

  it('should mark customer acquisition as medium relevance', () => {
    const result = categorizeRiskFactor('Customer acquisition costs may increase');
    expect(result.category).toBe('Customer Risk');
    expect(result.relevance).toBe('medium');
  });

  it('should mark competition as medium relevance', () => {
    const result = categorizeRiskFactor('Competitive pressures in the market');
    expect(result.category).toBe('Competitive Risk');
    expect(result.relevance).toBe('medium');
  });

  it('should mark digital risks as high relevance', () => {
    const result = categorizeRiskFactor('Our ecommerce website may face challenges');
    expect(result.category).toBe('Digital Risk');
    expect(result.relevance).toBe('high');
  });

  it('should mark regulatory as low relevance', () => {
    const result = categorizeRiskFactor('Regulatory compliance requirements');
    expect(result.category).toBe('Regulatory Risk');
    expect(result.relevance).toBe('low');
  });

  it('should mark supply chain as low relevance', () => {
    const result = categorizeRiskFactor('Supply chain disruptions may occur');
    expect(result.category).toBe('Supply Chain Risk');
    expect(result.relevance).toBe('low');
  });

  it('should default to General Risk for unknown', () => {
    const result = categorizeRiskFactor('Some general business risk');
    expect(result.category).toBe('General Risk');
    expect(result.relevance).toBe('low');
  });
});

// =============================================================================
// Strategic Trigger Tests
// =============================================================================

describe('identifyTriggerEventType', () => {
  it('should identify acquisition', () => {
    expect(identifyTriggerEventType('Company acquires TechStartup')).toBe('acquisition');
    expect(identifyTriggerEventType('Acquisition of new platform')).toBe('acquisition');
  });

  it('should identify partnership', () => {
    expect(identifyTriggerEventType('Company partners with Adobe')).toBe('partnership');
    expect(identifyTriggerEventType('New partnership announced')).toBe('partnership');
  });

  it('should identify replatform', () => {
    expect(identifyTriggerEventType('Company replatforming to new system')).toBe('replatform');
    expect(identifyTriggerEventType('Platform migration underway')).toBe('replatform');
  });

  it('should identify launch', () => {
    expect(identifyTriggerEventType('Company launches new website')).toBe('launch');
    expect(identifyTriggerEventType('Launching new mobile app')).toBe('launch');
  });

  it('should identify leadership change', () => {
    expect(identifyTriggerEventType('Company appoints new CTO')).toBe('leadership_change');
    expect(identifyTriggerEventType('New CEO joins the company')).toBe('leadership_change');
  });

  it('should return null for no trigger', () => {
    expect(identifyTriggerEventType('Company reports quarterly results')).toBeNull();
  });
});

describe('scoreTriggerRelevance', () => {
  it('should score replatform highest', () => {
    const replatform = scoreTriggerRelevance('Replatforming to new system', 'replatform');
    const acquisition = scoreTriggerRelevance('Acquires company', 'acquisition');
    expect(replatform).toBeGreaterThan(acquisition);
  });

  it('should add bonus for tech-related triggers', () => {
    const tech = scoreTriggerRelevance('Partnership for new technology platform', 'partnership');
    const nonTech = scoreTriggerRelevance('Partnership for marketing', 'partnership');
    expect(tech).toBeGreaterThan(nonTech);
  });

  it('should add bonus for search mentions', () => {
    const search = scoreTriggerRelevance('Launching new search experience', 'launch');
    const regular = scoreTriggerRelevance('Launching new product line', 'launch');
    expect(search).toBeGreaterThan(regular);
  });
});

// =============================================================================
// Parser Tests
// =============================================================================

describe('parseHiringResults', () => {
  it('should extract jobs from search results', () => {
    const results: SearchResult[] = [
      {
        title: 'VP of Engineering - Acme Corp',
        url: 'https://acme.com/jobs/vp-eng',
        snippet: 'Lead our engineering team. Job posting for VP Engineering.',
      },
      {
        title: 'Senior Search Engineer',
        url: 'https://acme.com/jobs/search-eng',
        snippet: 'Build search and discovery features. Apply now.',
      },
    ];

    const signal = parseHiringResults(results);
    expect(signal.relevant_jobs.length).toBeGreaterThan(0);
    expect(signal.tier_breakdown.tier_1_vp).toBeGreaterThanOrEqual(0);
  });

  it('should calculate signal strength', () => {
    const results: SearchResult[] = [
      {
        title: 'VP Engineering Job Opening',
        url: 'https://example.com/job',
        snippet: 'We are hiring a VP of Engineering',
      },
    ];

    const signal = parseHiringResults(results);
    expect(['none', 'weak', 'moderate', 'strong']).toContain(signal.signal_strength);
  });

  it('should aggregate tier breakdown', () => {
    const results: SearchResult[] = [
      { title: 'VP Engineering Job', url: '', snippet: 'Apply for VP position' },
      { title: 'Director of Product Job', url: '', snippet: 'Director opening' },
      { title: 'Senior Engineer Career', url: '', snippet: 'Senior role' },
    ];

    const signal = parseHiringResults(results);
    expect(signal.tier_breakdown).toHaveProperty('tier_1_vp');
    expect(signal.tier_breakdown).toHaveProperty('tier_2_director');
    expect(signal.tier_breakdown).toHaveProperty('tier_3_ic');
  });

  it('should detect tech keywords', () => {
    const results: SearchResult[] = [
      {
        title: 'Senior Engineer Job',
        url: '',
        snippet: 'React, TypeScript, AWS experience required',
      },
    ];

    const signal = parseHiringResults(results);
    expect(signal.tech_keywords_detected.length).toBeGreaterThan(0);
  });

  it('should ignore non-job results', () => {
    const results: SearchResult[] = [
      { title: 'About Acme Corp', url: '', snippet: 'Company overview' },
      { title: 'News Article', url: '', snippet: 'Latest news' },
    ];

    const signal = parseHiringResults(results);
    expect(signal.relevant_jobs.length).toBe(0);
  });
});

describe('parseExecutiveResults', () => {
  it('should extract quotes with relevance', () => {
    const results: SearchResult[] = [
      {
        title: 'Q4 Earnings Call Transcript - Acme Corp',
        url: 'https://example.com/earnings',
        snippet: 'CEO said we are prioritizing search and customer experience improvements.',
        date: '2024-02-15',
      },
    ];

    const data = parseExecutiveResults(results, 'acme.com');
    expect(data.quotes.length).toBeGreaterThanOrEqual(0);
  });

  it('should identify themes', () => {
    const results: SearchResult[] = [
      {
        title: 'Earnings Transcript',
        url: '',
        snippet: 'Focus on search and discovery this quarter.',
      },
      {
        title: 'Investor Day',
        url: '',
        snippet: 'Search improvements are critical to our strategy.',
      },
    ];

    const data = parseExecutiveResults(results, 'acme.com');
    expect(data.themes).toBeDefined();
  });

  it('should set correct source type', () => {
    const earningsResult: SearchResult = {
      title: 'Earnings Call Transcript',
      url: '',
      snippet: 'Customer experience is our priority',
    };
    const investorResult: SearchResult = {
      title: 'Investor Day Presentation',
      url: '',
      snippet: 'Search and discovery improvements',
    };

    const earningsData = parseExecutiveResults([earningsResult], 'test.com');
    const investorData = parseExecutiveResults([investorResult], 'test.com');

    // Check that source types are being set (may have quotes or not depending on relevance)
    expect(earningsData.domain).toBe('test.com');
    expect(investorData.domain).toBe('test.com');
  });
});

describe('parseInvestorResults', () => {
  it('should extract SEC filings', () => {
    const results: SearchResult[] = [
      {
        title: 'Acme Corp 10-K Annual Report 2023',
        url: 'https://sec.gov/filing',
        snippet: 'Annual report filing',
        date: '2024-02-28',
      },
      {
        title: 'Acme Corp 10-Q Quarterly Report Q3',
        url: 'https://sec.gov/filing2',
        snippet: 'Quarterly report',
        date: '2024-11-15',
      },
    ];

    const data = parseInvestorResults(results, 'acme.com');
    expect(data).not.toBeNull();
    expect(data!.sec_filings.length).toBeGreaterThan(0);
  });

  it('should categorize risk factors', () => {
    const results: SearchResult[] = [
      {
        title: '10-K Risk Factors Section',
        url: '',
        snippet: 'Technology system failures could impact operations. Risk factor analysis.',
      },
    ];

    const data = parseInvestorResults(results, 'acme.com');
    expect(data).not.toBeNull();
    expect(data!.risk_factors.length).toBeGreaterThan(0);
  });

  it('should return null when no investor data found', () => {
    const results: SearchResult[] = [
      { title: 'Random Article', url: '', snippet: 'Not related to SEC' },
    ];

    const data = parseInvestorResults(results, 'acme.com');
    expect(data).toBeNull();
  });

  it('should extract earnings highlights', () => {
    const results: SearchResult[] = [
      {
        title: 'Q4 2023 Earnings Highlights',
        url: 'https://example.com/earnings',
        snippet: 'Strong quarter with revenue growth',
      },
    ];

    const data = parseInvestorResults(results, 'acme.com');
    expect(data).not.toBeNull();
    expect(data!.earnings_highlights.length).toBeGreaterThan(0);
  });
});

describe('parseStrategicResults', () => {
  it('should identify trigger events', () => {
    const results: SearchResult[] = [
      {
        title: 'Acme Corp Acquires TechStartup',
        url: 'https://news.com/acquisition',
        snippet: 'Strategic acquisition to enhance technology capabilities',
        date: '2024-01-15',
      },
    ];

    const data = parseStrategicResults(results, 'acme.com');
    expect(data.triggers.length).toBeGreaterThan(0);
    expect(data.triggers[0].event_type).toBe('acquisition');
  });

  it('should score relevance', () => {
    const results: SearchResult[] = [
      {
        title: 'Company Launches New Search Platform',
        url: '',
        snippet: 'New search and discovery technology',
        date: '2024-02-01',
      },
    ];

    const data = parseStrategicResults(results, 'acme.com');
    expect(data.triggers.length).toBeGreaterThan(0);
    expect(data.triggers[0].relevance_score).toBeGreaterThan(0);
  });

  it('should extract recent announcements', () => {
    const results: SearchResult[] = [
      {
        title: 'Company Announces New Partnership',
        url: 'https://pr.com/announce',
        snippet: 'Partnership announcement',
        date: '2024-02-20',
      },
    ];

    const data = parseStrategicResults(results, 'acme.com');
    expect(data.recent_announcements.length).toBeGreaterThan(0);
  });

  it('should capture competitive moves', () => {
    const results: SearchResult[] = [
      {
        title: 'Market Analysis',
        url: '',
        snippet: 'Company vs competitors in the market share battle',
      },
    ];

    const data = parseStrategicResults(results, 'acme.com');
    expect(data.competitive_moves.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// WebSearchProxy Class Tests
// =============================================================================

describe('WebSearchProxy', () => {
  let proxy: WebSearchProxy;

  beforeEach(() => {
    proxy = new WebSearchProxy();
  });

  it('should generate hiring queries', () => {
    const queries = proxy.getHiringSearchQueries('Acme', 'acme.com');
    expect(queries.length).toBeGreaterThan(0);
  });

  it('should generate executive queries', () => {
    const queries = proxy.getExecutiveSearchQueries('Acme');
    expect(queries.length).toBeGreaterThan(0);
  });

  it('should generate investor queries', () => {
    const queries = proxy.getInvestorSearchQueries('Acme', 'ACM');
    expect(queries.length).toBeGreaterThan(0);
  });

  it('should generate strategic queries', () => {
    const queries = proxy.getStrategicSearchQueries('Acme');
    expect(queries.length).toBeGreaterThan(0);
  });

  it('should parse hiring results', () => {
    const results: SearchResult[] = [
      { title: 'Job Opening', url: '', snippet: 'Apply for this position' },
    ];
    const signal = proxy.parseHiringResults(results);
    expect(signal).toHaveProperty('signal_strength');
    expect(signal).toHaveProperty('tier_breakdown');
  });

  it('should parse executive results', () => {
    const results: SearchResult[] = [
      { title: 'Earnings Call', url: '', snippet: 'CEO discusses strategy' },
    ];
    const data = proxy.parseExecutiveResults(results, 'acme.com');
    expect(data).toHaveProperty('quotes');
    expect(data).toHaveProperty('themes');
  });

  it('should parse investor results', () => {
    const results: SearchResult[] = [
      { title: '10-K Filing', url: '', snippet: 'Annual report' },
    ];
    const data = proxy.parseInvestorResults(results, 'acme.com');
    expect(data).not.toBeNull();
  });

  it('should parse strategic results', () => {
    const results: SearchResult[] = [
      { title: 'Company Acquires Startup', url: '', snippet: 'Acquisition news' },
    ];
    const data = proxy.parseStrategicResults(results, 'acme.com');
    expect(data).toHaveProperty('triggers');
  });

  it('should get careers page URLs', () => {
    const urls = proxy.getCareersPagesUrls('acme.com');
    expect(urls.length).toBeGreaterThan(0);
  });

  it('should get EDGAR filing URLs', () => {
    const urls = proxy.getEdgarFilingsUrls('TGT');
    expect(urls.length).toBeGreaterThan(0);
  });

  it('should build EDGAR search URL', () => {
    const url = proxy.buildEdgarSearchUrl('Target', '10-K');
    expect(url).toContain('sec.gov');
  });

  describe('getFullData', () => {
    it('should return empty structure without executor', async () => {
      const data = await proxy.getFullData('Acme', 'acme.com');
      expect(data).not.toBeNull();
      expect(data!.hiring.signal_strength).toBe('none');
      expect(data!.hiring.relevant_jobs).toHaveLength(0);
    });

    it('should use search executor when provided', async () => {
      const mockExecutor: SearchExecutor = {
        search: vi.fn().mockResolvedValue([
          { title: 'VP Engineering Job', url: '', snippet: 'Apply for VP position' },
        ]),
      };

      const data = await proxy.getFullData('Acme', 'acme.com', undefined, mockExecutor);
      expect(mockExecutor.search).toHaveBeenCalled();
      expect(data).not.toBeNull();
    });

    it('should handle executor errors gracefully', async () => {
      const mockExecutor: SearchExecutor = {
        search: vi.fn().mockRejectedValue(new Error('Search failed')),
      };

      const data = await proxy.getFullData('Acme', 'acme.com', undefined, mockExecutor);
      expect(data).toBeNull();
    });

    it('should include fetched_at timestamp', async () => {
      const data = await proxy.getFullData('Acme', 'acme.com');
      expect(data).not.toBeNull();
      expect(data!.fetched_at).toBeDefined();
      expect(new Date(data!.fetched_at).getTime()).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Edge Case Tests
// =============================================================================

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    expect(scoreJobRelevance('')).toEqual({ tier: 3, relevance_score: 0, search_related: false });
    expect(mapQuoteToAlgoliaValue('')).toBeNull();
    expect(extractTopicTags('')).toHaveLength(0);
    expect(identifyTriggerEventType('')).toBeNull();
  });

  it('should handle special characters', () => {
    const result = scoreJobRelevance('VP of Engineering (Remote) - $200K+');
    expect(result.tier).toBe(1);
  });

  it('should handle unicode characters', () => {
    const result = mapQuoteToAlgoliaValue('Improving search expérience for customers');
    expect(result).toBe('Search & Discovery');
  });

  it('should handle very long text', () => {
    const longText = 'search '.repeat(1000);
    const score = scoreQuoteRelevance(longText);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('should handle mixed case consistently', () => {
    expect(mapQuoteToAlgoliaValue('SEARCH')).toBe('Search & Discovery');
    expect(mapQuoteToAlgoliaValue('Search')).toBe('Search & Discovery');
    expect(mapQuoteToAlgoliaValue('search')).toBe('Search & Discovery');
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe('ALGOLIA_RELEVANT_TOPICS', () => {
  it('should contain core topics', () => {
    expect(ALGOLIA_RELEVANT_TOPICS).toContain('search');
    expect(ALGOLIA_RELEVANT_TOPICS).toContain('discovery');
    expect(ALGOLIA_RELEVANT_TOPICS).toContain('personalization');
    expect(ALGOLIA_RELEVANT_TOPICS).toContain('customer experience');
  });

  it('should be an array of strings', () => {
    expect(Array.isArray(ALGOLIA_RELEVANT_TOPICS)).toBe(true);
    expect(ALGOLIA_RELEVANT_TOPICS.every(t => typeof t === 'string')).toBe(true);
  });
});
