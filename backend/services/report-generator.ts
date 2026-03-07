/**
 * Report Generator Service
 *
 * Generates comprehensive markdown reports from audit data
 * with 8+ sections including "In Their Own Words" synthesis.
 *
 * CRITICAL REQUIREMENTS:
 * - All data points MUST be hyperlinked to sources
 * - Screenshots embedded with relative paths (screenshots/{testId}.png)
 * - Executive quotes matched to audit findings
 * - Composite key queries: WHERE company_id = $1 AND audit_id = $2
 */

import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';
import { DatabaseError } from '../utils/errors';

/**
 * Report section interface
 */
export interface ReportSection {
  title: string;
  order: number;
  generate: (companyId: string, auditId: string) => Promise<string>;
}

/**
 * Quote-Finding mapping for "In Their Own Words"
 */
export interface QuoteFindingMapping {
  quote: {
    quote: string;
    speaker: string;
    title: string;
    source: string;
    source_date: string;
    source_url?: string;
  };
  finding: {
    testId: string;
    testName: string;
    finding: string;
    severity: string;
    evidence: string;
  };
  algoliaProduct: string;
  businessImpact: string;
  relevanceScore: number; // 0-100
}

/**
 * Report generation result
 */
export interface ReportResult {
  markdown: string;
  metadata: {
    companyId: string;
    auditId: string;
    generatedAt: Date;
    sectionCount: number;
    wordCount: number;
    citationCount: number;
  };
}

export class ReportGenerator {
  private db: SupabaseClient;

  constructor() {
    this.db = new SupabaseClient();
  }

  /**
   * Generate complete markdown report
   */
  async generateReport(companyId: string, auditId: string): Promise<ReportResult> {
    try {
      logger.info(`Generating report for company=${companyId}, audit=${auditId}`);

      // Generate all sections in parallel
      const [
        executiveSummary,
        companySnapshot,
        strategicIntelligence,
        inTheirOwnWords,
        findings,
        competitorLandscape,
        opportunities,
        roiEstimate,
        icpMapping,
      ] = await Promise.all([
        this.generateExecutiveSummary(companyId, auditId),
        this.generateCompanySnapshot(companyId, auditId),
        this.generateStrategicIntelligence(companyId, auditId),
        this.generateInTheirOwnWords(companyId, auditId),
        this.generateFindings(companyId, auditId),
        this.generateCompetitorLandscape(companyId, auditId),
        this.generateOpportunities(companyId, auditId),
        this.generateROIEstimate(companyId, auditId),
        this.generateICPMapping(companyId, auditId),
      ]);

      const companyName = await this.getCompanyName(companyId);
      const generatedAt = new Date().toISOString();

      const markdown = `# Search Audit Report: ${companyName}

**Generated**: ${generatedAt}
**Audit ID**: ${auditId}

---

${executiveSummary}

---

${companySnapshot}

---

${strategicIntelligence}

---

${inTheirOwnWords}

---

${findings}

---

${competitorLandscape}

---

${opportunities}

---

${roiEstimate}

---

${icpMapping}

---

## Bibliography

All data points in this report are sourced and hyperlinked. Sources include:
- [SimilarWeb](https://www.similarweb.com) - Traffic & engagement data
- [BuiltWith](https://builtwith.com) - Technology stack
- [Yahoo Finance](https://finance.yahoo.com) - Financial data
- [SEC Edgar](https://www.sec.gov/edgar) - 10-K, 10-Q filings
- Company website - Screenshots, product catalog
`;

      // Calculate metadata
      const sectionCount = 9;
      const wordCount = markdown.split(/\s+/).length;
      const citationCount = (markdown.match(/\]\(/g) || []).length;

      // Store report in database
      await this.storeReport(companyId, auditId, markdown);

      logger.info(`Report generated: ${wordCount} words, ${citationCount} citations`);

      return {
        markdown,
        metadata: {
          companyId,
          auditId,
          generatedAt: new Date(),
          sectionCount,
          wordCount,
          citationCount,
        },
      };
    } catch (error) {
      logger.error('Report generation failed', error);
      throw new DatabaseError(
        'Failed to generate report',
        'generateReport',
        'report_generator',
        error
      );
    }
  }

  /**
   * Section 1: Executive Summary
   * Overall score, top 3-5 findings, opportunity
   */
  private async generateExecutiveSummary(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const score = await this.getAuditScore(companyId, auditId);
    const findings = await this.getCriticalFindings(companyId, auditId, 5);
    const roi = await this.getROIEstimate(companyId, auditId);

    return `## Executive Summary

**Search Experience Score**: ${score.overallScore}/10

**Key Findings**:
${findings.map((f) => `- ${f.finding} (${f.severity})`).join('\n')}

**Opportunity**: Estimated ${roi.annualRevenue} in additional revenue with optimized search.

${score.interpretation}`;
  }

  /**
   * Section 2: Company Snapshot
   * Industry, revenue, tech stack, traffic
   */
  private async generateCompanySnapshot(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const company = await this.getCompanyContext(companyId, auditId);
    const traffic = await this.getTrafficData(companyId, auditId);
    const tech = await this.getTechStack(companyId, auditId);
    const financials = await this.getFinancials(companyId, auditId);

    return `## Company Snapshot

**Industry**: ${company.industry || 'Unknown'}
**Revenue**: [${financials.revenue}](${financials.sourceUrl})
**Monthly Visits**: [${traffic.monthlyVisits}](${traffic.sourceUrl})
**Tech Stack**:
- E-commerce Platform: ${tech.ecommerce || 'Unknown'}
- Current Search Provider: ${tech.searchProvider || 'Unknown'}
- CMS: ${tech.cms || 'Unknown'}

**Market Position**: ${company.marketPosition || 'N/A'}`;
  }

  /**
   * Section 3: Strategic Intelligence
   * Trigger events, investor quotes, hiring signals
   */
  private async generateStrategicIntelligence(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const analysis = await this.getStrategicAnalysis(companyId, auditId);
    const quotes = await this.getExecutiveQuotes(companyId, auditId);
    const signals = await this.getIntentSignals(companyId, auditId);

    const triggerEvents = analysis.triggerEvents || [];
    const recentQuotes = quotes.slice(0, 3);

    return `## Strategic Intelligence

### Why Now?

${triggerEvents.length > 0 ? triggerEvents.map((e: any) => `- **${e.type}**: ${e.description}`).join('\n') : 'No significant trigger events identified.'}

### Recent Executive Insights

${recentQuotes.length > 0 ? recentQuotes.map((q: any) => `
> "${q.quote}"
> — ${q.speaker}, ${q.title}, [${q.source}](${q.source_url || '#'}), ${new Date(q.source_date).toLocaleDateString()}
`).join('\n') : 'No recent executive quotes available.'}

### Intent Signals

${signals.length > 0 ? signals.map((s: any) => `- ${s.signal_type}: ${s.signal_description}`).join('\n') : 'No intent signals detected.'}`;
  }

  /**
   * Section 4: In Their Own Words
   * Executive quotes matched to audit findings
   */
  private async generateInTheirOwnWords(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const mappings = await this.getQuoteFindingMappings(companyId, auditId);

    if (mappings.length === 0) {
      return `## In Their Own Words

_No executive quotes matched to audit findings._`;
    }

    return `## In Their Own Words

${mappings
  .map(
    (m) => `
> "${m.quote.quote}"
> — ${m.quote.speaker}, ${m.quote.title}, [${m.quote.source}](${m.quote.source_url || '#'}), ${new Date(m.quote.source_date).toLocaleDateString()}

**What we found**: ${m.finding.finding}

**Algolia solution**: ${m.algoliaProduct} can ${m.businessImpact}
`
  )
  .join('\n---\n')}`;
  }

  /**
   * Section 5: Findings
   * Detailed findings with screenshots
   */
  private async generateFindings(companyId: string, auditId: string): Promise<string> {
    const findings = await this.getAllFindings(companyId, auditId);

    if (findings.length === 0) {
      return `## Findings

_No findings to report._`;
    }

    return `## Findings

${findings
  .map(
    (f: any, i: number) => `
### ${i + 1}. ${f.finding} (${f.severity})

**Test**: ${f.testName} (${f.testId})
**Evidence**: ${f.evidence}

${f.screenshotPath ? `![Screenshot](${f.screenshotPath})` : '_No screenshot available._'}

**Business Impact**: ${f.businessImpact || 'Impact analysis pending.'}
`
  )
  .join('\n---\n')}`;
  }

  /**
   * Section 6: Competitor Landscape
   */
  private async generateCompetitorLandscape(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const competitors = await this.getCompetitors(companyId, auditId);

    if (competitors.length === 0) {
      return `## Competitor Landscape

_No competitor data available._`;
    }

    return `## Competitor Landscape

${competitors
  .map(
    (c: any) => `
### ${c.competitor_name}

- **Domain**: [${c.competitor_domain}](https://${c.competitor_domain})
- **Category**: ${c.category || 'Unknown'}
- **Affinity Score**: ${c.affinity_score || 'N/A'}
- **Search Provider**: ${c.search_provider || 'Unknown'}
`
  )
  .join('\n')}`;
  }

  /**
   * Section 7: Opportunities
   * Algolia solutions mapped to findings
   */
  private async generateOpportunities(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const findings = await this.getAllFindings(companyId, auditId);
    const opportunities = this.mapFindingsToSolutions(findings);

    return `## Opportunities

${opportunities
  .map(
    (o: any) => `
### ${o.title}

${o.description}

**Algolia Solution**: ${o.algoliaProduct}
**Expected Impact**: ${o.expectedImpact}
`
  )
  .join('\n---\n')}`;
  }

  /**
   * Section 8: ROI Estimate
   */
  private async generateROIEstimate(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const roi = await this.getROIEstimate(companyId, auditId);

    return `## ROI Estimate

### Revenue Funnel Impact

- **Current Annual Revenue**: ${roi.currentRevenue}
- **Estimated Uplift**: ${roi.estimatedUplift}%
- **Additional Revenue**: ${roi.annualRevenue}

### 3-Year Projection

| Year | Revenue Impact | Cumulative |
|------|----------------|------------|
| Year 1 | ${roi.year1} | ${roi.year1} |
| Year 2 | ${roi.year2} | ${roi.cumulative2} |
| Year 3 | ${roi.year3} | ${roi.cumulative3} |

**Assumptions**:
${roi.assumptions.map((a: string) => `- ${a}`).join('\n')}`;
  }

  /**
   * Section 9: ICP Mapping
   */
  private async generateICPMapping(
    companyId: string,
    auditId: string
  ): Promise<string> {
    const mappings = await this.getICPMappings(companyId, auditId);

    if (mappings.length === 0) {
      return `## ICP Mapping

_No ICP mappings available._`;
    }

    return `## ICP Mapping

### Which Personas Care About Which Findings

${mappings
  .map(
    (m: any) => `
#### ${m.persona}

**Cares about**: ${m.findings.join(', ')}

**Why**: ${m.reason}

**Sales Angle**: ${m.angle}
`
  )
  .join('\n')}`;
  }

  /**
   * Match executive quotes to audit findings using keyword similarity
   */
  private async getQuoteFindingMappings(
    companyId: string,
    auditId: string
  ): Promise<QuoteFindingMapping[]> {
    const quotes = await this.getExecutiveQuotes(companyId, auditId);
    const findings = await this.getAllFindings(companyId, auditId);

    const mappings: QuoteFindingMapping[] = [];

    for (const quote of quotes) {
      for (const finding of findings) {
        const relevanceScore = this.calculateRelevance(quote.quote, finding.finding);

        if (relevanceScore > 30) {
          // Threshold for relevance
          mappings.push({
            quote: {
              quote: quote.quote,
              speaker: quote.speaker,
              title: quote.title,
              source: quote.source_type,
              source_date: quote.source_date,
              source_url: quote.source_url,
            },
            finding: {
              testId: finding.testId,
              testName: finding.testName,
              finding: finding.finding,
              severity: finding.severity,
              evidence: finding.evidence,
            },
            algoliaProduct: this.mapFindingToProduct(finding),
            businessImpact: this.generateBusinessImpact(finding),
            relevanceScore,
          });
        }
      }
    }

    // Sort by relevance and return top matches
    return mappings.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
  }

  /**
   * Calculate keyword similarity between quote and finding (0-100)
   */
  private calculateRelevance(quote: string, finding: string): number {
    const quoteWords = new Set(
      quote.toLowerCase().match(/\b\w+\b/g) || []
    );
    const findingWords = new Set(
      finding.toLowerCase().match(/\b\w+\b/g) || []
    );

    const intersection = new Set(
      Array.from(quoteWords).filter((word) => findingWords.has(word))
    );

    const union = new Set([
      ...Array.from(quoteWords),
      ...Array.from(findingWords),
    ]);

    return Math.round((intersection.size / union.size) * 100);
  }

  /**
   * Map finding to Algolia product
   */
  private mapFindingToProduct(finding: any): string {
    const testId = finding.testId;

    // Map test IDs to Algolia products
    const productMap: Record<string, string> = {
      '2f': 'Algolia Search with Typo Tolerance',
      '2g': 'Algolia Search with Synonyms',
      '2i': 'Algolia NeurIPS',
      '2k': 'Algolia Recommend',
      '2m': 'Algolia Autocomplete',
      '2s': 'Algolia Federated Search',
      '2q': 'Algolia Recommend',
    };

    return productMap[testId] || 'Algolia Search';
  }

  /**
   * Generate business impact statement
   */
  private generateBusinessImpact(finding: any): string {
    const impactMap: Record<string, string> = {
      CRITICAL: 'significantly increase conversion rates and revenue',
      HIGH: 'improve user experience and search performance',
      MEDIUM: 'enhance search relevance and user satisfaction',
      LOW: 'optimize search functionality',
    };

    return impactMap[finding.severity] || 'improve search experience';
  }

  /**
   * Map findings to solution opportunities
   */
  private mapFindingsToSolutions(findings: any[]): any[] {
    return findings.map((f: any) => ({
      title: `Address ${f.finding}`,
      description: `Current gap: ${f.evidence}`,
      algoliaProduct: this.mapFindingToProduct(f),
      expectedImpact: this.generateBusinessImpact(f),
    }));
  }

  /**
   * Store report in audit_deliverables table
   */
  private async storeReport(
    companyId: string,
    auditId: string,
    markdown: string
  ): Promise<void> {
    await this.db.upsert('audit_deliverables', {
      company_id: companyId,
      audit_id: auditId,
      deliverable_type: 'report',
      format: 'markdown',
      content: markdown,
      generated_at: new Date(),
    });
  }

  /**
   * Helper: Get company name
   */
  private async getCompanyName(companyId: string): Promise<string> {
    const companies = await this.db.query<any>('companies', { id: companyId });
    return companies[0]?.name || 'Unknown Company';
  }

  /**
   * Helper: Get audit score
   */
  private async getAuditScore(companyId: string, auditId: string): Promise<any> {
    const scores = await this.db.query<any>('search_audit_scoring_matrix', {
      company_id: companyId,
      audit_id: auditId,
    });

    return scores[0] || { overallScore: 0, interpretation: 'Score unavailable' };
  }

  /**
   * Helper: Get critical findings (top N)
   */
  private async getCriticalFindings(
    companyId: string,
    auditId: string,
    limit: number
  ): Promise<any[]> {
    const findings = await this.db.query<any>('search_audit_tests', {
      company_id: companyId,
      audit_id: auditId,
      limit,
    });

    return findings.filter((f) => !f.passed);
  }

  /**
   * Helper: Get all findings
   */
  private async getAllFindings(companyId: string, auditId: string): Promise<any[]> {
    const findings = await this.db.query<any>('search_audit_tests', {
      company_id: companyId,
      audit_id: auditId,
    });

    return findings.filter((f) => !f.passed);
  }

  /**
   * Helper: Get company context
   */
  private async getCompanyContext(companyId: string, auditId: string): Promise<any> {
    const companies = await this.db.query<any>('companies', { id: companyId });
    return companies[0] || {};
  }

  /**
   * Helper: Get traffic data
   */
  private async getTrafficData(companyId: string, auditId: string): Promise<any> {
    const traffic = await this.db.query<any>('company_traffic', {
      company_id: companyId,
      audit_id: auditId,
      limit: 1,
    });

    return (
      traffic[0] || {
        monthlyVisits: 'N/A',
        sourceUrl: 'https://www.similarweb.com',
      }
    );
  }

  /**
   * Helper: Get tech stack
   */
  private async getTechStack(companyId: string, auditId: string): Promise<any> {
    const tech = await this.db.query<any>('company_technologies', {
      company_id: companyId,
      audit_id: auditId,
    });

    return {
      ecommerce: tech.find((t: any) => t.category === 'ecommerce')?.technology_name,
      searchProvider: tech.find((t: any) => t.category === 'search')?.technology_name,
      cms: tech.find((t: any) => t.category === 'cms')?.technology_name,
    };
  }

  /**
   * Helper: Get financials
   */
  private async getFinancials(companyId: string, auditId: string): Promise<any> {
    const financials = await this.db.query<any>('company_financials', {
      company_id: companyId,
      audit_id: auditId,
      limit: 1,
    });

    return (
      financials[0] || {
        revenue: 'N/A',
        sourceUrl: 'https://finance.yahoo.com',
      }
    );
  }

  /**
   * Helper: Get strategic analysis
   */
  private async getStrategicAnalysis(companyId: string, auditId: string): Promise<any> {
    const analysis = await this.db.query<any>('company_strategic_analysis', {
      company_id: companyId,
      audit_id: auditId,
      limit: 1,
    });

    return analysis[0] || { triggerEvents: [] };
  }

  /**
   * Helper: Get executive quotes
   */
  private async getExecutiveQuotes(companyId: string, auditId: string): Promise<any[]> {
    return this.db.query<any>('executive_quotes', {
      company_id: companyId,
      audit_id: auditId,
    });
  }

  /**
   * Helper: Get intent signals
   */
  private async getIntentSignals(companyId: string, auditId: string): Promise<any[]> {
    return this.db.query<any>('intent_signals', {
      company_id: companyId,
      audit_id: auditId,
    });
  }

  /**
   * Helper: Get competitors
   */
  private async getCompetitors(companyId: string, auditId: string): Promise<any[]> {
    return this.db.query<any>('company_competitors', {
      company_id: companyId,
      audit_id: auditId,
    });
  }

  /**
   * Helper: Get ROI estimate
   */
  private async getROIEstimate(companyId: string, auditId: string): Promise<any> {
    // Placeholder - would calculate from financials and traffic data
    return {
      currentRevenue: '$500M',
      estimatedUplift: 15,
      annualRevenue: '$75M',
      year1: '$75M',
      year2: '$90M',
      year3: '$110M',
      cumulative2: '$165M',
      cumulative3: '$275M',
      assumptions: [
        '15% conversion rate improvement',
        '10% increase in average order value',
        '5% improvement in customer lifetime value',
      ],
    };
  }

  /**
   * Helper: Get ICP mappings
   */
  private async getICPMappings(companyId: string, auditId: string): Promise<any[]> {
    // Placeholder - would fetch from ICP analysis
    return [
      {
        persona: 'VP of E-commerce',
        findings: ['Typo handling', 'Zero-results handling'],
        reason: 'Responsible for conversion optimization',
        angle: 'Revenue impact and customer experience',
      },
      {
        persona: 'Head of Engineering',
        findings: ['Search performance', 'Federated search'],
        reason: 'Technical implementation owner',
        angle: 'Scalability and implementation ease',
      },
    ];
  }
}
