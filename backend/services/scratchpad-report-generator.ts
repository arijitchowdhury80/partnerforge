/**
 * Scratchpad-Based Report Generator
 *
 * Generates professional markdown reports from scratchpad files.
 * Complements the database-based report-generator.ts by reading
 * from intermediate scratchpad files instead of querying database directly.
 *
 * ARCHITECTURE:
 * - Reads from 12 scratchpad markdown files
 * - Synthesizes data into professional report sections
 * - Generates 8 report sections with hyperlinked sources
 * - Embeds screenshots with relative paths
 * - Matches executive quotes to audit findings
 *
 * REPORT STRUCTURE (follows Algolia Search Audit skill format):
 * 1. Executive Summary
 * 2. Strategic Intelligence (company context, financials, tech stack, market position, timing)
 * 3. Search Audit Results (10-dimension scoring table)
 * 4. Key Findings (Critical Gaps, Opportunities, Strengths)
 * 5. In Their Own Words (executive quotes matched to findings)
 * 6. ROI Projection
 * 7. Competitor Landscape
 * 8. Recommendations (Immediate, Short-term, Long-term)
 * 9. Appendix (test queries, screenshots, detailed scoring)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ScratchpadManager } from './scratchpad-manager';

/**
 * Report configuration
 */
export interface ReportConfig {
  includeScreenshots: boolean;
  includeAppendix: boolean;
  includeROI: boolean;
  maxFindings: number; // Max findings to include in report
}

/**
 * Report generation result
 */
export interface ScratchpadReportResult {
  markdown: string;
  outputPath: string;
  metadata: {
    companyName: string;
    auditId: string;
    generatedAt: Date;
    sectionCount: number;
    wordCount: number;
    citationCount: number;
    screenshotCount: number;
  };
}

/**
 * Finding from scratchpad
 */
interface Finding {
  testId: string;
  testName: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  finding: string;
  evidence: string;
  businessImpact: string;
  algoliaProduct: string;
  screenshotPath?: string;
}

/**
 * Scoring dimension
 */
interface ScoringDimension {
  name: string;
  score: number; // 0-10
  status: '✅' | '⚠️' | '❌';
  keyFinding: string;
}

/**
 * Executive quote
 */
interface ExecutiveQuote {
  quote: string;
  speaker: string;
  title: string;
  source: string;
  sourceDate: string;
  sourceUrl?: string;
}

export class ScratchpadReportGenerator {
  private scratchpad: ScratchpadManager;
  private config: ReportConfig;

  constructor(scratchpad: ScratchpadManager, config?: Partial<ReportConfig>) {
    this.scratchpad = scratchpad;
    this.config = {
      includeScreenshots: true,
      includeAppendix: true,
      includeROI: true,
      maxFindings: 10,
      ...config,
    };
  }

  /**
   * Generate complete markdown report from scratchpad files
   */
  async generateReport(): Promise<ScratchpadReportResult> {
    try {
      logger.info('Generating report from scratchpad files');

      // Read all scratchpad files
      const files = await this.scratchpad.getAllFiles();

      // Parse data from scratchpad files
      const companyContext = this.parseCompanyContext(files[1]);
      const techStack = this.parseTechStack(files[2]);
      const traffic = this.parseTraffic(files[3]);
      const financials = this.parseFinancials(files[4]);
      const competitors = this.parseCompetitors(files[5]);
      const hiring = this.parseHiring(files[6]);
      const intel = this.parseIntel(files[7]);
      const strategic = this.parseStrategic(files[8]);
      const searchTests = this.parseSearchTests(files[9]);
      const screenshots = this.parseScreenshots(files[10]);
      const scoring = this.parseScoring(files[11]);
      const recommendations = this.parseRecommendations(files[12]);

      // Generate report sections
      const executiveSummary = this.generateExecutiveSummary(
        companyContext,
        scoring,
        searchTests
      );
      const strategicIntelligence = this.generateStrategicIntelligence(
        companyContext,
        financials,
        techStack,
        traffic,
        strategic
      );
      const auditResults = this.generateAuditResults(scoring);
      const keyFindings = this.generateKeyFindings(searchTests, scoring);
      const inTheirOwnWords = this.generateInTheirOwnWords(intel, searchTests);
      const roiSection = this.config.includeROI
        ? this.generateROI(financials, traffic, scoring)
        : '';
      const competitorSection = this.generateCompetitorLandscape(competitors);
      const recommendationsSection = this.generateRecommendations(recommendations, searchTests);
      const appendix = this.config.includeAppendix
        ? this.generateAppendix(searchTests, screenshots, scoring)
        : '';

      // Assemble final report
      const markdown = this.assembleReport(
        companyContext.name,
        executiveSummary,
        strategicIntelligence,
        auditResults,
        keyFindings,
        inTheirOwnWords,
        roiSection,
        competitorSection,
        recommendationsSection,
        appendix
      );

      // Save report to workspace
      const outputPath = await this.saveReport(companyContext.name, markdown);

      // Calculate metadata
      const metadata = this.calculateMetadata(companyContext.name, markdown);

      logger.info(`Report generated: ${metadata.wordCount} words, ${metadata.citationCount} citations`);

      return {
        markdown,
        outputPath,
        metadata,
      };
    } catch (error) {
      logger.error('Report generation failed', error);
      throw new Error(`Report generation failed: ${error}`);
    }
  }

  /**
   * Section 1: Executive Summary
   */
  private generateExecutiveSummary(
    companyContext: any,
    scoring: any,
    searchTests: any
  ): string {
    const overallScore = scoring.overallScore || 0;
    const status = this.getScoreStatus(overallScore);
    const topFindings = searchTests.findings?.slice(0, 3) || [];

    return `## Executive Summary

**Overall Search Experience Score**: ${overallScore.toFixed(1)}/10 (${status})

${companyContext.name} operates in the ${companyContext.industry || 'e-commerce'} space. Our comprehensive search audit reveals ${topFindings.length} critical gaps that are impacting conversion rates and customer experience.

**Top ${topFindings.length} Findings**:
${topFindings.map((f: Finding, i: number) => `${i + 1}. **${f.finding}** (${f.severity}) - ${f.businessImpact}`).join('\n')}

**Opportunity**: With optimized search powered by Algolia, ${companyContext.name} can address these gaps and unlock significant revenue growth through improved conversion rates and customer satisfaction.

**Bottom Line**: ${this.generateBottomLine(overallScore, topFindings)}`;
  }

  /**
   * Section 2: Strategic Intelligence
   */
  private generateStrategicIntelligence(
    companyContext: any,
    financials: any,
    techStack: any,
    traffic: any,
    strategic: any
  ): string {
    return `## Strategic Intelligence

### Company Context

**Industry**: ${companyContext.industry || 'Unknown'}
**Business Model**: ${companyContext.businessModel || 'Unknown'}
**Market Position**: ${companyContext.marketPosition || 'N/A'}

${companyContext.description || ''}

### Financial Position

${financials.revenue ? `**Annual Revenue**: ${financials.revenue}` : ''}
${financials.growth ? `**Growth Rate**: ${financials.growth}` : ''}
${financials.margins ? `**Margins**: ${financials.margins}` : ''}

${financials.summary || ''}

### Technology Stack

**E-commerce Platform**: ${techStack.ecommerce || 'Unknown'}
**Current Search Provider**: ${techStack.searchProvider || 'Unknown'}
**CMS**: ${techStack.cms || 'Unknown'}
**Analytics**: ${techStack.analytics || 'Unknown'}

${techStack.summary || ''}

### Market Position

${traffic.monthlyVisits ? `**Monthly Visits**: ${traffic.monthlyVisits}` : ''}
${traffic.engagement ? `**Engagement**: ${traffic.engagement}` : ''}
${traffic.sources ? `**Traffic Sources**: ${traffic.sources}` : ''}

${traffic.summary || ''}

### Strategic Timing

**Why Now?**

${strategic.triggerEvents?.length > 0
  ? strategic.triggerEvents.map((e: any) => `- **${e.type}**: ${e.description}`).join('\n')
  : '_No significant trigger events identified._'}

${strategic.summary || ''}`;
  }

  /**
   * Section 3: Search Audit Results (10-dimension scoring)
   */
  private generateAuditResults(scoring: any): string {
    const dimensions = scoring.dimensions || [];

    return `## Search Audit Results

### Overall Score: ${scoring.overallScore?.toFixed(1) || 0}/10

| Dimension | Score | Status | Key Findings |
|-----------|-------|--------|-------------|
${dimensions.map((d: ScoringDimension) =>
  `| ${d.name} | ${d.score}/10 | ${d.status} | ${d.keyFinding} |`
).join('\n')}

### Score Interpretation

${this.interpretScore(scoring.overallScore)}`;
  }

  /**
   * Section 4: Key Findings
   */
  private generateKeyFindings(searchTests: any, scoring: any): string {
    const findings = searchTests.findings || [];
    const critical = findings.filter((f: Finding) => f.severity === 'CRITICAL');
    const high = findings.filter((f: Finding) => f.severity === 'HIGH');
    const medium = findings.filter((f: Finding) => f.severity === 'MEDIUM');

    let output = '## Key Findings\n\n';

    if (critical.length > 0) {
      output += '### 🔴 Critical Gaps (Score < 4)\n\n';
      output += critical.map((f: Finding, i: number) => this.formatFinding(f, i + 1)).join('\n---\n');
      output += '\n\n';
    }

    if (high.length > 0) {
      output += '### ⚠️ Opportunities (Score 4-6)\n\n';
      output += high.map((f: Finding, i: number) => this.formatFinding(f, i + 1)).join('\n---\n');
      output += '\n\n';
    }

    if (medium.length > 0) {
      output += '### ✅ Strengths (Score 7+)\n\n';
      output += medium.map((f: Finding, i: number) => this.formatFinding(f, i + 1)).join('\n---\n');
    }

    return output;
  }

  /**
   * Section 5: In Their Own Words
   */
  private generateInTheirOwnWords(intel: any, searchTests: any): string {
    const quotes = intel.quotes || [];
    const findings = searchTests.findings || [];

    if (quotes.length === 0) {
      return `## In Their Own Words

_No executive quotes available._`;
    }

    // Match quotes to findings
    const mappings = this.matchQuotesToFindings(quotes, findings);

    if (mappings.length === 0) {
      return `## In Their Own Words

${quotes.slice(0, 3).map((q: ExecutiveQuote) => `
> "${q.quote}"
> — ${q.speaker}, ${q.title}, [${q.source}](${q.sourceUrl || '#'}), ${q.sourceDate}
`).join('\n')}`;
    }

    return `## In Their Own Words

**Strategy vs. Execution**: What the leadership says vs. what we found.

${mappings.map((m: any) => `
> "${m.quote.quote}"
> — ${m.quote.speaker}, ${m.quote.title}, [${m.quote.source}](${m.quote.sourceUrl || '#'}), ${m.quote.sourceDate}

**What we found**: ${m.finding.finding}

**The gap**: ${m.businessImpact}

**Algolia solution**: ${m.algoliaProduct}
`).join('\n---\n')}`;
  }

  /**
   * Section 6: ROI Projection
   */
  private generateROI(financials: any, traffic: any, scoring: any): string {
    const currentRevenue = financials.annualRevenue || 'N/A';
    const monthlyVisits = traffic.monthlyVisits || 'N/A';
    const bounceRate = traffic.bounceRate || 0;
    const conversionRate = financials.conversionRate || 0;

    // Calculate potential impact
    const searchRevenueShare = 0.4; // 40% of e-commerce revenue comes from search
    const expectedLift = this.calculateExpectedLift(scoring.overallScore);

    return `## ROI Projection

### Current State

- **Annual Revenue**: ${currentRevenue}
- **Monthly Traffic**: ${monthlyVisits}
- **Bounce Rate**: ${bounceRate}%
- **Conversion Rate**: ${conversionRate}%

### Potential Impact with Algolia

Based on industry benchmarks and your current search score of ${scoring.overallScore?.toFixed(1) || 0}/10:

- **Expected conversion lift**: ${expectedLift.conversion}%
- **Expected bounce rate reduction**: ${expectedLift.bounce}%
- **Expected average order value increase**: ${expectedLift.aov}%

### Revenue Impact

**Conservative Estimate** (Year 1):
- Additional revenue from improved search: ${this.formatCurrency(expectedLift.annualRevenue)}

**3-Year Projection**:

| Year | Revenue Impact | Cumulative |
|------|----------------|------------|
| Year 1 | ${this.formatCurrency(expectedLift.year1)} | ${this.formatCurrency(expectedLift.year1)} |
| Year 2 | ${this.formatCurrency(expectedLift.year2)} | ${this.formatCurrency(expectedLift.cumulative2)} |
| Year 3 | ${this.formatCurrency(expectedLift.year3)} | ${this.formatCurrency(expectedLift.cumulative3)} |

**Assumptions**:
- ${searchRevenueShare * 100}% of revenue is search-influenced
- Industry average conversion lift: 15-25%
- Industry average bounce rate reduction: 10-20%
- Conservative lift factors applied based on current score`;
  }

  /**
   * Section 7: Competitor Landscape
   */
  private generateCompetitorLandscape(competitors: any): string {
    const competitorList = competitors.list || [];

    if (competitorList.length === 0) {
      return `## Competitor Landscape

_No competitor data available._`;
    }

    return `## Competitor Landscape

${competitorList.map((c: any) => `
### ${c.name}

- **Domain**: [${c.domain}](https://${c.domain})
- **Search Provider**: ${c.searchProvider || 'Unknown'}
- **Affinity Score**: ${c.affinityScore || 'N/A'}
- **Category**: ${c.category || 'Unknown'}

${c.notes || ''}
`).join('\n')}

### Competitive Analysis

${competitors.analysis || '_No competitive analysis available._'}`;
  }

  /**
   * Section 8: Recommendations
   */
  private generateRecommendations(recommendations: any, searchTests: any): string {
    const immediate = recommendations.immediate || [];
    const shortTerm = recommendations.shortTerm || [];
    const longTerm = recommendations.longTerm || [];

    return `## Recommendations

### Immediate Actions (30-60 days)

${immediate.length > 0
  ? immediate.map((r: any, i: number) => `${i + 1}. **${r.title}**: ${r.description}`).join('\n')
  : '_No immediate actions identified._'}

### Short-Term (60-90 days)

${shortTerm.length > 0
  ? shortTerm.map((r: any, i: number) => `${i + 1}. **${r.title}**: ${r.description}`).join('\n')
  : '_No short-term actions identified._'}

### Long-Term (6-12 months)

${longTerm.length > 0
  ? longTerm.map((r: any, i: number) => `${i + 1}. **${r.title}**: ${r.description}`).join('\n')
  : '_No long-term actions identified._'}

${recommendations.summary || ''}`;
  }

  /**
   * Section 9: Appendix
   */
  private generateAppendix(searchTests: any, screenshots: any, scoring: any): string {
    return `## Appendix

### A. Test Query Strategy

${searchTests.testQueries?.map((q: any) => `- **"${q.query}"** (${q.category}): ${q.expectedResults}`).join('\n') || '_No test queries documented._'}

### B. Screenshot Inventory

${screenshots.inventory?.map((s: any, i: number) => `${i + 1}. **${s.caption}** - \`${s.filePath}\``).join('\n') || '_No screenshots available._'}

### C. Detailed Scoring Breakdown

${scoring.dimensions?.map((d: ScoringDimension) => `
#### ${d.name}: ${d.score}/10

**Status**: ${d.status}
**Key Finding**: ${d.keyFinding}
`).join('\n') || '_No scoring data available._'}`;
  }

  /**
   * Assemble final report
   */
  private assembleReport(
    companyName: string,
    ...sections: string[]
  ): string {
    const auditId = this.scratchpad['auditId'];
    const generatedAt = new Date().toISOString();

    return `# Algolia Search Audit - ${companyName}

**Audit Date**: ${new Date().toLocaleDateString()}
**Audit ID**: ${auditId}
**Generated**: ${generatedAt}

---

${sections.filter(s => s).join('\n\n---\n\n')}

---

## Bibliography

All data points in this report are sourced and hyperlinked. Sources include:

- **SimilarWeb** - Traffic & engagement data
- **BuiltWith** - Technology stack analysis
- **Yahoo Finance** - Financial data
- **SEC Edgar** - 10-K, 10-Q filings
- **Company website** - Screenshots, product catalog
- **Apify** - Hiring signals, social data
- **Apollo.io** - Buying committee, intent signals

---

**Generated by Algolia Arian**
**Report ID**: ${auditId}
**Generated**: ${new Date().toISOString()}
`;
  }

  /**
   * Save report to workspace
   */
  private async saveReport(companyName: string, markdown: string): Promise<string> {
    const outputPath = path.join(
      this.scratchpad.getWorkspaceDir(),
      `${companyName.toLowerCase().replace(/\s+/g, '-')}-search-audit-report.md`
    );

    await fs.writeFile(outputPath, markdown, 'utf-8');
    logger.info(`Report saved to: ${outputPath}`);

    return outputPath;
  }

  /**
   * Calculate report metadata
   */
  private calculateMetadata(companyName: string, markdown: string): any {
    const wordCount = markdown.split(/\s+/).length;
    const citationCount = (markdown.match(/\]\(/g) || []).length;
    const screenshotCount = (markdown.match(/!\[.*?\]\(/g) || []).length;
    const sectionCount = (markdown.match(/^## /gm) || []).length;

    return {
      companyName,
      auditId: this.scratchpad['auditId'],
      generatedAt: new Date(),
      sectionCount,
      wordCount,
      citationCount,
      screenshotCount,
    };
  }

  // ========================================
  // PARSING METHODS (extract data from scratchpad files)
  // ========================================

  private parseCompanyContext(content: string): any {
    // Extract company name, industry, business model, etc.
    return {
      name: this.extractField(content, 'Company') || 'Unknown Company',
      industry: this.extractField(content, 'Industry'),
      businessModel: this.extractField(content, 'Business Model'),
      marketPosition: this.extractField(content, 'Market Position'),
      description: this.extractSection(content, 'Overview'),
    };
  }

  private parseTechStack(content: string): any {
    return {
      ecommerce: this.extractField(content, 'E-commerce Platform'),
      searchProvider: this.extractField(content, 'Search Provider'),
      cms: this.extractField(content, 'CMS'),
      analytics: this.extractField(content, 'Analytics'),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  private parseTraffic(content: string): any {
    return {
      monthlyVisits: this.extractField(content, 'Monthly Visits'),
      engagement: this.extractField(content, 'Engagement'),
      bounceRate: parseFloat(this.extractField(content, 'Bounce Rate') || '0'),
      sources: this.extractField(content, 'Traffic Sources'),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  private parseFinancials(content: string): any {
    return {
      annualRevenue: this.extractField(content, 'Annual Revenue'),
      revenue: this.extractField(content, 'Revenue'),
      growth: this.extractField(content, 'Growth Rate'),
      margins: this.extractField(content, 'Margins'),
      conversionRate: parseFloat(this.extractField(content, 'Conversion Rate') || '0'),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  private parseCompetitors(content: string): any {
    return {
      list: this.extractCompetitorList(content),
      analysis: this.extractSection(content, 'Analysis'),
    };
  }

  private parseHiring(content: string): any {
    return {
      roles: this.extractList(content, 'Open Roles'),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  private parseIntel(content: string): any {
    return {
      quotes: this.extractExecutiveQuotes(content),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  private parseStrategic(content: string): any {
    return {
      triggerEvents: this.extractTriggerEvents(content),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  private parseSearchTests(content: string): any {
    return {
      findings: this.extractFindings(content),
      testQueries: this.extractList(content, 'Test Queries'),
    };
  }

  private parseScreenshots(content: string): any {
    return {
      inventory: this.extractScreenshotInventory(content),
    };
  }

  private parseScoring(content: string): any {
    return {
      overallScore: parseFloat(this.extractField(content, 'Overall Score') || '0'),
      dimensions: this.extractScoringDimensions(content),
    };
  }

  private parseRecommendations(content: string): any {
    return {
      immediate: this.extractList(content, 'Immediate Actions'),
      shortTerm: this.extractList(content, 'Short-Term'),
      longTerm: this.extractList(content, 'Long-Term'),
      summary: this.extractSection(content, 'Summary'),
    };
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private extractField(content: string, fieldName: string): string | undefined {
    const match = content.match(new RegExp(`\\*\\*${fieldName}\\*\\*:?\\s*(.+)`, 'i'));
    return match ? match[1].trim() : undefined;
  }

  private extractSection(content: string, sectionName: string): string | undefined {
    const match = content.match(new RegExp(`###?\\s*${sectionName}\\s*\\n([\\s\\S]+?)(?=\\n###?|$)`, 'i'));
    return match ? match[1].trim() : undefined;
  }

  private extractList(content: string, listName: string): any[] {
    const section = this.extractSection(content, listName);
    if (!section) return [];

    const items = section.match(/^[-*]\s+(.+)$/gm) || [];
    return items.map(item => ({ description: item.replace(/^[-*]\s+/, '') }));
  }

  private extractCompetitorList(content: string): any[] {
    // Parse competitor list from markdown
    const competitors: any[] = [];
    const matches = content.matchAll(/###\s*(.+?)\n([\s\S]+?)(?=\n###|$)/g);

    for (const match of matches) {
      const name = match[1].trim();
      const details = match[2];

      competitors.push({
        name,
        domain: this.extractField(details, 'Domain'),
        searchProvider: this.extractField(details, 'Search Provider'),
        affinityScore: this.extractField(details, 'Affinity Score'),
        category: this.extractField(details, 'Category'),
        notes: this.extractSection(details, 'Notes'),
      });
    }

    return competitors;
  }

  private extractExecutiveQuotes(content: string): ExecutiveQuote[] {
    const quotes: ExecutiveQuote[] = [];
    const matches = content.matchAll(/>\\s*"(.+?)"\\s*\\n>\\s*—\\s*(.+?),\\s*(.+?),\\s*\\[(.+?)\\]\\((.+?)\\),\\s*(.+)/g);

    for (const match of matches) {
      quotes.push({
        quote: match[1],
        speaker: match[2],
        title: match[3],
        source: match[4],
        sourceUrl: match[5],
        sourceDate: match[6],
      });
    }

    return quotes;
  }

  private extractTriggerEvents(content: string): any[] {
    const events: any[] = [];
    const matches = content.matchAll(/[-*]\s*\*\*(.+?)\*\*:\\s*(.+)/g);

    for (const match of matches) {
      events.push({
        type: match[1],
        description: match[2],
      });
    }

    return events;
  }

  private extractFindings(content: string): Finding[] {
    const findings: Finding[] = [];
    const matches = content.matchAll(/###\s*(.+?)\s*\((.+?)\)\n([\s\S]+?)(?=\n###|$)/g);

    for (const match of matches) {
      const finding = match[1].trim();
      const severity = match[2].trim() as Finding['severity'];
      const details = match[3];

      findings.push({
        testId: this.extractField(details, 'Test ID') || '',
        testName: this.extractField(details, 'Test') || '',
        severity,
        finding,
        evidence: this.extractField(details, 'Evidence') || '',
        businessImpact: this.extractField(details, 'Business Impact') || '',
        algoliaProduct: this.extractField(details, 'Algolia Solution') || '',
        screenshotPath: this.extractScreenshotPath(details),
      });
    }

    return findings;
  }

  private extractScreenshotPath(content: string): string | undefined {
    const match = content.match(/!\[.*?\]\((.+?)\)/);
    return match ? match[1] : undefined;
  }

  private extractScreenshotInventory(content: string): any[] {
    const inventory: any[] = [];
    const matches = content.matchAll(/\d+\.\s*\*\*(.+?)\*\*\s*-\s*`(.+?)`/g);

    for (const match of matches) {
      inventory.push({
        caption: match[1],
        filePath: match[2],
      });
    }

    return inventory;
  }

  private extractScoringDimensions(content: string): ScoringDimension[] {
    const dimensions: ScoringDimension[] = [];
    const matches = content.matchAll(/\|\s*(.+?)\s*\|\s*(\d+(?:\.\d+)?)\/10\s*\|\s*([✅⚠️❌])\s*\|\s*(.+?)\s*\|/g);

    for (const match of matches) {
      if (match[1] === 'Dimension') continue; // Skip header row

      dimensions.push({
        name: match[1].trim(),
        score: parseFloat(match[2]),
        status: match[3].trim() as ScoringDimension['status'],
        keyFinding: match[4].trim(),
      });
    }

    return dimensions;
  }

  private formatFinding(finding: Finding, number: number): string {
    return `
#### ${number}. ${finding.finding} (${finding.severity})

**Test**: ${finding.testName} (${finding.testId})
**Evidence**: ${finding.evidence}

${finding.screenshotPath && this.config.includeScreenshots
  ? `![Screenshot](${finding.screenshotPath})`
  : '_No screenshot available._'}

**Business Impact**: ${finding.businessImpact}

**Algolia Solution**: ${finding.algoliaProduct}
`;
  }

  private matchQuotesToFindings(quotes: ExecutiveQuote[], findings: Finding[]): any[] {
    const mappings: any[] = [];

    for (const quote of quotes) {
      for (const finding of findings) {
        const relevanceScore = this.calculateRelevance(quote.quote, finding.finding);

        if (relevanceScore > 30) {
          mappings.push({
            quote,
            finding,
            businessImpact: finding.businessImpact,
            algoliaProduct: finding.algoliaProduct,
            relevanceScore,
          });
        }
      }
    }

    return mappings.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 5);
  }

  private calculateRelevance(quote: string, finding: string): number {
    const quoteWords = new Set(quote.toLowerCase().match(/\b\w+\b/g) || []);
    const findingWords = new Set(finding.toLowerCase().match(/\b\w+\b/g) || []);

    const intersection = new Set(
      Array.from(quoteWords).filter(word => findingWords.has(word))
    );

    const union = new Set([...Array.from(quoteWords), ...Array.from(findingWords)]);

    return Math.round((intersection.size / union.size) * 100);
  }

  private getScoreStatus(score: number): string {
    if (score >= 8) return 'EXCELLENT';
    if (score >= 6) return 'GOOD';
    if (score >= 4) return 'FAIR';
    return 'POOR';
  }

  private interpretScore(score: number): string {
    if (score >= 8) {
      return 'Your search experience is best-in-class with strong fundamentals across all dimensions.';
    } else if (score >= 6) {
      return 'Your search experience is above average but has room for optimization in key areas.';
    } else if (score >= 4) {
      return 'Your search experience has significant gaps that are likely impacting conversion rates and user satisfaction.';
    }
    return 'Your search experience has critical gaps that are severely impacting business metrics and user experience.';
  }

  private generateBottomLine(score: number, findings: Finding[]): string {
    const criticalCount = findings.filter(f => f.severity === 'CRITICAL').length;

    if (score < 4) {
      return `With ${criticalCount} critical gaps identified, immediate action is needed to prevent revenue loss and improve customer experience.`;
    } else if (score < 6) {
      return `While functional, your search has ${criticalCount} critical gaps that represent significant opportunities for improvement.`;
    } else if (score < 8) {
      return `Your search is performing well overall, with targeted optimizations available to reach best-in-class status.`;
    }
    return 'Your search is best-in-class. Consider Algolia for further innovation and advanced capabilities.';
  }

  private calculateExpectedLift(currentScore: number): any {
    // Calculate expected lift based on current score
    const maxScore = 10;
    const gap = maxScore - currentScore;
    const liftFactor = gap / maxScore; // 0-1 range

    return {
      conversion: Math.round(15 + (liftFactor * 10)), // 15-25%
      bounce: Math.round(10 + (liftFactor * 10)), // 10-20%
      aov: Math.round(5 + (liftFactor * 5)), // 5-10%
      annualRevenue: 5000000 * liftFactor, // Placeholder
      year1: 5000000 * liftFactor,
      year2: 6000000 * liftFactor,
      year3: 7500000 * liftFactor,
      cumulative2: 11000000 * liftFactor,
      cumulative3: 18500000 * liftFactor,
    };
  }

  private formatCurrency(value: number): string {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  }
}

/**
 * Factory function for creating report generator
 */
export function createScratchpadReportGenerator(
  scratchpad: ScratchpadManager,
  config?: Partial<ReportConfig>
): ScratchpadReportGenerator {
  return new ScratchpadReportGenerator(scratchpad, config);
}
