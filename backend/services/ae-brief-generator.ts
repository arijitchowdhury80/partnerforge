/**
 * AE Pre-Call Brief Generator Service
 *
 * Generates 5-page AE-facing pre-call briefs from audit scratchpad files.
 * Designed for account executives preparing for discovery calls.
 *
 * ARCHITECTURE:
 * - Reads 12 scratchpad markdown files
 * - Generates AE-optimized brief (not customer-facing)
 * - Includes "Speaking Their Language" section with executive quotes
 * - Conversation starters, objection handling, strategic angles
 * - Buying committee intel, ICP mapping, product fit analysis
 *
 * OUTPUT:
 * - 5-page Markdown brief
 * - Actionable talk tracks and question templates
 * - Executive quote-to-finding mappings
 * - Objection handling playbook
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ScratchpadManager } from './scratchpad-manager';

/**
 * AE Brief configuration
 */
export interface AEBriefConfig {
  outputDir?: string;
  includeObjections: boolean;
  includeTalkTracks: boolean;
  includeQuestions: boolean;
}

/**
 * AE Brief generation result
 */
export interface AEBriefResult {
  briefPath: string;
  metadata: {
    companyName: string;
    auditId: string;
    generatedAt: Date;
    pageCount: number;
    quoteCount: number;
  };
}

/**
 * AE Pre-Call Brief Generator
 *
 * Generates actionable pre-call briefs for AEs preparing for
 * customer discovery calls with audit findings and strategic intel.
 */
export class AEBriefGenerator {
  private scratchpad: ScratchpadManager;
  private config: AEBriefConfig;

  constructor(scratchpad: ScratchpadManager, config?: Partial<AEBriefConfig>) {
    this.config = {
      outputDir: config?.outputDir || './deliverables/ae-briefs',
      includeObjections: config?.includeObjections ?? true,
      includeTalkTracks: config?.includeTalkTracks ?? true,
      includeQuestions: config?.includeQuestions ?? true,
    };
    this.scratchpad = scratchpad;
  }

  /**
   * Generate AE pre-call brief from scratchpad files
   */
  async generateBrief(): Promise<AEBriefResult> {
    try {
      logger.info('Starting AE brief generation');

      // 1. Read all scratchpad files
      const files = await this.scratchpad.getAllFiles();
      const companyName = this.extractCompanyName(files[0].content || '');

      // 2. Generate brief sections
      const brief = await this.generateBriefContent(files, companyName);

      // 3. Save file
      await fs.mkdir(this.config.outputDir!, { recursive: true });

      const briefPath = path.join(
        this.config.outputDir!,
        `${this.sanitizeFileName(companyName)}-ae-precall-brief.md`
      );

      await fs.writeFile(briefPath, brief, 'utf-8');

      // 4. Calculate metadata
      const quotes = this.extractExecutiveQuotes(files[6].content || '');
      const metadata = {
        companyName,
        auditId: this.scratchpad['auditId'],
        generatedAt: new Date(),
        pageCount: 5,
        quoteCount: quotes.length,
      };

      logger.info(`AE brief generated: ${briefPath} (${metadata.pageCount} pages, ${metadata.quoteCount} quotes)`);

      return {
        briefPath,
        metadata,
      };
    } catch (error) {
      logger.error('AE brief generation failed', error);
      throw new Error(`AE brief generation failed: ${error}`);
    }
  }

  /**
   * Generate complete brief content
   */
  private async generateBriefContent(files: any[], companyName: string): Promise<string> {
    const sections = [
      this.generateHeader(companyName),
      await this.generateExecutiveSummary(files[0], files[10], files[8]),
      await this.generateCompanyIntelligence(files[0], files[1], files[2], files[3], files[4]),
      await this.generateSpeakingTheirLanguage(files[6], files[7], files[8]),
      await this.generateConversationStarters(files[8], files[10]),
      await this.generateObjectionHandling(),
      await this.generateNextSteps(files[11]),
    ];

    return sections.join('\n\n---\n\n');
  }

  /**
   * Section 1: Header
   */
  private generateHeader(companyName: string): string {
    return `# AE Pre-Call Brief: ${companyName}

**Date**: ${new Date().toLocaleDateString()}
**Status**: 🔴 CONFIDENTIAL - Internal Only

---

## Quick Reference

- **Overall Search Score**: [See Executive Summary]
- **Key Decision Makers**: [See Speaking Their Language]
- **Primary Pain Points**: [See Conversation Starters]
- **Recommended Entry Point**: [See Next Steps]

**Pre-Call Prep Time**: 10-15 minutes
`;
  }

  /**
   * Section 2: Executive Summary
   */
  private async generateExecutiveSummary(
    companyContext: any,
    scoring: any,
    searchTests: any
  ): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const status = this.getScoreStatus(score);
    const industry = this.extractField(companyContext.content, 'Industry');
    const revenue = this.extractField(companyContext.content, 'Annual Revenue');
    const findings = this.extractFindings(searchTests.content || '').slice(0, 3);

    return `## Executive Summary

**Bottom Line**: ${companyName} has a **${status}** search experience (${score.toFixed(1)}/10). ${findings.length} critical gaps are costing revenue. Entry point: Address ${findings[0]?.severity || 'high'}-priority gaps first.

**Company Profile**:
- Industry: ${industry || 'E-commerce'}
- Revenue: ${revenue || 'N/A'}
- ICP Fit: ${this.calculateICPFit(score)} / 100

**Top 3 Gaps**:
1. **${findings[0]?.finding || 'N/A'}** (${findings[0]?.severity || 'N/A'}) - ${findings[0]?.businessImpact || 'N/A'}
2. **${findings[1]?.finding || 'N/A'}** (${findings[1]?.severity || 'N/A'}) - ${findings[1]?.businessImpact || 'N/A'}
3. **${findings[2]?.finding || 'N/A'}** (${findings[2]?.severity || 'N/A'}) - ${findings[2]?.businessImpact || 'N/A'}

**Recommended Algolia Products**:
${findings.map((f) => `- ${f.algoliaProduct}`).join('\n')}
`;
  }

  /**
   * Section 3: Company Intelligence
   */
  private async generateCompanyIntelligence(
    companyContext: any,
    techStack: any,
    traffic: any,
    financials: any,
    competitors: any
  ): Promise<string> {
    const ecommerce = this.extractField(techStack.content, 'E-commerce Platform');
    const searchProvider = this.extractField(techStack.content, 'Search Provider');
    const monthlyVisits = this.extractField(traffic.content, 'Monthly Visits');
    const growth = this.extractField(financials.content, 'Growth Rate');
    const competitorList = this.extractCompetitors(competitors.content || '');

    return `## Company Intelligence

### Tech Stack
- **E-commerce Platform**: ${ecommerce || 'Unknown'} → [Integration Complexity: ${this.assessIntegrationComplexity(ecommerce)}]
- **Current Search**: ${searchProvider || 'Unknown'} → [Migration Path: ${this.assessMigrationPath(searchProvider)}]
- **Analytics**: [See full tech stack in audit]

### Business Metrics
- **Monthly Traffic**: ${monthlyVisits || 'N/A'}
- **Growth Rate**: ${growth || 'N/A'}
- **Search Influence**: ~40% of revenue (industry avg)

### Competitive Landscape
${competitorList.slice(0, 3).map((c) => `- **${c.name}**: Search provider = ${c.searchProvider || 'Unknown'}`).join('\n')}

**Competitive Angle**: ${this.generateCompetitiveAngle(competitorList)}
`;
  }

  /**
   * Section 4: Speaking Their Language
   */
  private async generateSpeakingTheirLanguage(
    intel: any,
    strategic: any,
    searchTests: any
  ): Promise<string> {
    const quotes = this.extractExecutiveQuotes(intel.content || '');
    const findings = this.extractFindings(searchTests.content || '');
    const mappings = this.matchQuotesToFindings(quotes, findings);

    return `## Speaking Their Language

**What Leadership Cares About** (from earnings calls, 10-K, investor presentations):

${mappings.slice(0, 5).map((m) => `
### "${m.quote.quote.substring(0, 100)}..."

**Who Said It**: ${m.quote.speaker}, ${m.quote.title}
**Source**: ${m.quote.source}, ${m.quote.date}

**What We Found**: ${m.finding.finding}

**Talk Track**: "You mentioned ${this.extractKeyPhrase(m.quote.quote)}. Our audit found ${m.finding.evidence.toLowerCase()}. Algolia's ${m.finding.algoliaProduct} directly addresses this by ${m.finding.businessImpact.toLowerCase()}."

**Objection Handling**: If they say "${this.generateLikelyObjection(m.finding)}", respond with: "${this.generateObjectionResponse(m.finding)}"
`).join('\n---\n')}

${quotes.length === 0 ? '**Note**: No recent executive quotes found. Research earnings transcripts or investor presentations for additional context.' : ''}
`;
  }

  /**
   * Section 5: Conversation Starters
   */
  private async generateConversationStarters(searchTests: any, scoring: any): Promise<string> {
    const findings = this.extractFindings(searchTests.content || '');
    const score = this.extractOverallScore(scoring.content || '');
    const criticalFindings = findings.filter((f) => f.severity === 'CRITICAL');

    return `## Conversation Starters

### Opening Questions (Discovery)

1. **Search importance**: "How much of your revenue comes from customers using search vs. browse?"
   - *Why ask*: Validates 40% industry benchmark. If they say "most," search is critical path.

2. **Current pain points**: "What are the top 3 complaints you hear about search from customers or your team?"
   - *Why ask*: Opens conversation about ${criticalFindings.length} gaps we found.

3. **Prior attempts**: "Have you tried to improve search before? What stopped you?"
   - *Why ask*: Uncovers past failures, budget constraints, technical debt.

### Fact-Based Hooks (Use Our Data)

${criticalFindings.slice(0, 3).map((f, i) => `
${i + 1}. **${f.finding}**:
   - *Opening*: "We ran 20 tests on your search. One thing stood out: ${f.evidence.toLowerCase()}."
   - *Impact*: "This likely costs you [X]% of conversions. Industry benchmark is [Y]%."
   - *Solution*: "Algolia's ${f.algoliaProduct} fixes this in [timeframe]."
`).join('\n')}

### Strategic Framing

**For VP E-commerce**: "Your search score is ${score.toFixed(1)}/10. Companies with 8+ scores see 15-25% higher conversion rates. That's [$X]M/year at your scale."

**For Head of Engineering**: "We've integrated with ${this.extractField(searchTests.content, 'E-commerce Platform') || 'your platform'} before. Typical implementation is 8-12 weeks, no rip-and-replace."

**For CFO**: "ROI breaks even in [X] months based on conservative 15% conversion lift. 3-year NPV is [$Y]M."
`;
  }

  /**
   * Section 6: Objection Handling
   */
  private async generateObjectionHandling(): Promise<string> {
    return `## Objection Handling Playbook

### Common Objections & Responses

#### 1. "Our current search works fine."

**Response**: "I hear that. Most companies think that until they test it. We ran 20 tests on your search—here's what we found [show critical finding]. How would you expect search to handle [specific scenario]?"

**Proof Point**: "Your bounce rate on search is [X]%. Industry best-in-class is [Y]%. That gap is costing [Z]% of potential revenue."

---

#### 2. "We don't have budget right now."

**Response**: "Understood. Let me ask: if we could show ROI in [X] months, would that change the priority?"

**Reframe**: "This isn't a cost—it's revenue you're leaving on the table. At your scale, a 15% conversion lift is [$X]M/year. Algolia pays for itself in [Y] months."

**Next Step**: "Let's run a 6-week POC on one use case. Measure impact, then decide."

---

#### 3. "Implementation sounds complex / we don't have engineering bandwidth."

**Response**: "Fair concern. Our average integration is 8-12 weeks with 1 FTE on your side. We do most of the heavy lifting—migration, testing, optimization."

**Social Proof**: "[Similar company] integrated in [X] weeks with [Y] engineers. We have pre-built connectors for [their e-commerce platform]."

**Pilot Option**: "Start with one use case—product search or autocomplete. Prove impact, then expand."

---

#### 4. "We're already working with [competitor search provider]."

**Response**: "That's good—means search is a priority. How's it going? Are you hitting your goals?"

**Follow-up**: "What would make you switch? If we could show [X]% better relevance and [Y]% faster implementation, would that matter?"

**Differentiation**: "Algolia is AI-native with NLP, personalization, and federated search out-of-the-box. [Competitor] is primarily keyword matching. Here's the difference [show finding]."

---

#### 5. "We'll build this in-house."

**Response**: "I respect that. Question: How long would it take to build typo tolerance, synonym detection, NLP, personalization, A/B testing, and analytics in-house?"

**Reality Check**: "Most companies underestimate by 2-3x. Stripe tried to build internally, then switched to Algolia. Ask yourself: Is search a core competency, or should you focus on [their core business]?"

**Risk**: "Build vs. buy decision is really about opportunity cost. While your team builds search, what features aren't getting built?"

---

### If They're Interested But Hesitant

**Micro-commitment**: "Let's do this: I'll send over case studies from [similar companies]. Take a look, and let's schedule 30 minutes next week to discuss specifics."

**Trial Close**: "If we could prove [X]% improvement in [metric they care about], would you move forward?"

**Escalation Path**: "Who else needs to see this? Let's get your VP/CTO on the next call to address technical questions."
`;
  }

  /**
   * Section 7: Next Steps
   */
  private async generateNextSteps(recommendations: any): Promise<string> {
    const immediate = this.extractList(recommendations.content || '', 'Immediate Actions');

    return `## Recommended Next Steps

### Immediate Actions (Post-Call)

1. **Send audit report** (PDF book) within 24 hours
   - Personalize email: Reference specific quotes or findings discussed
   - CTA: "Review and let's schedule technical deep-dive"

2. **Schedule follow-up** within 1 week
   - Invite: VP E-commerce, Head of Engineering, Product Lead
   - Agenda: Technical architecture review, POC scoping

3. **Prep technical deep-dive**:
   - Integration complexity assessment
   - Data migration plan
   - Success metrics definition

### 30-60-90 Day Plan

**Week 1**: Internal alignment (this call)

**Week 2-3**: Technical deep-dive with solutions architects

**Week 4-6**: POC on 1-2 critical use cases
${immediate.slice(0, 2).map((r) => `  - ${r.description}`).join('\n')}

**Month 2-3**: Pilot on 20-30% of traffic, measure impact

**Month 4+**: Full rollout + ongoing optimization

### Key Stakeholders to Engage

- **VP E-commerce**: Business case owner, ROI approval
- **Head of Engineering**: Technical feasibility, implementation plan
- **Product Lead**: Use case prioritization, success metrics
- **CFO** (if deal >$100K): Financial approval, contract terms

### Internal Resources Needed

- Solutions Architect for technical deep-dive
- Customer Success for POC support
- Product Marketing for case studies
- Pricing for custom quote (if enterprise deal)

---

**Last Updated**: ${new Date().toISOString()}
**Audit ID**: ${this.scratchpad['auditId']}
`;
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
        affinityScore: this.extractField(details, 'Affinity Score'),
      });
    }

    return competitors;
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
    // Simple ICP fit: inverse of score gap (0-100)
    const gap = 10 - score;
    return Math.round(100 - (gap / 10) * 100);
  }

  private assessIntegrationComplexity(platform?: string): string {
    const complexityMap: Record<string, string> = {
      'Shopify': 'Low (API-first)',
      'Magento': 'Medium (pre-built extension)',
      'Custom': 'High (custom integration)',
    };

    return complexityMap[platform || ''] || 'Medium';
  }

  private assessMigrationPath(currentProvider?: string): string {
    if (!currentProvider || currentProvider === 'Unknown') return 'Greenfield (no migration)';
    if (currentProvider.toLowerCase().includes('elastic')) return 'Parallel deployment';
    if (currentProvider.toLowerCase().includes('solr')) return 'Direct migration';
    return 'Standard migration';
  }

  private generateCompetitiveAngle(competitors: any[]): string {
    const algoliaCount = competitors.filter((c) =>
      c.searchProvider?.toLowerCase().includes('algolia')
    ).length;

    if (algoliaCount === 0) {
      return 'First-mover advantage: None of your competitors use Algolia yet.';
    } else if (algoliaCount < competitors.length / 2) {
      return `Catching up: ${algoliaCount}/${competitors.length} competitors already use Algolia.`;
    } else {
      return `Industry standard: Majority of competitors use Algolia. Falling behind risks customer experience parity.`;
    }
  }

  private matchQuotesToFindings(quotes: any[], findings: any[]): any[] {
    const mappings: any[] = [];

    for (const quote of quotes) {
      for (const finding of findings) {
        const relevanceScore = this.calculateRelevance(quote.quote, finding.finding);

        if (relevanceScore > 20) {
          mappings.push({
            quote,
            finding,
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
      Array.from(quoteWords).filter((word) => findingWords.has(word))
    );

    const union = new Set([...Array.from(quoteWords), ...Array.from(findingWords)]);

    return Math.round((intersection.size / union.size) * 100);
  }

  private extractKeyPhrase(quote: string): string {
    // Extract first meaningful phrase (3-5 words)
    const words = quote.split(' ').slice(0, 5);
    return words.join(' ').toLowerCase();
  }

  private generateLikelyObjection(finding: any): string {
    const objectionMap: Record<string, string> = {
      'CRITICAL': 'This has always worked fine for us',
      'HIGH': 'We can fix this internally',
      'MEDIUM': 'This is not a priority right now',
    };

    return objectionMap[finding.severity] || 'We need to think about this';
  }

  private generateObjectionResponse(finding: any): string {
    return `Our audit shows ${finding.evidence.toLowerCase()}. ${finding.businessImpact}. ${finding.algoliaProduct} addresses this specifically—would you like to see how?`;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Factory function for creating AE brief generator
 */
export function createAEBriefGenerator(
  scratchpad: ScratchpadManager,
  config?: Partial<AEBriefConfig>
): AEBriefGenerator {
  return new AEBriefGenerator(scratchpad, config);
}
