/**
 * Landing Page Generator Service
 *
 * Generates interactive HTML landing pages from audit scratchpad files.
 * Dual-view layout with executive summary + detailed findings.
 *
 * ARCHITECTURE:
 * - Reads 12 scratchpad markdown files
 * - Generates responsive HTML with Algolia branding
 * - Source citation badges on every data point
 * - Interactive tabs, accordions, and score visualizations
 * - Mobile-first responsive design
 * - Inline CSS (no external dependencies)
 *
 * OUTPUT:
 * - Single HTML file with all assets inlined
 * - Works offline (no CDN dependencies)
 * - Ready for hosting or email distribution
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { ScratchpadManager } from './scratchpad-manager';

/**
 * Landing page configuration
 */
export interface LandingPageConfig {
  outputDir?: string;
  theme: 'light' | 'dark';
  includeInteractive: boolean; // Tabs, accordions, etc.
  includeAnalytics: boolean; // Google Analytics tracking
  customDomain?: string; // For absolute URLs
}

/**
 * Landing page generation result
 */
export interface LandingPageResult {
  htmlPath: string;
  contentSpecPath: string; // Markdown content spec
  metadata: {
    companyName: string;
    auditId: string;
    generatedAt: Date;
    sectionCount: number;
    citationCount: number;
    interactiveElements: number;
  };
}

/**
 * Landing page section
 */
interface LandingSection {
  id: string;
  title: string;
  content: string;
  citations: string[];
  badges: string[];
}

/**
 * Landing Page Generator
 *
 * Generates professional HTML landing pages from audit scratchpad files
 * with dual-view layout and source attribution.
 */
export class LandingPageGenerator {
  private scratchpad: ScratchpadManager;
  private config: LandingPageConfig;

  constructor(scratchpad: ScratchpadManager, config?: Partial<LandingPageConfig>) {
    this.config = {
      outputDir: config?.outputDir || './deliverables/landing-pages',
      theme: config?.theme || 'light',
      includeInteractive: config?.includeInteractive ?? true,
      includeAnalytics: config?.includeAnalytics ?? false,
      customDomain: config?.customDomain,
    };
    this.scratchpad = scratchpad;
  }

  /**
   * Generate landing page HTML from scratchpad files
   */
  async generateLandingPage(): Promise<LandingPageResult> {
    try {
      logger.info('Starting landing page generation');

      // 1. Read all scratchpad files
      const files = await this.scratchpad.getAllFiles();
      const companyName = this.extractCompanyName(files[0].content || '');

      // 2. Parse scratchpad data into landing page sections
      const sections = await this.parseSections(files);

      // 3. Generate HTML
      const html = this.generateHTML(companyName, sections);

      // 4. Generate content spec (markdown)
      const contentSpec = this.generateContentSpec(companyName, sections);

      // 5. Save files
      await fs.mkdir(this.config.outputDir!, { recursive: true });

      const htmlPath = path.join(
        this.config.outputDir!,
        `${this.sanitizeFileName(companyName)}-landing-page.html`
      );
      const contentSpecPath = path.join(
        this.config.outputDir!,
        `${this.sanitizeFileName(companyName)}-landing-page.md`
      );

      await fs.writeFile(htmlPath, html, 'utf-8');
      await fs.writeFile(contentSpecPath, contentSpec, 'utf-8');

      // 6. Calculate metadata
      const metadata = {
        companyName,
        auditId: this.scratchpad['auditId'],
        generatedAt: new Date(),
        sectionCount: sections.length,
        citationCount: this.countCitations(sections),
        interactiveElements: this.countInteractiveElements(sections),
      };

      logger.info(`Landing page generated: ${htmlPath} (${metadata.sectionCount} sections, ${metadata.citationCount} citations)`);

      return {
        htmlPath,
        contentSpecPath,
        metadata,
      };
    } catch (error) {
      logger.error('Landing page generation failed', error);
      throw new Error(`Landing page generation failed: ${error}`);
    }
  }

  /**
   * Parse scratchpad files into landing page sections
   */
  private async parseSections(files: any[]): Promise<LandingSection[]> {
    const sections: LandingSection[] = [];

    // Hero section
    sections.push({
      id: 'hero',
      title: 'Search Experience Audit',
      content: await this.generateHeroContent(files[0], files[10]),
      citations: [],
      badges: [],
    });

    // Executive summary
    sections.push({
      id: 'executive-summary',
      title: 'Executive Summary',
      content: await this.generateExecutiveSummary(files[10], files[8]),
      citations: this.extractCitations(files[10].content),
      badges: ['CRITICAL'],
    });

    // Company overview
    sections.push({
      id: 'company-overview',
      title: 'Company Overview',
      content: await this.generateCompanyOverview(files[0], files[1], files[2], files[3]),
      citations: [
        ...this.extractCitations(files[0].content),
        ...this.extractCitations(files[1].content),
        ...this.extractCitations(files[2].content),
        ...this.extractCitations(files[3].content),
      ],
      badges: [],
    });

    // Search audit results
    sections.push({
      id: 'audit-results',
      title: 'Search Audit Results',
      content: await this.generateAuditResults(files[10], files[8], files[9]),
      citations: this.extractCitations(files[10].content),
      badges: ['SCORE'],
    });

    // Key findings
    sections.push({
      id: 'key-findings',
      title: 'Key Findings',
      content: await this.generateKeyFindings(files[8]),
      citations: this.extractCitations(files[8].content),
      badges: ['CRITICAL', 'HIGH', 'MEDIUM'],
    });

    // Strategic intelligence
    sections.push({
      id: 'strategic-intelligence',
      title: 'Strategic Intelligence',
      content: await this.generateStrategicIntelligence(files[6], files[7]),
      citations: this.extractCitations(files[6].content),
      badges: ['INTEL'],
    });

    // Competitor landscape
    sections.push({
      id: 'competitors',
      title: 'Competitor Landscape',
      content: await this.generateCompetitorLandscape(files[4]),
      citations: this.extractCitations(files[4].content),
      badges: [],
    });

    // ROI projection
    sections.push({
      id: 'roi',
      title: 'ROI Projection',
      content: await this.generateROISection(files[3], files[2], files[10]),
      citations: [],
      badges: ['ROI'],
    });

    // Recommendations
    sections.push({
      id: 'recommendations',
      title: 'Recommendations',
      content: await this.generateRecommendations(files[11]),
      citations: [],
      badges: ['SOLUTION'],
    });

    // Next steps (CTA)
    sections.push({
      id: 'next-steps',
      title: 'Next Steps',
      content: this.generateNextSteps(),
      citations: [],
      badges: ['CTA'],
    });

    return sections;
  }

  /**
   * Generate complete HTML landing page
   */
  private generateHTML(companyName: string, sections: LandingSection[]): string {
    const css = this.generateCSS();
    const js = this.generateJS();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${companyName} Search Experience Audit by Algolia">
  <title>${companyName} Search Experience Audit — Algolia</title>

  <style>${css}</style>
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="container">
      <div class="header__content">
        <img src="https://www.algolia.com/static/logo-algolia.svg" alt="Algolia" class="header__logo">
        <div class="header__meta">
          <span class="badge badge--white">CONFIDENTIAL</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="main">
    ${sections.map((section) => this.generateSectionHTML(section)).join('\n')}
  </main>

  <!-- Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer__content">
        <p>&copy; ${new Date().getFullYear()} Algolia. All rights reserved.</p>
        <p class="footer__meta">Generated on ${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  </footer>

  ${this.config.includeInteractive ? `<script>${js}</script>` : ''}
  ${this.config.includeAnalytics ? this.generateAnalyticsScript() : ''}
</body>
</html>`;
  }

  /**
   * Generate section HTML
   */
  private generateSectionHTML(section: LandingSection): string {
    const hasSourceBadge = section.citations.length > 0;

    return `
<!-- Section: ${section.title} -->
<section id="${section.id}" class="section ${section.id === 'hero' ? 'section--hero' : ''}">
  <div class="container">
    <div class="section__header">
      <h2 class="section__title">${section.title}</h2>
      ${hasSourceBadge ? `
        <div class="source-badge" data-sources="${section.citations.length}">
          <svg class="source-badge__icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span>${section.citations.length} sources</span>
        </div>
      ` : ''}
    </div>
    <div class="section__content">
      ${section.content}
    </div>
    ${section.citations.length > 0 ? `
      <div class="section__sources">
        <h4>Sources:</h4>
        <ul>
          ${section.citations.map((c) => `<li>${c}</li>`).join('\n')}
        </ul>
      </div>
    ` : ''}
  </div>
</section>
`;
  }

  /**
   * Generate hero content
   */
  private async generateHeroContent(companyContext: any, scoring: any): Promise<string> {
    const companyName = this.extractCompanyName(companyContext.content || '');
    const score = this.extractOverallScore(scoring.content || '');
    const status = this.getScoreStatus(score);

    return `
<div class="hero">
  <div class="hero__content">
    <h1 class="hero__title">${companyName}</h1>
    <p class="hero__subtitle">Search Experience Audit</p>
    <div class="hero__score">
      <div class="score-circle score-circle--${status.toLowerCase()}">
        <span class="score-circle__value">${score.toFixed(1)}</span>
        <span class="score-circle__label">/10</span>
      </div>
      <div class="score-meta">
        <div class="badge badge--${status.toLowerCase()}">${status}</div>
        <p>Overall Search Experience Score</p>
      </div>
    </div>
  </div>
</div>
`;
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(scoring: any, searchTests: any): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const findings = this.extractFindings(searchTests.content || '').slice(0, 3);

    return `
<div class="exec-summary">
  <p class="lead">Our comprehensive search audit reveals ${findings.length} critical gaps impacting conversion rates and customer experience.</p>

  <h3>Top ${findings.length} Findings</h3>
  <div class="findings-grid">
    ${findings.map((f, i) => `
      <div class="finding-card finding-card--${f.severity.toLowerCase()}">
        <div class="finding-card__number">${i + 1}</div>
        <div class="finding-card__content">
          <h4>${f.finding}</h4>
          <p>${f.businessImpact}</p>
          <span class="badge badge--${f.severity.toLowerCase()}">${f.severity}</span>
        </div>
      </div>
    `).join('\n')}
  </div>

  <p class="summary">With optimized search powered by Algolia, you can address these gaps and unlock significant revenue growth through improved conversion rates and customer satisfaction.</p>
</div>
`;
  }

  /**
   * Generate company overview
   */
  private async generateCompanyOverview(
    companyContext: any,
    techStack: any,
    traffic: any,
    financials: any
  ): Promise<string> {
    const industry = this.extractField(companyContext.content, 'Industry');
    const ecommerce = this.extractField(techStack.content, 'E-commerce Platform');
    const searchProvider = this.extractField(techStack.content, 'Search Provider');
    const monthlyVisits = this.extractField(traffic.content, 'Monthly Visits');
    const revenue = this.extractField(financials.content, 'Annual Revenue');

    return `
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-card__icon">🏢</div>
    <div class="stat-card__value">${industry || 'E-commerce'}</div>
    <div class="stat-card__label">Industry</div>
  </div>

  <div class="stat-card">
    <div class="stat-card__icon">💰</div>
    <div class="stat-card__value">${revenue || 'N/A'}</div>
    <div class="stat-card__label">Annual Revenue</div>
    <a href="#" class="source-link">Yahoo Finance</a>
  </div>

  <div class="stat-card">
    <div class="stat-card__icon">📈</div>
    <div class="stat-card__value">${monthlyVisits || 'N/A'}</div>
    <div class="stat-card__label">Monthly Visits</div>
    <a href="#" class="source-link">SimilarWeb</a>
  </div>

  <div class="stat-card">
    <div class="stat-card__icon">🛒</div>
    <div class="stat-card__value">${ecommerce || 'Unknown'}</div>
    <div class="stat-card__label">E-commerce Platform</div>
    <a href="#" class="source-link">BuiltWith</a>
  </div>

  <div class="stat-card">
    <div class="stat-card__icon">🔍</div>
    <div class="stat-card__value">${searchProvider || 'Unknown'}</div>
    <div class="stat-card__label">Current Search Provider</div>
    <a href="#" class="source-link">BuiltWith</a>
  </div>
</div>
`;
  }

  /**
   * Generate audit results with scoring table
   */
  private async generateAuditResults(scoring: any, searchTests: any, screenshots: any): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const dimensions = this.extractScoringDimensions(scoring.content || '');

    return `
<div class="audit-results">
  <div class="score-breakdown">
    <table class="scoring-table">
      <thead>
        <tr>
          <th>Dimension</th>
          <th>Score</th>
          <th>Status</th>
          <th>Key Finding</th>
        </tr>
      </thead>
      <tbody>
        ${dimensions.map((d) => `
          <tr>
            <td><strong>${d.name}</strong></td>
            <td class="score-cell">${d.score}/10</td>
            <td class="status-cell">${d.status}</td>
            <td>${d.keyFinding}</td>
          </tr>
        `).join('\n')}
      </tbody>
    </table>
  </div>

  <div class="interpretation">
    <h4>Score Interpretation</h4>
    <p>${this.interpretScore(score)}</p>
  </div>
</div>
`;
  }

  /**
   * Generate key findings with screenshots
   */
  private async generateKeyFindings(searchTests: any): Promise<string> {
    const findings = this.extractFindings(searchTests.content || '');

    // Group by severity
    const critical = findings.filter((f) => f.severity === 'CRITICAL');
    const high = findings.filter((f) => f.severity === 'HIGH');
    const medium = findings.filter((f) => f.severity === 'MEDIUM');

    return `
${this.config.includeInteractive ? `
<div class="findings-tabs">
  <div class="tabs">
    <button class="tab tab--active" data-tab="critical">Critical (${critical.length})</button>
    <button class="tab" data-tab="high">High (${high.length})</button>
    <button class="tab" data-tab="medium">Medium (${medium.length})</button>
  </div>

  <div class="tab-content tab-content--active" id="tab-critical">
    ${this.generateFindingsHTML(critical)}
  </div>

  <div class="tab-content" id="tab-high">
    ${this.generateFindingsHTML(high)}
  </div>

  <div class="tab-content" id="tab-medium">
    ${this.generateFindingsHTML(medium)}
  </div>
</div>
` : `
<div class="findings-list">
  <h3>Critical Findings</h3>
  ${this.generateFindingsHTML(critical)}

  <h3>High Priority Findings</h3>
  ${this.generateFindingsHTML(high)}

  <h3>Medium Priority Findings</h3>
  ${this.generateFindingsHTML(medium)}
</div>
`}
`;
  }

  /**
   * Generate findings HTML
   */
  private generateFindingsHTML(findings: any[]): string {
    return findings
      .map(
        (f) => `
<div class="finding">
  <div class="finding__header">
    <h4>${f.finding}</h4>
    <span class="badge badge--${f.severity.toLowerCase()}">${f.severity}</span>
  </div>
  <div class="finding__body">
    <p><strong>Evidence:</strong> ${f.evidence}</p>
    ${f.screenshotPath ? `<img src="${f.screenshotPath}" alt="${f.finding}" class="finding__screenshot">` : ''}
    <p><strong>Business Impact:</strong> ${f.businessImpact}</p>
    <div class="algolia-solution">
      <strong>Algolia Solution:</strong> ${f.algoliaProduct}
    </div>
  </div>
</div>
`
      )
      .join('\n');
  }

  /**
   * Generate strategic intelligence
   */
  private async generateStrategicIntelligence(intel: any, strategic: any): Promise<string> {
    const quotes = this.extractExecutiveQuotes(intel.content || '').slice(0, 3);
    const triggerEvents = this.extractTriggerEvents(strategic.content || '');

    return `
<div class="strategic-intel">
  <h3>Why Now?</h3>
  ${triggerEvents.length > 0 ? `
    <ul class="trigger-events">
      ${triggerEvents.map((e) => `<li><strong>${e.type}:</strong> ${e.description}</li>`).join('\n')}
    </ul>
  ` : '<p><em>No significant trigger events identified.</em></p>'}

  <h3>In Their Own Words</h3>
  ${quotes.length > 0 ? `
    <div class="exec-quotes">
      ${quotes.map((q) => `
        <blockquote class="exec-quote">
          <p>"${q.quote}"</p>
          <footer>— ${q.speaker}, ${q.title}</footer>
          <a href="${q.sourceUrl || '#'}" class="source-link">${q.source}, ${q.date}</a>
        </blockquote>
      `).join('\n')}
    </div>
  ` : '<p><em>No recent executive quotes available.</em></p>'}
</div>
`;
  }

  /**
   * Generate competitor landscape
   */
  private async generateCompetitorLandscape(competitors: any): Promise<string> {
    const competitorList = this.extractCompetitors(competitors.content || '');

    return `
<div class="competitors-grid">
  ${competitorList.map((c) => `
    <div class="competitor-card">
      <h4>${c.name}</h4>
      <p><strong>Domain:</strong> <a href="https://${c.domain}" target="_blank">${c.domain}</a></p>
      <p><strong>Search Provider:</strong> ${c.searchProvider || 'Unknown'}</p>
      <p><strong>Affinity Score:</strong> ${c.affinityScore || 'N/A'}</p>
    </div>
  `).join('\n')}
</div>
`;
  }

  /**
   * Generate ROI projection section
   */
  private async generateROISection(financials: any, traffic: any, scoring: any): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const revenue = this.extractAnnualRevenue(financials.content || '');
    const gap = 10 - score;
    const liftFactor = gap / 10;
    const expectedLift = Math.round(15 + liftFactor * 10);
    const additionalRevenue = revenue * (expectedLift / 100);

    return `
<div class="roi-projection">
  <div class="roi-chart">
    <svg viewBox="0 0 500 300" class="funnel-chart">
      <defs>
        <linearGradient id="funnel-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#003DFF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#5468FF;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- 3-tier funnel -->
      <polygon points="160,50 340,50 320,130 180,130" fill="url(#funnel-gradient)" opacity="0.9"/>
      <polygon points="180,130 320,130 305,210 195,210" fill="url(#funnel-gradient)" opacity="0.7"/>
      <polygon points="195,210 305,210 305,280 195,280" fill="url(#funnel-gradient)" opacity="0.5"/>

      <text x="250" y="90" text-anchor="middle" fill="white" font-size="16" font-weight="700">Traffic</text>
      <text x="250" y="170" text-anchor="middle" fill="white" font-size="16" font-weight="700">Search: 40%</text>
      <text x="250" y="250" text-anchor="middle" fill="white" font-size="16" font-weight="700">+$${(additionalRevenue / 1000000).toFixed(1)}M</text>
    </svg>
  </div>

  <div class="roi-details">
    <h3>Revenue Impact</h3>
    <div class="roi-stats">
      <div class="roi-stat">
        <div class="roi-stat__value">${expectedLift}%</div>
        <div class="roi-stat__label">Expected Conversion Lift</div>
      </div>
      <div class="roi-stat">
        <div class="roi-stat__value">$${(additionalRevenue / 1000000).toFixed(1)}M</div>
        <div class="roi-stat__label">Additional Revenue (Year 1)</div>
      </div>
    </div>

    <p class="roi-disclaimer"><em>Based on industry benchmarks: 40% of e-commerce revenue is search-influenced, with optimized search typically delivering 15-25% conversion lift.</em></p>
  </div>
</div>
`;
  }

  /**
   * Generate recommendations section
   */
  private async generateRecommendations(recommendations: any): Promise<string> {
    const content = recommendations.content || '';
    const immediate = this.extractList(content, 'Immediate Actions');
    const shortTerm = this.extractList(content, 'Short-Term');
    const longTerm = this.extractList(content, 'Long-Term');

    return `
<div class="recommendations">
  <div class="timeline">
    <h3>Immediate Actions (30-60 days)</h3>
    ${immediate.length > 0 ? `<ol>${immediate.map((r) => `<li>${r.description}</li>`).join('\n')}</ol>` : '<p><em>No immediate actions identified.</em></p>'}

    <h3>Short-Term (60-90 days)</h3>
    ${shortTerm.length > 0 ? `<ol>${shortTerm.map((r) => `<li>${r.description}</li>`).join('\n')}</ol>` : '<p><em>No short-term actions identified.</em></p>'}

    <h3>Long-Term (6-12 months)</h3>
    ${longTerm.length > 0 ? `<ol>${longTerm.map((r) => `<li>${r.description}</li>`).join('\n')}</ol>` : '<p><em>No long-term actions identified.</em></p>'}
  </div>
</div>
`;
  }

  /**
   * Generate next steps (CTA section)
   */
  private generateNextSteps(): string {
    return `
<div class="cta-section">
  <h3>Ready to Optimize Your Search Experience?</h3>
  <p>Schedule a follow-up session with our team to discuss implementation.</p>
  <a href="mailto:sales@algolia.com?subject=Search%20Audit%20Follow-Up" class="btn btn--primary">Contact Us</a>
  <a href="https://www.algolia.com/doc/" target="_blank" class="btn btn--secondary">View Documentation</a>
</div>
`;
  }

  /**
   * Generate content spec (markdown)
   */
  private generateContentSpec(companyName: string, sections: LandingSection[]): string {
    return `# ${companyName} Landing Page Content Spec

**Generated**: ${new Date().toISOString()}

---

${sections.map((section) => `
## ${section.title}

**Section ID**: \`${section.id}\`
**Citations**: ${section.citations.length}
**Badges**: ${section.badges.join(', ')}

${section.content}

${section.citations.length > 0 ? `
### Sources
${section.citations.map((c, i) => `${i + 1}. ${c}`).join('\n')}
` : ''}

---
`).join('\n')}

## Technical Notes

- **Theme**: ${this.config.theme}
- **Interactive Elements**: ${this.config.includeInteractive ? 'Enabled' : 'Disabled'}
- **Analytics**: ${this.config.includeAnalytics ? 'Enabled' : 'Disabled'}
- **Custom Domain**: ${this.config.customDomain || 'Not set'}

---

Generated by Algolia Arian
`;
  }

  /**
   * Generate inline CSS
   */
  private generateCSS(): string {
    return `
/* Reset & Base */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #21243D; background: #f9fafb; }
a { color: #003DFF; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Container */
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* Header */
.header { background: #21243D; padding: 20px 0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.header__content { display: flex; justify-content: space-between; align-items: center; }
.header__logo { height: 32px; }

/* Hero Section */
.section--hero { background: linear-gradient(135deg, #21243D 0%, #003DFF 60%, #5468FF 100%); color: white; padding: 80px 0; text-align: center; }
.hero__title { font-size: 3rem; font-weight: 900; margin-bottom: 12px; }
.hero__subtitle { font-size: 1.5rem; opacity: 0.9; margin-bottom: 40px; }
.hero__score { display: flex; justify-content: center; align-items: center; gap: 32px; }
.score-circle { width: 140px; height: 140px; border-radius: 50%; background: rgba(255, 255, 255, 0.1); border: 4px solid rgba(255, 255, 255, 0.3); display: flex; flex-direction: column; justify-content: center; align-items: center; }
.score-circle__value { font-size: 3rem; font-weight: 900; }
.score-circle__label { font-size: 1.2rem; opacity: 0.8; }
.score-meta { text-align: left; }

/* Sections */
.section { padding: 60px 0; }
.section__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; border-bottom: 3px solid #003DFF; padding-bottom: 16px; }
.section__title { font-size: 2rem; font-weight: 700; color: #003DFF; }
.source-badge { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #ecfdf5; border: 2px solid #059669; border-radius: 8px; color: #059669; font-size: 0.9rem; font-weight: 600; }
.source-badge__icon { width: 20px; height: 20px; }

/* Badges */
.badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
.badge--critical { background: #dc2626; color: white; }
.badge--high { background: #f59e0b; color: white; }
.badge--medium { background: #3b82f6; color: white; }
.badge--white { background: white; color: #21243D; }
.badge--positive { background: #059669; color: white; }
.badge--excellent { background: #059669; color: white; }
.badge--good { background: #3b82f6; color: white; }
.badge--fair { background: #f59e0b; color: white; }
.badge--poor { background: #dc2626; color: white; }

/* Stats Grid */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin: 32px 0; }
.stat-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); text-align: center; }
.stat-card__icon { font-size: 2.5rem; margin-bottom: 12px; }
.stat-card__value { font-size: 1.5rem; font-weight: 700; color: #003DFF; margin-bottom: 8px; }
.stat-card__label { font-size: 0.9rem; color: #64748b; }
.source-link { display: block; margin-top: 8px; font-size: 0.8rem; color: #059669; }

/* Findings */
.findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin: 32px 0; }
.finding-card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); border-left: 4px solid #dc2626; }
.finding-card--high { border-left-color: #f59e0b; }
.finding-card--medium { border-left-color: #3b82f6; }
.finding-card__number { font-size: 2rem; font-weight: 900; color: #003DFF; margin-bottom: 12px; }
.finding-card__content h4 { margin-bottom: 12px; }
.finding { background: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.finding__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.finding__screenshot { width: 100%; border-radius: 8px; margin: 16px 0; }
.algolia-solution { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 2px solid #059669; border-radius: 8px; padding: 12px 16px; margin-top: 16px; }

/* Scoring Table */
.scoring-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
.scoring-table th, .scoring-table td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
.scoring-table th { background: #f9fafb; font-weight: 700; }
.score-cell { font-weight: 700; color: #003DFF; }
.status-cell { font-size: 1.5rem; }

/* Tabs */
.tabs { display: flex; gap: 16px; border-bottom: 2px solid #e5e7eb; margin-bottom: 24px; }
.tab { padding: 12px 24px; background: none; border: none; font-size: 1rem; font-weight: 600; color: #64748b; cursor: pointer; border-bottom: 3px solid transparent; }
.tab--active { color: #003DFF; border-bottom-color: #003DFF; }
.tab-content { display: none; }
.tab-content--active { display: block; }

/* ROI Projection */
.roi-projection { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); }
.funnel-chart { max-width: 500px; margin: 0 auto; }
.roi-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin: 24px 0; }
.roi-stat { text-align: center; }
.roi-stat__value { font-size: 2.5rem; font-weight: 900; color: #003DFF; }
.roi-stat__label { font-size: 0.9rem; color: #64748b; margin-top: 8px; }

/* CTA Section */
.cta-section { background: linear-gradient(135deg, #003DFF, #5468FF); color: white; border-radius: 12px; padding: 48px; text-align: center; margin: 48px 0; }
.cta-section h3 { font-size: 2rem; margin-bottom: 16px; }
.btn { display: inline-block; padding: 14px 32px; border-radius: 8px; font-weight: 600; margin: 8px; transition: all 0.2s; }
.btn--primary { background: white; color: #003DFF; }
.btn--primary:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2); }
.btn--secondary { background: rgba(255, 255, 255, 0.1); color: white; border: 2px solid white; }
.btn--secondary:hover { background: rgba(255, 255, 255, 0.2); }

/* Footer */
.footer { background: #21243D; color: white; padding: 32px 0; text-align: center; }
.footer__meta { font-size: 0.9rem; opacity: 0.7; margin-top: 8px; }

/* Responsive */
@media (max-width: 768px) {
  .hero__title { font-size: 2rem; }
  .hero__score { flex-direction: column; }
  .stats-grid { grid-template-columns: 1fr; }
  .findings-grid { grid-template-columns: 1fr; }
  .tabs { flex-wrap: wrap; }
}
`;
  }

  /**
   * Generate interactive JavaScript
   */
  private generateJS(): string {
    return `
// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab');

    // Remove active from all tabs and contents
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('tab--active'));
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('tab-content--active'));

    // Add active to clicked tab and target content
    tab.classList.add('tab--active');
    document.getElementById('tab-' + targetTab).classList.add('tab-content--active');
  });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
`;
  }

  /**
   * Generate analytics script
   */
  private generateAnalyticsScript(): string {
    return `
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=UA-XXXXXXXXX-X"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'UA-XXXXXXXXX-X');
</script>
`;
  }

  // ========================================
  // HELPER METHODS (same as PDF generator)
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

  private extractScreenshotPath(content: string): string | undefined {
    const match = content.match(/!\[.*?\]\((.+?)\)/);
    return match ? match[1] : undefined;
  }

  private extractCitations(content: string): string[] {
    const citations: string[] = [];
    const matches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

    for (const match of matches) {
      citations.push(`${match[1]}: ${match[2]}`);
    }

    return citations;
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

  private countCitations(sections: LandingSection[]): number {
    return sections.reduce((count, section) => count + section.citations.length, 0);
  }

  private countInteractiveElements(sections: LandingSection[]): number {
    // Count tabs, accordions, etc.
    return this.config.includeInteractive ? sections.filter((s) => s.id === 'key-findings').length * 3 : 0;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Factory function for creating landing page generator
 */
export function createLandingPageGenerator(
  scratchpad: ScratchpadManager,
  config?: Partial<LandingPageConfig>
): LandingPageGenerator {
  return new LandingPageGenerator(scratchpad, config);
}
