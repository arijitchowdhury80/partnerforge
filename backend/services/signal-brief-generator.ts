/**
 * Strategic Signal Brief Generator Service
 *
 * Generates 1-page LLM-optimized signal briefs from audit scratchpad files.
 * Designed for downstream LLM consumption (not human reading).
 *
 * ARCHITECTURE:
 * - Reads 12 scratchpad markdown files
 * - Generates dense, structured, atomic signal lines
 * - Each line is standalone with full context
 * - No narrative flow—optimized for LLM parsing
 * - Signal density > readability
 *
 * OUTPUT:
 * - Single-page Markdown brief
 * - Atomic lines (no cross-references)
 * - Structured sections with metadata
 * - Ready for RAG indexing or agent consumption
 *
 * DESIGN PRINCIPLES:
 * 1. **Atomic**: Each line contains complete context (entity + signal + source)
 * 2. **Structured**: Predictable format for LLM parsing
 * 3. **Dense**: Maximum information per line
 * 4. **Standalone**: No "see above" or "mentioned earlier"
 * 5. **Timestamped**: All temporal references explicit
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ScratchpadManager } from './scratchpad-manager';

/**
 * Signal brief configuration
 */
export interface SignalBriefConfig {
  outputDir?: string;
  includeTimestamps: boolean;
  includeSources: boolean;
  includeConfidence: boolean; // Add confidence scores to signals
}

/**
 * Signal brief generation result
 */
export interface SignalBriefResult {
  briefPath: string;
  metadata: {
    companyName: string;
    auditId: string;
    generatedAt: Date;
    signalCount: number;
  };
}

/**
 * Strategic Signal Brief Generator
 *
 * Generates LLM-optimized signal briefs with atomic, standalone lines
 * for downstream agent consumption (RAG, decision engines, etc.).
 */
export class SignalBriefGenerator {
  private scratchpad: ScratchpadManager;
  private config: SignalBriefConfig;

  constructor(scratchpad: ScratchpadManager, config?: Partial<SignalBriefConfig>) {
    this.config = {
      outputDir: config?.outputDir || './deliverables/signal-briefs',
      includeTimestamps: config?.includeTimestamps ?? true,
      includeSources: config?.includeSources ?? true,
      includeConfidence: config?.includeConfidence ?? false,
    };
    this.scratchpad = scratchpad;
  }

  /**
   * Generate strategic signal brief from scratchpad files
   */
  async generateBrief(): Promise<SignalBriefResult> {
    try {
      logger.info('Starting signal brief generation');

      // 1. Read all scratchpad files
      const files = await this.scratchpad.getAllFiles();
      const companyName = this.extractCompanyName(files[0].content || '');

      // 2. Extract signals from all scratchpad files
      const signals = await this.extractAllSignals(files, companyName);

      // 3. Generate brief
      const brief = this.generateBriefContent(companyName, signals);

      // 4. Save file
      await fs.mkdir(this.config.outputDir!, { recursive: true });

      const briefPath = path.join(
        this.config.outputDir!,
        `${this.sanitizeFileName(companyName)}-strategic-signal-brief.md`
      );

      await fs.writeFile(briefPath, brief, 'utf-8');

      // 5. Calculate metadata
      const metadata = {
        companyName,
        auditId: this.scratchpad['auditId'],
        generatedAt: new Date(),
        signalCount: signals.length,
      };

      logger.info(`Signal brief generated: ${briefPath} (${metadata.signalCount} signals)`);

      return {
        briefPath,
        metadata,
      };
    } catch (error) {
      logger.error('Signal brief generation failed', error);
      throw new Error(`Signal brief generation failed: ${error}`);
    }
  }

  /**
   * Extract all signals from scratchpad files
   */
  private async extractAllSignals(files: any[], companyName: string): Promise<string[]> {
    const signals: string[] = [];
    const timestamp = this.config.includeTimestamps ? `[${new Date().toISOString().split('T')[0]}]` : '';

    // Company profile signals
    const industry = this.extractField(files[0].content, 'Industry');
    const businessModel = this.extractField(files[0].content, 'Business Model');
    signals.push(`COMPANY=${companyName} INDUSTRY=${industry || 'Unknown'} BUSINESS_MODEL=${businessModel || 'Unknown'} ${timestamp}`);

    // Tech stack signals
    const ecommerce = this.extractField(files[1].content, 'E-commerce Platform');
    const search = this.extractField(files[1].content, 'Search Provider');
    const cms = this.extractField(files[1].content, 'CMS');
    if (ecommerce) signals.push(`COMPANY=${companyName} TECH_STACK=E-commerce TECHNOLOGY=${ecommerce} SOURCE=BuiltWith ${timestamp}`);
    if (search) signals.push(`COMPANY=${companyName} TECH_STACK=Search TECHNOLOGY=${search} SOURCE=BuiltWith ${timestamp}`);
    if (cms) signals.push(`COMPANY=${companyName} TECH_STACK=CMS TECHNOLOGY=${cms} SOURCE=BuiltWith ${timestamp}`);

    // Traffic signals
    const monthlyVisits = this.extractField(files[2].content, 'Monthly Visits');
    const bounceRate = this.extractField(files[2].content, 'Bounce Rate');
    const avgDuration = this.extractField(files[2].content, 'Avg Visit Duration');
    if (monthlyVisits) signals.push(`COMPANY=${companyName} METRIC=MonthlyVisits VALUE=${monthlyVisits} SOURCE=SimilarWeb ${timestamp}`);
    if (bounceRate) signals.push(`COMPANY=${companyName} METRIC=BounceRate VALUE=${bounceRate} SOURCE=SimilarWeb ${timestamp}`);
    if (avgDuration) signals.push(`COMPANY=${companyName} METRIC=AvgVisitDuration VALUE=${avgDuration} SOURCE=SimilarWeb ${timestamp}`);

    // Financial signals
    const revenue = this.extractField(files[3].content, 'Annual Revenue');
    const growth = this.extractField(files[3].content, 'Growth Rate');
    const margins = this.extractField(files[3].content, 'Operating Margin');
    if (revenue) signals.push(`COMPANY=${companyName} METRIC=AnnualRevenue VALUE=${revenue} SOURCE=YahooFinance ${timestamp}`);
    if (growth) signals.push(`COMPANY=${companyName} METRIC=GrowthRate VALUE=${growth} SOURCE=YahooFinance ${timestamp}`);
    if (margins) signals.push(`COMPANY=${companyName} METRIC=OperatingMargin VALUE=${margins} SOURCE=YahooFinance ${timestamp}`);

    // Competitor signals
    const competitors = this.extractCompetitors(files[4].content || '');
    competitors.forEach((c) => {
      signals.push(`COMPANY=${companyName} COMPETITOR=${c.name} DOMAIN=${c.domain} SEARCH_PROVIDER=${c.searchProvider || 'Unknown'} SOURCE=SimilarWeb ${timestamp}`);
    });

    // Hiring signals
    const roles = this.extractList(files[5].content, 'Open Roles');
    roles.forEach((role) => {
      signals.push(`COMPANY=${companyName} SIGNAL=Hiring ROLE="${role.description}" SOURCE=CareersPage ${timestamp}`);
    });

    // Executive quote signals
    const quotes = this.extractExecutiveQuotes(files[6].content || '');
    quotes.forEach((q) => {
      signals.push(`COMPANY=${companyName} EXECUTIVE="${q.speaker}" TITLE="${q.title}" QUOTE="${q.quote.substring(0, 150)}" SOURCE="${q.source}" DATE=${q.date} ${timestamp}`);
    });

    // Strategic trigger events
    const triggerEvents = this.extractTriggerEvents(files[7].content || '');
    triggerEvents.forEach((e) => {
      signals.push(`COMPANY=${companyName} TRIGGER=${e.type} DESCRIPTION="${e.description}" ${timestamp}`);
    });

    // Search audit findings (critical only)
    const findings = this.extractFindings(files[8].content || '');
    const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');
    criticalFindings.forEach((f) => {
      signals.push(`COMPANY=${companyName} FINDING="${f.finding}" SEVERITY=CRITICAL EVIDENCE="${f.evidence.substring(0, 100)}" BUSINESS_IMPACT="${f.businessImpact.substring(0, 100)}" SOLUTION="${f.algoliaProduct}" ${timestamp}`);
    });

    // Search score signal
    const score = this.extractOverallScore(files[10].content || '');
    const status = this.getScoreStatus(score);
    signals.push(`COMPANY=${companyName} METRIC=SearchScore VALUE=${score.toFixed(1)} STATUS=${status} AUDIT_DATE=${new Date().toISOString().split('T')[0]} ${timestamp}`);

    // Scoring dimensions (low scores only)
    const dimensions = this.extractScoringDimensions(files[10].content || '');
    dimensions.filter((d) => d.score < 5).forEach((d) => {
      signals.push(`COMPANY=${companyName} DIMENSION="${d.name}" SCORE=${d.score} KEY_FINDING="${d.keyFinding.substring(0, 100)}" ${timestamp}`);
    });

    // Recommendations (immediate only)
    const immediate = this.extractList(files[11].content, 'Immediate Actions');
    immediate.forEach((r) => {
      signals.push(`COMPANY=${companyName} RECOMMENDATION="${r.description.substring(0, 150)}" PRIORITY=Immediate ${timestamp}`);
    });

    // ICP fit signal
    const icpFit = this.calculateICPFit(score);
    signals.push(`COMPANY=${companyName} METRIC=ICPFit VALUE=${icpFit} RATIONALE="Search score ${score.toFixed(1)}/10 indicates ${this.getICPRationale(score)}" ${timestamp}`);

    return signals;
  }

  /**
   * Generate brief content from signals
   */
  private generateBriefContent(companyName: string, signals: string[]): string {
    const header = `# Strategic Signal Brief: ${companyName}

**Format**: LLM-optimized atomic signals
**Generated**: ${new Date().toISOString()}
**Audit ID**: ${this.scratchpad['auditId']}
**Signal Count**: ${signals.length}

---

## Signal Format

Each line is a standalone signal with full context:
\`\`\`
ENTITY=Value ATTRIBUTE=Value METRIC=Value SOURCE=Value [Timestamp]
\`\`\`

No cross-references. No narrative flow. Maximum information density.

---

## Signals

`;

    const signalsSection = signals.map((s) => `- ${s}`).join('\n');

    const footer = `

---

## Metadata

**Company**: ${companyName}
**Audit Date**: ${new Date().toISOString().split('T')[0]}
**Signals Generated**: ${signals.length}
**Generation Timestamp**: ${new Date().toISOString()}

## Parsing Instructions (for downstream LLMs)

1. Each line is atomic—no context from other lines required
2. Key-value pairs are space-separated
3. String values are quoted if they contain spaces
4. SOURCE field indicates data origin (SimilarWeb, BuiltWith, YahooFinance, etc.)
5. Timestamp field (if present) indicates data currency
6. COMPANY field is always the first key for entity resolution

## Index Keys (for RAG)

- Primary: COMPANY name
- Secondary: METRIC names, FINDING severity, EXECUTIVE names
- Temporal: DATE fields, timestamps
- Source: SOURCE field for data provenance

---

**Generated by**: Algolia Arian Strategic Analysis Engine
**Schema Version**: 1.0
**Last Updated**: ${new Date().toISOString()}
`;

    return header + signalsSection + footer;
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private extractCompanyName(content: string): string {
    const match = content.match(/\*\*Company\*\*:?\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown Company';
  }

  private extractField(content: string, fieldName: string): string | undefined {
    const match = content.match(new RegExp(`\\*\\*${fieldName}\\*\\*:?\\s*(.+)`, 'i'));
    return match ? match[1].trim() : undefined;
  }

  private extractOverallScore(content: string): number {
    const match = content.match(/\*\*Overall Score\*\*:?\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractFindings(content: string): any[] {
    const findings: any[] = [];
    const matches = content.matchAll(/###\s*(.+?)\s*\((.+?)\)\n([\s\S]+?)(?=\n###|$)/g);

    for (const match of matches) {
      const finding = match[1].trim();
      const severity = match[2].trim();
      const details = match[3];

      findings.push({
        finding,
        severity,
        evidence: this.extractField(details, 'Evidence') || '',
        businessImpact: this.extractField(details, 'Business Impact') || '',
        algoliaProduct: this.extractField(details, 'Algolia Solution') || '',
      });
    }

    return findings;
  }

  private extractExecutiveQuotes(content: string): any[] {
    const quotes: any[] = [];
    const matches = content.matchAll(/>\\s*"(.+?)"\\s*\\n>\\s*—\\s*(.+?),\\s*(.+?),\\s*\\[(.+?)\\]\\((.+?)\\),\\s*(.+)/g);

    for (const match of matches) {
      quotes.push({
        quote: match[1],
        speaker: match[2],
        title: match[3],
        source: match[4],
        sourceUrl: match[5],
        date: match[6],
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

  private extractCompetitors(content: string): any[] {
    const competitors: any[] = [];
    const matches = content.matchAll(/###\s*(.+?)\n([\s\S]+?)(?=\n###|$)/g);

    for (const match of matches) {
      const name = match[1].trim();
      const details = match[2];

      competitors.push({
        name,
        domain: this.extractField(details, 'Domain'),
        searchProvider: this.extractField(details, 'Search Provider'),
      });
    }

    return competitors;
  }

  private extractScoringDimensions(content: string): any[] {
    const dimensions: any[] = [];
    const matches = content.matchAll(/\|\s*(.+?)\s*\|\s*(\d+(?:\.\d+)?)\/10\s*\|\s*([✅⚠️❌])\s*\|\s*(.+?)\s*\|/g);

    for (const match of matches) {
      if (match[1] === 'Dimension') continue;

      dimensions.push({
        name: match[1].trim(),
        score: parseFloat(match[2]),
        status: match[3].trim(),
        keyFinding: match[4].trim(),
      });
    }

    return dimensions;
  }

  private extractList(content: string, listName: string): any[] {
    const section = this.extractSection(content, listName);
    if (!section) return [];

    const items = section.match(/^[-*]\s+(.+)$/gm) || [];
    return items.map((item) => ({ description: item.replace(/^[-*]\s+/, '') }));
  }

  private extractSection(content: string, sectionName: string): string | undefined {
    const match = content.match(new RegExp(`###?\\s*${sectionName}\\s*\\n([\\s\\S]+?)(?=\\n###?|$)`, 'i'));
    return match ? match[1].trim() : undefined;
  }

  private getScoreStatus(score: number): string {
    if (score >= 8) return 'EXCELLENT';
    if (score >= 6) return 'GOOD';
    if (score >= 4) return 'FAIR';
    return 'POOR';
  }

  private calculateICPFit(score: number): number {
    const gap = 10 - score;
    return Math.round(100 - (gap / 10) * 100);
  }

  private getICPRationale(score: number): string {
    if (score >= 8) return 'strong fundamentals, minor optimizations';
    if (score >= 6) return 'above average, clear improvement opportunities';
    if (score >= 4) return 'significant gaps, high ROI potential';
    return 'critical gaps, urgent action needed';
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Factory function for creating signal brief generator
 */
export function createSignalBriefGenerator(
  scratchpad: ScratchpadManager,
  config?: Partial<SignalBriefConfig>
): SignalBriefGenerator {
  return new SignalBriefGenerator(scratchpad, config);
}
