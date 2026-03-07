/**
 * Presentation Deck Generator Service
 *
 * Generates 30-33 slide McKinsey Pyramid-structured presentations
 * from audit scratchpad files in Markdown format (Google Slides compatible).
 *
 * ARCHITECTURE:
 * - Reads 12 scratchpad markdown files
 * - Each scratchpad file → dedicated slide(s)
 * - McKinsey Pyramid structure: Situation → Complication → Resolution
 * - Speaker notes (60-90 sec/slide)
 * - Algolia brand standards: Nebula Blue (#003DFF), Space Gray (#21243D), Algolia Purple (#5468FF)
 * - Title slide with company photo + logo + status badge
 *
 * OUTPUT FORMAT:
 * - Markdown with slide delimiters (----)
 * - Google Slides import-ready
 * - PowerPoint-compatible
 * - Reveal.js-compatible
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ScratchpadManager } from './scratchpad-manager';

/**
 * Deck generation configuration
 */
export interface DeckGeneratorConfig {
  outputDir?: string;
  format: 'google-slides' | 'powerpoint' | 'reveal-js';
  includeNotes: boolean; // Speaker notes
  includeAnimations: boolean; // Transition hints
  brandTheme: 'algolia' | 'minimal';
}

/**
 * Deck generation result
 */
export interface DeckGeneratorResult {
  markdownPath: string;
  metadata: {
    companyName: string;
    auditId: string;
    generatedAt: Date;
    slideCount: number;
    estimatedDuration: number; // minutes
  };
}

/**
 * Slide data
 */
interface Slide {
  number: number;
  title: string;
  subtitle?: string;
  content: string;
  notes: string; // Speaker notes
  layout: 'title' | 'section' | 'content' | 'two-column' | 'visual' | 'quote';
  theme?: string; // CSS class hints
}

/**
 * Presentation Deck Generator
 *
 * Generates professional presentation decks in Markdown format
 * using McKinsey Pyramid structure.
 */
export class DeckGenerator {
  private scratchpad: ScratchpadManager;
  private config: DeckGeneratorConfig;

  constructor(scratchpad: ScratchpadManager, config?: Partial<DeckGeneratorConfig>) {
    this.config = {
      outputDir: config?.outputDir || './deliverables/decks',
      format: config?.format || 'google-slides',
      includeNotes: config?.includeNotes ?? true,
      includeAnimations: config?.includeAnimations ?? false,
      brandTheme: config?.brandTheme || 'algolia',
    };
    this.scratchpad = scratchpad;
  }

  /**
   * Generate presentation deck from scratchpad files
   */
  async generateDeck(): Promise<DeckGeneratorResult> {
    try {
      logger.info('Starting deck generation');

      // 1. Read all scratchpad files
      const files = await this.scratchpad.getAllFiles();
      const companyName = this.extractCompanyName(files[0].content || '');

      // 2. Parse scratchpad data into slides
      const slides = await this.parseSlides(files, companyName);

      // 3. Generate Markdown
      const markdown = this.generateMarkdown(slides);

      // 4. Save file
      await fs.mkdir(this.config.outputDir!, { recursive: true });

      const markdownPath = path.join(
        this.config.outputDir!,
        `${this.sanitizeFileName(companyName)}-search-audit-deck.md`
      );

      await fs.writeFile(markdownPath, markdown, 'utf-8');

      // 5. Calculate metadata
      const estimatedDuration = Math.ceil(slides.length * 1.5); // 1.5 min/slide average

      const metadata = {
        companyName,
        auditId: this.scratchpad['auditId'],
        generatedAt: new Date(),
        slideCount: slides.length,
        estimatedDuration,
      };

      logger.info(`Deck generated: ${markdownPath} (${metadata.slideCount} slides, ~${metadata.estimatedDuration} min)`);

      return {
        markdownPath,
        metadata,
      };
    } catch (error) {
      logger.error('Deck generation failed', error);
      throw new Error(`Deck generation failed: ${error}`);
    }
  }

  /**
   * Parse scratchpad files into presentation slides
   */
  private async parseSlides(files: any[], companyName: string): Promise<Slide[]> {
    const slides: Slide[] = [];
    let slideNumber = 1;

    // SLIDE 1: Title slide
    slides.push({
      number: slideNumber++,
      title: `${companyName} Search Experience Audit`,
      subtitle: `Algolia | ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      content: this.generateTitleSlide(files[0]),
      notes: `Welcome. Today we'll review the comprehensive search audit we conducted for ${companyName}. This 30-minute presentation covers strategic intelligence, audit findings, and specific recommendations. We'll identify critical gaps costing revenue and show how Algolia can address them. Duration: 60-90 seconds.`,
      layout: 'title',
      theme: 'algolia-gradient',
    });

    // SLIDE 2: Agenda (McKinsey Pyramid - Situation)
    slides.push({
      number: slideNumber++,
      title: 'Today's Agenda',
      content: this.generateAgendaSlide(),
      notes: 'Three-part agenda following the McKinsey Pyramid: Situation (where you are today), Complication (what's broken), and Resolution (how Algolia fixes it). We'll spend 10 minutes on context, 15 on findings, and 5 on next steps. Duration: 60 seconds.',
      layout: 'content',
    });

    // PART I: SITUATION (Strategic Intelligence) - Slides 3-12
    slides.push({
      number: slideNumber++,
      title: 'Part I: Strategic Intelligence',
      subtitle: 'Understanding Your Business Context',
      content: this.generateSectionDivider('SITUATION'),
      notes: 'Part 1 establishes the situation. We researched your company deeply using 14 data sources—SimilarWeb for traffic, BuiltWith for tech stack, Yahoo Finance for financials, earnings calls for executive priorities. This isn't generic—every data point is specific to your business. Duration: 60 seconds.',
      layout: 'section',
      theme: 'algolia-gradient',
    });

    slides.push({
      number: slideNumber++,
      title: 'Company Snapshot',
      content: await this.formatCompanySnapshot(files[0], files[1], files[2], files[3]),
      notes: await this.generateCompanySnapshotNotes(files[0], files[1], files[2], files[3]),
      layout: 'two-column',
    });

    slides.push({
      number: slideNumber++,
      title: 'Technology Stack',
      content: await this.formatTechStack(files[1]),
      notes: await this.generateTechStackNotes(files[1]),
      layout: 'content',
    });

    slides.push({
      number: slideNumber++,
      title: 'Traffic & Engagement',
      content: await this.formatTraffic(files[2]),
      notes: await this.generateTrafficNotes(files[2]),
      layout: 'visual',
    });

    slides.push({
      number: slideNumber++,
      title: 'Financial Position',
      content: await this.formatFinancials(files[3]),
      notes: await this.generateFinancialsNotes(files[3]),
      layout: 'content',
    });

    slides.push({
      number: slideNumber++,
      title: 'Competitor Landscape',
      content: await this.formatCompetitors(files[4]),
      notes: await this.generateCompetitorsNotes(files[4]),
      layout: 'content',
    });

    slides.push({
      number: slideNumber++,
      title: 'Hiring Signals',
      content: await this.formatHiring(files[5]),
      notes: await this.generateHiringNotes(files[5]),
      layout: 'content',
    });

    // Executive quotes - split across 2 slides
    const quotes = this.extractExecutiveQuotes(files[6].content || '');
    const midpoint = Math.ceil(quotes.length / 2);

    slides.push({
      number: slideNumber++,
      title: 'In Their Own Words (Part 1)',
      subtitle: 'What Leadership is Saying',
      content: this.formatExecutiveQuotes(quotes.slice(0, midpoint)),
      notes: this.generateQuotesNotes(quotes.slice(0, midpoint)),
      layout: 'quote',
    });

    slides.push({
      number: slideNumber++,
      title: 'In Their Own Words (Part 2)',
      subtitle: 'What Leadership is Saying',
      content: this.formatExecutiveQuotes(quotes.slice(midpoint)),
      notes: this.generateQuotesNotes(quotes.slice(midpoint)),
      layout: 'quote',
    });

    slides.push({
      number: slideNumber++,
      title: 'Strategic Angles',
      subtitle: 'Why Now?',
      content: await this.formatStrategic(files[7]),
      notes: await this.generateStrategicNotes(files[7]),
      layout: 'content',
    });

    // PART II: COMPLICATION (Search Audit) - Slides 13-23
    slides.push({
      number: slideNumber++,
      title: 'Part II: Search Audit Results',
      subtitle: 'Critical Gaps Impacting Revenue',
      content: this.generateSectionDivider('COMPLICATION'),
      notes: 'Part 2 reveals the complication: your search has critical gaps. We tested 20 scenarios—typo handling, zero-results, NLP, federated search, personalization. Each test mapped to revenue impact. This isn't opinion—it's evidence-based analysis with screenshots. Duration: 60 seconds.',
      layout: 'section',
      theme: 'algolia-gradient',
    });

    slides.push({
      number: slideNumber++,
      title: 'Overall Search Score',
      content: await this.formatOverallScore(files[10]),
      notes: await this.generateScoreNotes(files[10]),
      layout: 'visual',
    });

    slides.push({
      number: slideNumber++,
      title: '10-Dimension Scoring Breakdown',
      content: await this.formatScoringTable(files[10]),
      notes: await this.generateScoringTableNotes(files[10]),
      layout: 'content',
    });

    // Key findings - 3-5 slides depending on findings count
    const findings = this.extractFindings(files[8].content || '');
    const findingsPerSlide = 2;
    const findingsSlides = Math.ceil(findings.length / findingsPerSlide);

    for (let i = 0; i < findingsSlides; i++) {
      const slideFindings = findings.slice(i * findingsPerSlide, (i + 1) * findingsPerSlide);
      slides.push({
        number: slideNumber++,
        title: `Key Findings ${i + 1}/${findingsSlides}`,
        content: this.formatFindings(slideFindings),
        notes: this.generateFindingsNotes(slideFindings),
        layout: 'two-column',
      });
    }

    // PART III: RESOLUTION (Algolia Solutions) - Slides 24-32
    slides.push({
      number: slideNumber++,
      title: 'Part III: Algolia Solutions',
      subtitle: 'How We Address These Gaps',
      content: this.generateSectionDivider('RESOLUTION'),
      notes: 'Part 3 provides resolution: how Algolia solves each gap. We'll show specific product capabilities, industry benchmarks, ROI projections, case studies, and a clear implementation roadmap. This is about business outcomes, not features. Duration: 60 seconds.',
      layout: 'section',
      theme: 'algolia-gradient',
    });

    slides.push({
      number: slideNumber++,
      title: 'Recommendations',
      content: await this.formatRecommendations(files[11]),
      notes: await this.generateRecommendationsNotes(files[11]),
      layout: 'content',
    });

    slides.push({
      number: slideNumber++,
      title: 'ROI Projection',
      subtitle: 'Expected Revenue Impact',
      content: await this.formatROI(files[3], files[2], files[10]),
      notes: await this.generateROINotes(files[3], files[2], files[10]),
      layout: 'visual',
    });

    slides.push({
      number: slideNumber++,
      title: 'Case Studies',
      subtitle: 'Similar Companies Using Algolia',
      content: this.generateCaseStudies(files[0]),
      notes: this.generateCaseStudiesNotes(),
      layout: 'content',
    });

    slides.push({
      number: slideNumber++,
      title: 'Implementation Roadmap',
      content: this.generateImplementationRoadmap(),
      notes: this.generateRoadmapNotes(),
      layout: 'visual',
    });

    slides.push({
      number: slideNumber++,
      title: 'Next Steps',
      content: this.generateNextSteps(),
      notes: 'Recap: Critical gaps are costing revenue today. Algolia has proven solutions with measurable ROI. Next steps: Technical deep-dive in week 2-3, POC in week 4-6, pilot in month 2-3. Ask: What questions do you have? What would make this a priority for your team? Duration: 90 seconds.',
      layout: 'content',
    });

    // Final slide: Q&A
    slides.push({
      number: slideNumber++,
      title: 'Questions?',
      content: `
**Contact Information**

Your Algolia Account Executive
sales@algolia.com

**Resources**
- Documentation: algolia.com/doc
- Case Studies: algolia.com/customers
- Pricing: algolia.com/pricing
`,
      notes: 'Open for questions. Common questions: Implementation timeline (8-12 weeks), pricing model (usage-based), support level (24/7 with SLA), data security (SOC 2 Type II, GDPR compliant). Thank them for their time. Duration: Open-ended.',
      layout: 'content',
    });

    return slides;
  }

  /**
   * Generate Markdown from slides
   */
  private generateMarkdown(slides: Slide[]): string {
    const frontmatter = `---
title: "Search Experience Audit"
theme: algolia
format: google-slides
author: Algolia
date: ${new Date().toISOString().split('T')[0]}
---

`;

    const slidesMarkdown = slides
      .map((slide) => {
        let md = '';

        // Slide delimiter
        md += '---\n\n';

        // Layout hint (for Google Slides import)
        md += `<!-- .slide: layout="${slide.layout}" ${slide.theme ? `class="${slide.theme}"` : ''} -->\n\n`;

        // Title
        if (slide.layout === 'title') {
          md += `# ${slide.title}\n\n`;
          if (slide.subtitle) {
            md += `## ${slide.subtitle}\n\n`;
          }
        } else if (slide.layout === 'section') {
          md += `# ${slide.title}\n\n`;
          if (slide.subtitle) {
            md += `## ${slide.subtitle}\n\n`;
          }
        } else {
          md += `## ${slide.title}\n\n`;
          if (slide.subtitle) {
            md += `### ${slide.subtitle}\n\n`;
          }
        }

        // Content
        md += slide.content + '\n\n';

        // Speaker notes
        if (this.config.includeNotes && slide.notes) {
          md += `:::notes\n${slide.notes}\n:::\n\n`;
        }

        return md;
      })
      .join('\n');

    return frontmatter + slidesMarkdown;
  }

  /**
   * Generate title slide content
   */
  private generateTitleSlide(companyContext: any): string {
    const companyName = this.extractCompanyName(companyContext.content || '');
    const domain = this.extractDomain(companyContext.content || '');

    return `
![${companyName} HQ](https://source.unsplash.com/800x400/?office,building)

![${companyName}](https://logo.clearbit.com/${domain})
![Algolia](https://www.algolia.com/static/logo-algolia.svg)

<span class="badge badge--confidential">CONFIDENTIAL</span>
`;
  }

  /**
   * Generate agenda slide
   */
  private generateAgendaSlide(): string {
    return `
1. **Strategic Intelligence** (10 min)
   - Company context, tech stack, market position
   - Executive priorities, hiring signals, strategic angles

2. **Search Audit Results** (15 min)
   - 10-dimension scoring breakdown
   - Critical gaps with evidence (screenshots)
   - Business impact analysis

3. **Algolia Solutions** (5 min)
   - Recommendations mapped to findings
   - ROI projection, case studies
   - Implementation roadmap & next steps
`;
  }

  /**
   * Generate section divider content
   */
  private generateSectionDivider(label: string): string {
    return `
<div class="section-divider">
  <h1>${label}</h1>
</div>
`;
  }

  /**
   * Format company snapshot slide
   */
  private async formatCompanySnapshot(
    companyContext: any,
    techStack: any,
    traffic: any,
    financials: any
  ): Promise<string> {
    const industry = this.extractField(companyContext.content, 'Industry');
    const revenue = this.extractField(financials.content, 'Annual Revenue');
    const monthlyVisits = this.extractField(traffic.content, 'Monthly Visits');
    const ecommerce = this.extractField(techStack.content, 'E-commerce Platform');
    const searchProvider = this.extractField(techStack.content, 'Search Provider');

    return `
### Left Column

**Industry**: ${industry || 'E-commerce'}

**Annual Revenue**: ${revenue || 'N/A'}
<sup>[Yahoo Finance](https://finance.yahoo.com)</sup>

**Monthly Visits**: ${monthlyVisits || 'N/A'}
<sup>[SimilarWeb](https://www.similarweb.com)</sup>

### Right Column

**E-commerce Platform**: ${ecommerce || 'Unknown'}
<sup>[BuiltWith](https://builtwith.com)</sup>

**Current Search**: ${searchProvider || 'Unknown'}
<sup>[BuiltWith](https://builtwith.com)</sup>

**Market Position**: ${this.extractField(companyContext.content, 'Market Position') || 'N/A'}
`;
  }

  /**
   * Format tech stack slide
   */
  private async formatTechStack(file: any): Promise<string> {
    const content = file.content || '';
    const ecommerce = this.extractField(content, 'E-commerce Platform');
    const cms = this.extractField(content, 'CMS');
    const search = this.extractField(content, 'Search Provider');
    const analytics = this.extractField(content, 'Analytics');
    const cdn = this.extractField(content, 'CDN');

    return `
| Category | Technology |
|----------|-----------|
| E-commerce | ${ecommerce || 'Unknown'} |
| CMS | ${cms || 'Unknown'} |
| Search | ${search || 'Unknown'} |
| Analytics | ${analytics || 'Unknown'} |
| CDN | ${cdn || 'Unknown'} |

<sup>Source: [BuiltWith](https://builtwith.com)</sup>
`;
  }

  /**
   * Format traffic slide
   */
  private async formatTraffic(file: any): Promise<string> {
    const content = file.content || '';
    const monthlyVisits = this.extractField(content, 'Monthly Visits');
    const bounceRate = this.extractField(content, 'Bounce Rate');
    const avgVisitDuration = this.extractField(content, 'Avg Visit Duration');
    const pagesPerVisit = this.extractField(content, 'Pages Per Visit');

    return `
- **Monthly Visits**: ${monthlyVisits || 'N/A'}
- **Bounce Rate**: ${bounceRate || 'N/A'}
- **Avg Visit Duration**: ${avgVisitDuration || 'N/A'}
- **Pages/Visit**: ${pagesPerVisit || 'N/A'}

<sup>Source: [SimilarWeb](https://www.similarweb.com)</sup>

> **Key Insight**: ${this.extractSection(content, 'Summary') || 'Traffic analysis indicates strong engagement.'}
`;
  }

  /**
   * Format financials slide
   */
  private async formatFinancials(file: any): Promise<string> {
    const content = file.content || '';
    const revenue = this.extractField(content, 'Annual Revenue');
    const growth = this.extractField(content, 'Growth Rate');
    const margins = this.extractField(content, 'Operating Margin');

    return `
- **Annual Revenue**: ${revenue || 'N/A'}
- **Growth Rate**: ${growth || 'N/A'}
- **Operating Margin**: ${margins || 'N/A'}

<sup>Source: [Yahoo Finance](https://finance.yahoo.com)</sup>

> **Key Insight**: ${this.extractSection(content, 'Summary') || 'Strong financial position supports investment in search optimization.'}
`;
  }

  /**
   * Format competitors slide
   */
  private async formatCompetitors(file: any): Promise<string> {
    const content = file.content || '';
    const competitors = this.extractCompetitors(content);

    return `
${competitors.slice(0, 5).map((c) => `
**${c.name}**
- Domain: ${c.domain}
- Search Provider: ${c.searchProvider || 'Unknown'}
- Affinity: ${c.affinityScore || 'N/A'}
`).join('\n')}

<sup>Source: [SimilarWeb](https://www.similarweb.com)</sup>
`;
  }

  /**
   * Format hiring signals slide
   */
  private async formatHiring(file: any): Promise<string> {
    const content = file.content || '';
    const roles = this.extractList(content, 'Open Roles').slice(0, 5);

    return `
**Recent Hiring Activity**:

${roles.map((r, i) => `${i + 1}. ${r.description}`).join('\n')}

<sup>Source: [Company Careers Page](https://careers.example.com)</sup>

> **Signal**: ${this.extractSection(content, 'Summary') || 'Active hiring in e-commerce and engineering indicates growth priorities.'}
`;
  }

  /**
   * Format executive quotes
   */
  private formatExecutiveQuotes(quotes: any[]): string {
    return quotes
      .map(
        (q) => `
> "${q.quote}"

— **${q.speaker}**, ${q.title}
<sup>[${q.source}](${q.sourceUrl || '#'}), ${q.date}</sup>
`
      )
      .join('\n---\n\n');
  }

  /**
   * Format strategic angles slide
   */
  private async formatStrategic(file: any): Promise<string> {
    const content = file.content || '';
    const triggerEvents = this.extractTriggerEvents(content);

    return `
**Why Now?**

${triggerEvents.map((e) => `- **${e.type}**: ${e.description}`).join('\n')}

> **Bottom Line**: ${this.extractSection(content, 'Summary') || 'Multiple trigger events create urgency for search optimization.'}
`;
  }

  /**
   * Format overall score slide
   */
  private async formatOverallScore(file: any): Promise<string> {
    const content = file.content || '';
    const score = this.extractOverallScore(content);
    const status = this.getScoreStatus(score);

    return `
<div class="score-display">
  <div class="score-circle">
    <span class="score-value">${score.toFixed(1)}</span>
    <span class="score-max">/10</span>
  </div>
  <div class="score-label">Overall Search Experience Score</div>
  <span class="badge badge--${status.toLowerCase()}">${status}</span>
</div>

> ${this.interpretScore(score)}
`;
  }

  /**
   * Format scoring table slide
   */
  private async formatScoringTable(file: any): Promise<string> {
    const content = file.content || '';
    const dimensions = this.extractScoringDimensions(content);

    return `
| Dimension | Score | Status | Key Finding |
|-----------|-------|--------|-------------|
${dimensions.map((d) => `| ${d.name} | ${d.score}/10 | ${d.status} | ${d.keyFinding} |`).join('\n')}
`;
  }

  /**
   * Format findings slide
   */
  private formatFindings(findings: any[]): string {
    return findings
      .map(
        (f) => `
### ${f.finding} <span class="badge badge--${f.severity.toLowerCase()}">${f.severity}</span>

**Evidence**: ${f.evidence}

${f.screenshotPath ? `![Screenshot](${f.screenshotPath})` : ''}

**Business Impact**: ${f.businessImpact}

**Algolia Solution**: ${f.algoliaProduct}
`
      )
      .join('\n---\n\n');
  }

  /**
   * Format recommendations slide
   */
  private async formatRecommendations(file: any): Promise<string> {
    const content = file.content || '';
    const immediate = this.extractList(content, 'Immediate Actions');
    const shortTerm = this.extractList(content, 'Short-Term');

    return `
**Immediate Actions (30-60 days)**:

${immediate.slice(0, 3).map((r, i) => `${i + 1}. ${r.description}`).join('\n')}

**Short-Term (60-90 days)**:

${shortTerm.slice(0, 2).map((r, i) => `${i + 1}. ${r.description}`).join('\n')}
`;
  }

  /**
   * Format ROI slide
   */
  private async formatROI(financials: any, traffic: any, scoring: any): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const revenue = this.extractAnnualRevenue(financials.content || '');
    const gap = 10 - score;
    const liftFactor = gap / 10;
    const expectedLift = Math.round(15 + liftFactor * 10);
    const additionalRevenue = revenue * (expectedLift / 100);

    return `
**Expected Impact**:

- Conversion Lift: **${expectedLift}%**
- Additional Revenue (Year 1): **$${(additionalRevenue / 1000000).toFixed(1)}M**

**3-Year Projection**:

| Year | Revenue Impact | Cumulative |
|------|----------------|------------|
| Year 1 | $${(additionalRevenue / 1000000).toFixed(1)}M | $${(additionalRevenue / 1000000).toFixed(1)}M |
| Year 2 | $${((additionalRevenue * 1.2) / 1000000).toFixed(1)}M | $${((additionalRevenue * 2.2) / 1000000).toFixed(1)}M |
| Year 3 | $${((additionalRevenue * 1.5) / 1000000).toFixed(1)}M | $${((additionalRevenue * 3.7) / 1000000).toFixed(1)}M |

<sup>Based on 40% of revenue being search-influenced and 15-25% conversion lift benchmarks</sup>
`;
  }

  /**
   * Generate case studies slide
   */
  private generateCaseStudies(companyContext: any): string {
    const industry = this.extractField(companyContext.content, 'Industry') || 'E-commerce';

    const caseStudyMap: Record<string, any[]> = {
      'Retail': [
        { company: 'Lovesac', result: '25% increase in conversion rate', url: 'algolia.com/customers/lovesac' },
        { company: 'Lacoste', result: '150% increase in search-driven revenue', url: 'algolia.com/customers/lacoste' },
      ],
      'E-commerce': [
        { company: 'Gymshark', result: '30% increase in search-driven orders', url: 'algolia.com/customers/gymshark' },
      ],
      'default': [
        { company: 'Stripe', result: 'Improved developer experience', url: 'algolia.com/customers/stripe' },
      ],
    };

    const caseStudies = caseStudyMap[industry] || caseStudyMap['default'];

    return `
${caseStudies.map((cs) => `
**${cs.company}**
- Result: ${cs.result}
- [Read full case study](https://${cs.url})
`).join('\n')}
`;
  }

  /**
   * Generate implementation roadmap slide
   */
  private generateImplementationRoadmap(): string {
    return `
1. **Week 1**: Review audit with e-commerce and engineering teams
2. **Week 2-3**: Technical deep-dive with Algolia solutions architects
3. **Week 4-6**: Proof-of-concept on critical use cases
4. **Month 2-3**: Pilot on 20-30% of traffic to measure impact
5. **Month 4+**: Full rollout with ongoing optimization
`;
  }

  /**
   * Generate next steps slide
   */
  private generateNextSteps(): string {
    return `
1. **Schedule technical deep-dive** with Algolia solutions team
2. **Identify POC scope** (which use cases to test first)
3. **Define success metrics** (what improvement would justify full rollout)
4. **Get stakeholder alignment** (who needs to approve)

**Ready to get started?** Contact your Algolia account executive.
`;
  }

  // ========================================
  // SPEAKER NOTES GENERATORS
  // ========================================

  private async generateCompanySnapshotNotes(
    companyContext: any,
    techStack: any,
    traffic: any,
    financials: any
  ): Promise<string> {
    const revenue = this.extractField(financials.content, 'Annual Revenue');
    const monthlyVisits = this.extractField(traffic.content, 'Monthly Visits');

    return `Company snapshot: ${revenue || 'N/A'} annual revenue, ${monthlyVisits || 'N/A'} monthly visits. All data sourced from public APIs—Yahoo Finance, SimilarWeb, BuiltWith. Current search provider shown on right. This establishes baseline for understanding impact of search gaps. Duration: 75 seconds.`;
  }

  private async generateTechStackNotes(file: any): Promise<string> {
    const search = this.extractField(file.content, 'Search Provider');
    return `Technology stack from BuiltWith. Current search provider is ${search || 'Unknown'}. This matters because migration complexity varies by platform. We've done this integration before—typical implementation is 8-12 weeks. Duration: 60 seconds.`;
  }

  private async generateTrafficNotes(file: any): Promise<string> {
    const monthlyVisits = this.extractField(file.content, 'Monthly Visits');
    return `Traffic data from SimilarWeb. ${monthlyVisits || 'N/A'} monthly visits. Bounce rate and engagement metrics suggest search quality directly impacts conversion. Small improvements in search = significant revenue impact at this scale. Duration: 75 seconds.`;
  }

  private async generateFinancialsNotes(file: any): Promise<string> {
    return 'Financial data from Yahoo Finance. Strong position supports investment in search optimization. ROI calculation later in deck uses these baseline numbers. Duration: 60 seconds.';
  }

  private async generateCompetitorsNotes(file: any): Promise<string> {
    return 'Competitor analysis from SimilarWeb. We audited their search providers. [Note specific competitors]. This is a competitive opportunity—if they're not using best-in-class search, you can differentiate. Duration: 75 seconds.';
  }

  private async generateHiringNotes(file: any): Promise<string> {
    return 'Hiring signals from careers page. Active hiring in [specific roles] indicates strategic priorities. This aligns with search optimization because [connection to business goals]. Duration: 60 seconds.';
  }

  private generateQuotesNotes(quotes: any[]): string {
    if (quotes.length === 0) return 'No executive quotes available.';
    return `Executive quotes from ${quotes[0]?.source || 'recent sources'}. Key theme: ${quotes[0]?.quote.split(' ').slice(0, 10).join(' ')}... This shows leadership priorities. Our recommendations directly address these priorities. Duration: 90 seconds.`;
  }

  private async generateStrategicNotes(file: any): Promise<string> {
    const events = this.extractTriggerEvents(file.content || '');
    return `Strategic timing: ${events.length} trigger events create urgency. [Mention specific events]. These aren't generic—they're specific to your business right now. Timing matters for prioritization. Duration: 75 seconds.`;
  }

  private async generateScoreNotes(file: any): Promise<string> {
    const score = this.extractOverallScore(file.content || '');
    const status = this.getScoreStatus(score);

    return `Overall score: ${score.toFixed(1)}/10 (${status}). We tested 20 scenarios across 10 dimensions. This isn't subjective—it's evidence-based. Score below 6 means critical gaps. Next slide breaks down by dimension. Duration: 60 seconds.`;
  }

  private async generateScoringTableNotes(file: any): Promise<string> {
    const dimensions = this.extractScoringDimensions(file.content || '');
    const critical = dimensions.filter((d) => d.score < 4);

    return `10-dimension breakdown. ${critical.length} dimensions scored critical (under 4/10). [Mention specific dimensions]. Each dimension maps to revenue impact. Next slides show specific findings with evidence. Duration: 90 seconds.`;
  }

  private generateFindingsNotes(findings: any[]): string {
    if (findings.length === 0) return 'No findings to present.';
    return `Findings with evidence. [Describe each finding]. Screenshot shows actual user experience. Business impact quantified. Algolia solution mapped to each gap. This is specific, not generic. Duration: 90 seconds.`;
  }

  private async generateRecommendationsNotes(file: any): Promise<string> {
    return 'Recommendations prioritized by impact and effort. Immediate actions are quick wins. Short-term actions require engineering work. Each recommendation maps back to findings shown earlier. Duration: 75 seconds.';
  }

  private async generateROINotes(financials: any, traffic: any, scoring: any): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const gap = 10 - score;
    const liftFactor = gap / 10;
    const expectedLift = Math.round(15 + liftFactor * 10);

    return `ROI projection based on industry benchmarks. 40% of e-commerce revenue is search-influenced. With ${expectedLift}% conversion lift (conservative), additional revenue shown in table. Year 1 impact pays for itself. Years 2-3 compound. Duration: 90 seconds.`;
  }

  private generateCaseStudiesNotes(): string {
    return 'Case studies from similar companies. Not generic—chosen based on your industry and use cases. Results are publicly documented. These aren't outliers—typical Algolia customers see 15-25% conversion lift. Duration: 60 seconds.';
  }

  private generateRoadmapNotes(): string {
    return 'Implementation roadmap: 8-12 weeks typical. Week 1 is internal alignment. Weeks 2-6 are POC (we do most of the work). Months 2-3 are pilot to measure impact. Month 4+ is rollout. Not a big-bang—incremental and measurable. Duration: 75 seconds.';
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  private extractCompanyName(content: string): string {
    const match = content.match(/\*\*Company\*\*:?\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown Company';
  }

  private extractDomain(content: string): string {
    const match = content.match(/\*\*Domain\*\*:?\s*(.+)/i);
    return match ? match[1].trim() : 'example.com';
  }

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
    return items.map((item) => ({ description: item.replace(/^[-*]\s+/, '') }));
  }

  private extractOverallScore(content: string): number {
    const match = content.match(/\*\*Overall Score\*\*:?\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  private extractAnnualRevenue(content: string): number {
    const match = content.match(/\*\*Annual Revenue\*\*:?\s*\$?([\d.]+)([MBK]?)/i);
    if (!match) return 500000000;

    const value = parseFloat(match[1]);
    const unit = match[2];

    if (unit === 'B') return value * 1000000000;
    if (unit === 'M') return value * 1000000;
    if (unit === 'K') return value * 1000;
    return value;
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
        screenshotPath: this.extractScreenshotPath(details),
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
        affinityScore: this.extractField(details, 'Affinity Score'),
      });
    }

    return competitors;
  }

  private extractScreenshotPath(content: string): string | undefined {
    const match = content.match(/!\[.*?\]\((.+?)\)/);
    return match ? match[1] : undefined;
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

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Factory function for creating deck generator
 */
export function createDeckGenerator(
  scratchpad: ScratchpadManager,
  config?: Partial<DeckGeneratorConfig>
): DeckGenerator {
  return new DeckGenerator(scratchpad, config);
}
