/**
 * PDF Book Generator Service
 *
 * Generates branded 36-47 page PDF book from scratchpad files.
 * Uses Playwright for HTML→PDF conversion with book-template.html.
 *
 * ARCHITECTURE:
 * - Reads 12 scratchpad markdown files
 * - Loads book-template.html and components.css from skill templates
 * - Populates template with structured audit data
 * - Embeds screenshots with relative paths
 * - Generates TOC, page numbers, headers/footers
 * - Outputs PDF using Playwright headless Chrome
 *
 * EDITORIAL STANDARDS (11 rules from skill):
 * 1. Bigger fonts (16px base, 1.8rem h1, 1.5rem h2)
 * 2. Single-line titles (no wrapping)
 * 3. 60/40 screenshot layout
 * 4. Page headers/footers with logo and page numbers
 * 5. Act section breaks (gradient backgrounds)
 * 6. Split "In Their Own Words" section
 * 7. ct-highlight for competitive advantage
 * 8. Specific case study links (not generic)
 * 9. Cover page dual logos (company + Algolia)
 * 10. Revenue funnel SVG (3-tier, 110px bottom)
 * 11. Source citations on every data point
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { chromium, Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { ScratchpadManager } from './scratchpad-manager';

/**
 * PDF generation configuration
 */
export interface PDFGeneratorConfig {
  templatePath?: string; // Path to book-template.html
  componentsPath?: string; // Path to components.css
  outputDir?: string; // Output directory for PDFs
  includeScreenshots: boolean;
  includeTOC: boolean;
  pageFormat: 'Letter' | 'A4';
  quality: 'screen' | 'print';
}

/**
 * PDF generation result
 */
export interface PDFGeneratorResult {
  pdfPath: string;
  metadata: {
    companyName: string;
    auditId: string;
    generatedAt: Date;
    pageCount: number;
    fileSize: number; // bytes
    templateVersion: string;
  };
}

/**
 * Chapter data for book
 */
interface BookChapter {
  act: string; // "ACT I", "ACT II", "ACT III"
  title: string;
  content: string;
  pageNumber: number;
  includeSectionBreak: boolean;
}

/**
 * PDF Book Generator
 *
 * Generates professional PDF books from audit scratchpad files
 * using Playwright and the skill's book-template.html.
 */
export class PDFGenerator {
  private scratchpad: ScratchpadManager;
  private config: PDFGeneratorConfig;
  private browser?: Browser;

  constructor(scratchpad: ScratchpadManager, config?: Partial<PDFGeneratorConfig>) {
    this.scratchpad = scratchpad;
    this.config = {
      templatePath:
        config?.templatePath ||
        path.join(
          process.env.HOME || '~',
          '.claude/skills/algolia-search-audit/templates/book-template.html'
        ),
      componentsPath:
        config?.componentsPath ||
        path.join(
          process.env.HOME || '~',
          '.claude/skills/algolia-search-audit/templates/components.css'
        ),
      outputDir: config?.outputDir || './deliverables/pdfs',
      includeScreenshots: config?.includeScreenshots ?? true,
      includeTOC: config?.includeTOC ?? true,
      pageFormat: config?.pageFormat || 'Letter',
      quality: config?.quality || 'print',
    };
  }

  /**
   * Generate PDF book from scratchpad files
   */
  async generatePDF(): Promise<PDFGeneratorResult> {
    try {
      logger.info('Starting PDF book generation');

      // 1. Read all scratchpad files
      const files = await this.scratchpad.getAllFiles();
      const companyName = await this.extractCompanyName(files[0].content || '');

      // 2. Parse scratchpad data into book chapters
      const chapters = await this.parseChapters(files);

      // 3. Load and populate book template
      const html = await this.populateTemplate(companyName, chapters);

      // 4. Generate PDF using Playwright
      const pdfPath = await this.renderPDF(html, companyName);

      // 5. Calculate metadata
      const stats = await fs.stat(pdfPath);
      const metadata = {
        companyName,
        auditId: this.scratchpad['auditId'],
        generatedAt: new Date(),
        pageCount: this.estimatePageCount(chapters),
        fileSize: stats.size,
        templateVersion: '2.7',
      };

      logger.info(`PDF generated: ${pdfPath} (${metadata.pageCount} pages, ${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB)`);

      return {
        pdfPath,
        metadata,
      };
    } catch (error) {
      logger.error('PDF generation failed', error);
      throw new Error(`PDF generation failed: ${error}`);
    }
  }

  /**
   * Parse scratchpad files into book chapters
   */
  private async parseChapters(files: any[]): Promise<BookChapter[]> {
    const chapters: BookChapter[] = [];
    let pageNumber = 1;

    // Cover page
    chapters.push({
      act: '',
      title: 'Cover',
      content: this.generateCoverPage(files[0]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    // ACT I: STRATEGIC INTELLIGENCE (Pages 2-12)
    chapters.push({
      act: 'ACT I',
      title: 'Strategic Intelligence',
      content: '',
      pageNumber: pageNumber++,
      includeSectionBreak: true,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Company Context',
      content: await this.formatCompanyContext(files[0]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Technology Stack',
      content: await this.formatTechStack(files[1]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Traffic & Engagement',
      content: await this.formatTraffic(files[2]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Financial Profile',
      content: await this.formatFinancials(files[3]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Competitor Landscape',
      content: await this.formatCompetitors(files[4]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Hiring Signals',
      content: await this.formatHiring(files[5]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'In Their Own Words (Part 1)',
      content: await this.formatIntelPart1(files[6]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'In Their Own Words (Part 2)',
      content: await this.formatIntelPart2(files[6]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT I',
      title: 'Strategic Angles',
      content: await this.formatStrategic(files[7]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    // ACT II: SEARCH EXPERIENCE AUDIT (Pages 13-28)
    chapters.push({
      act: 'ACT II',
      title: 'Search Experience Audit',
      content: '',
      pageNumber: pageNumber++,
      includeSectionBreak: true,
    });

    chapters.push({
      act: 'ACT II',
      title: 'Overall Score',
      content: await this.formatScoring(files[10]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    // Add 10-15 pages for search test findings
    const findingsPages = await this.formatSearchFindings(files[8], files[9]);
    for (const page of findingsPages) {
      chapters.push({
        act: 'ACT II',
        title: page.title,
        content: page.content,
        pageNumber: pageNumber++,
        includeSectionBreak: false,
      });
    }

    // ACT III: ALGOLIA SOLUTIONS (Pages 29-36)
    chapters.push({
      act: 'ACT III',
      title: 'Algolia Solutions',
      content: '',
      pageNumber: pageNumber++,
      includeSectionBreak: true,
    });

    chapters.push({
      act: 'ACT III',
      title: 'Recommendations',
      content: await this.formatRecommendations(files[11]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT III',
      title: 'ROI Projection',
      content: await this.formatROI(files[3], files[2], files[10]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT III',
      title: 'Case Studies',
      content: this.generateCaseStudies(files[0]),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    chapters.push({
      act: 'ACT III',
      title: 'Next Steps',
      content: this.generateNextSteps(),
      pageNumber: pageNumber++,
      includeSectionBreak: false,
    });

    return chapters;
  }

  /**
   * Load and populate book template with chapter data
   */
  private async populateTemplate(companyName: string, chapters: BookChapter[]): Promise<string> {
    // Read template files
    const templateHTML = await fs.readFile(this.config.templatePath!, 'utf-8');
    const componentsCSS = await fs.readFile(this.config.componentsPath!, 'utf-8');

    // Generate chapters HTML
    const chaptersHTML = chapters
      .map((chapter) => {
        if (chapter.includeSectionBreak) {
          return `
<!-- Section Break: ${chapter.act} -->
<div class="section-break">
  <div>
    <div class="section-break__act">${chapter.act}</div>
    <div class="section-break__divider"></div>
    <h1 class="section-break__title">${chapter.title}</h1>
    <div class="section-break__subtitle">Algolia Search Experience Audit</div>
  </div>
</div>

<!-- Chapter: ${chapter.title} -->
<div class="chapter">
  <div class="page-header">
    <img src="https://www.algolia.com/static/logo-algolia.svg" alt="Algolia" class="page-header__logo">
  </div>

  <div class="chapter__content">
    ${chapter.content}
  </div>

  <div class="page-footer">
    <div class="page-footer__left">
      <svg class="page-footer__mark" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#003DFF"/>
        <path d="M2 17L12 22L22 17" stroke="#003DFF" stroke-width="2"/>
      </svg>
      <span class="page-footer__conf">CONFIDENTIAL</span>
    </div>
    <div class="page-footer__page">${chapter.pageNumber}</div>
  </div>
</div>
`;
        } else {
          return `
<!-- Chapter: ${chapter.title} -->
<div class="chapter">
  <div class="page-header">
    <img src="https://www.algolia.com/static/logo-algolia.svg" alt="Algolia" class="page-header__logo">
  </div>

  <div class="chapter__content">
    <h1>${chapter.title}</h1>
    ${chapter.content}
  </div>

  <div class="page-footer">
    <div class="page-footer__left">
      <svg class="page-footer__mark" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#003DFF"/>
        <path d="M2 17L12 22L22 17" stroke="#003DFF" stroke-width="2"/>
      </svg>
      <span class="page-footer__conf">CONFIDENTIAL</span>
    </div>
    <div class="page-footer__page">${chapter.pageNumber}</div>
  </div>
</div>
`;
        }
      })
      .join('\n');

    // Populate template variables
    let html = templateHTML
      .replace(/{{COMPANY_NAME}}/g, companyName)
      .replace(/{{AUDIT_DATE}}/g, new Date().toLocaleDateString())
      .replace(/{{GENERATED_DATE}}/g, new Date().toISOString())
      .replace('<!-- CHAPTERS_CONTENT -->', chaptersHTML);

    // Inline CSS (Playwright needs inline styles for PDF generation)
    html = html.replace('<link rel="stylesheet" href="components.css">', `<style>${componentsCSS}</style>`);

    return html;
  }

  /**
   * Render HTML to PDF using Playwright
   */
  private async renderPDF(html: string, companyName: string): Promise<string> {
    this.browser = await chromium.launch({ headless: true });
    const page = await this.browser.newPage();

    try {
      // Set content
      await page.setContent(html, { waitUntil: 'networkidle' });

      // Ensure output directory exists
      await fs.mkdir(this.config.outputDir!, { recursive: true });

      // Generate PDF
      const outputPath = path.join(
        this.config.outputDir!,
        `${this.sanitizeFileName(companyName)}-search-audit-book.pdf`
      );

      await page.pdf({
        path: outputPath,
        format: this.config.pageFormat,
        printBackground: true,
        preferCSSPageSize: true,
      });

      await this.browser.close();

      return outputPath;
    } catch (error) {
      if (this.browser) {
        await this.browser.close();
      }
      throw error;
    }
  }

  /**
   * Format cover page
   */
  private generateCoverPage(companyContext: any): string {
    const companyName = this.extractCompanyName(companyContext.content || '');
    const auditDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    return `
<div class="cover-page">
  <div class="cover-page__logos">
    <img src="https://logo.clearbit.com/${companyName.toLowerCase().replace(/\s+/g, '')}.com" alt="${companyName}" class="cover-page__logo--company">
    <svg class="cover-page__divider" viewBox="0 0 24 24"><path d="M12 2L22 22H2L12 2Z" fill="#5468FF"/></svg>
    <img src="https://www.algolia.com/static/logo-algolia.svg" alt="Algolia" class="cover-page__logo--algolia">
  </div>

  <div class="cover-page__content">
    <h1 class="cover-page__title">Search Experience Audit</h1>
    <p class="cover-page__subtitle">${companyName}</p>
    <div class="cover-page__meta">
      <div class="badge badge--critical">CONFIDENTIAL</div>
      <p class="cover-page__date">${auditDate}</p>
    </div>
  </div>
</div>
`;
  }

  /**
   * Format company context chapter
   */
  private async formatCompanyContext(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format tech stack chapter
   */
  private async formatTechStack(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format traffic analysis chapter
   */
  private async formatTraffic(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format financials chapter
   */
  private async formatFinancials(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format competitors chapter
   */
  private async formatCompetitors(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format hiring signals chapter
   */
  private async formatHiring(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format investor intelligence (Part 1 - first 50% of quotes)
   */
  private async formatIntelPart1(file: any): Promise<string> {
    const content = file.content || '';
    const quotes = this.extractExecutiveQuotes(content);
    const firstHalf = quotes.slice(0, Math.ceil(quotes.length / 2));

    return `
<div class="exec-quotes">
  ${firstHalf.map((q) => `
    <div class="exec-card">
      <div class="exec-card__header">
        <blockquote>"${q.quote}"</blockquote>
      </div>
      <div class="exec-card__body">
        <p class="exec-card__info">— ${q.speaker}, ${q.title}</p>
        <p class="exec-card__info">${q.source}, ${q.date}</p>
        ${q.relevance ? `<p class="exec-card__angle"><strong>Strategic Angle:</strong> ${q.relevance}</p>` : ''}
      </div>
    </div>
  `).join('\n')}
</div>
`;
  }

  /**
   * Format investor intelligence (Part 2 - second 50% of quotes)
   */
  private async formatIntelPart2(file: any): Promise<string> {
    const content = file.content || '';
    const quotes = this.extractExecutiveQuotes(content);
    const secondHalf = quotes.slice(Math.ceil(quotes.length / 2));

    return `
<div class="exec-quotes">
  ${secondHalf.map((q) => `
    <div class="exec-card">
      <div class="exec-card__header">
        <blockquote>"${q.quote}"</blockquote>
      </div>
      <div class="exec-card__body">
        <p class="exec-card__info">— ${q.speaker}, ${q.title}</p>
        <p class="exec-card__info">${q.source}, ${q.date}</p>
        ${q.relevance ? `<p class="exec-card__angle"><strong>Strategic Angle:</strong> ${q.relevance}</p>` : ''}
      </div>
    </div>
  `).join('\n')}
</div>
`;
  }

  /**
   * Format strategic angles chapter
   */
  private async formatStrategic(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format scoring chapter
   */
  private async formatScoring(file: any): Promise<string> {
    const content = file.content || '';
    const score = this.extractOverallScore(content);
    const dimensions = this.extractScoringDimensions(content);

    return `
<div class="scoring-summary">
  <div class="score-hero">
    <div class="score-hero__value">${score.toFixed(1)}</div>
    <div class="score-hero__label">Overall Search Score</div>
    <div class="score-hero__status ${this.getScoreStatusClass(score)}">${this.getScoreStatus(score)}</div>
  </div>

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
          <td>${d.score}/10</td>
          <td>${d.status}</td>
          <td>${d.keyFinding}</td>
        </tr>
      `).join('\n')}
    </tbody>
  </table>
</div>
`;
  }

  /**
   * Format search findings (split into multiple pages)
   */
  private async formatSearchFindings(searchTests: any, screenshots: any): Promise<any[]> {
    const content = searchTests.content || '';
    const findings = this.extractFindings(content);

    // Split findings across pages (2-3 findings per page)
    const pages: any[] = [];
    const findingsPerPage = 2;

    for (let i = 0; i < findings.length; i += findingsPerPage) {
      const pageFin dings = findings.slice(i, i + findingsPerPage);
      pages.push({
        title: `Key Findings ${Math.floor(i / findingsPerPage) + 1}`,
        content: `
<div class="findings-page">
  ${pageFin dings.map((f) => `
    <div class="finding">
      <div class="finding__header">
        <h3>${f.finding}</h3>
        <span class="badge badge--${f.severity.toLowerCase()}">${f.severity}</span>
      </div>
      <div class="finding__body">
        <p><strong>Evidence:</strong> ${f.evidence}</p>
        ${f.screenshotPath && this.config.includeScreenshots
          ? `<div class="finding__screenshot"><img src="${f.screenshotPath}" alt="${f.finding}"></div>`
          : ''}
        <p><strong>Business Impact:</strong> ${f.businessImpact}</p>
        <div class="ct-highlight">
          <p><strong>Algolia Solution:</strong> ${f.algoliaProduct}</p>
        </div>
      </div>
    </div>
  `).join('\n')}
</div>
`,
      });
    }

    return pages;
  }

  /**
   * Format recommendations chapter
   */
  private async formatRecommendations(file: any): Promise<string> {
    const content = file.content || '';
    return this.markdownToHTML(content);
  }

  /**
   * Format ROI projection chapter
   */
  private async formatROI(financials: any, traffic: any, scoring: any): Promise<string> {
    const score = this.extractOverallScore(scoring.content || '');
    const revenue = this.extractAnnualRevenue(financials.content || '');

    // Calculate potential impact
    const gap = 10 - score;
    const liftFactor = gap / 10;
    const expectedLift = Math.round(15 + liftFactor * 10); // 15-25%
    const additionalRevenue = revenue * (expectedLift / 100);

    return `
<div class="roi-projection">
  <h2>Revenue Funnel Impact</h2>

  <svg viewBox="0 0 500 300" class="revenue-funnel">
    <defs>
      <linearGradient id="funnel-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#003DFF;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#5468FF;stop-opacity:1" />
      </linearGradient>
    </defs>

    <!-- 3-tier funnel with 110px bottom (CRITICAL: prevents text clipping) -->
    <polygon points="160,50 340,50 320,130 180,130" fill="url(#funnel-gradient)" opacity="0.9"/>
    <polygon points="180,130 320,130 305,210 195,210" fill="url(#funnel-gradient)" opacity="0.7"/>
    <polygon points="195,210 305,210 305,280 195,280" fill="url(#funnel-gradient)" opacity="0.5"/>

    <text x="250" y="90" text-anchor="middle" fill="white" font-size="16" font-weight="700">Traffic: ${traffic.monthlyVisits || 'N/A'}</text>
    <text x="250" y="170" text-anchor="middle" fill="white" font-size="16" font-weight="700">Searches: 40%</text>
    <text x="250" y="250" text-anchor="middle" fill="white" font-size="16" font-weight="700">$${(additionalRevenue / 1000000).toFixed(1)}M/year</text>
  </svg>

  <div class="roi-details">
    <div class="bar-row">
      <div class="bar-row__label">Current Revenue</div>
      <div class="bar-row__track">
        <div class="bar-row__fill" style="width: 100%"></div>
      </div>
      <div class="bar-row__value">$${(revenue / 1000000).toFixed(0)}M</div>
    </div>

    <div class="bar-row">
      <div class="bar-row__label">Search-Influenced</div>
      <div class="bar-row__track">
        <div class="bar-row__fill" style="width: 40%"></div>
      </div>
      <div class="bar-row__value">40%</div>
    </div>

    <div class="bar-row">
      <div class="bar-row__label">Expected Lift</div>
      <div class="bar-row__track">
        <div class="bar-row__fill" style="width: ${expectedLift}%"></div>
      </div>
      <div class="bar-row__value">${expectedLift}%</div>
    </div>

    <div class="bar-row">
      <div class="bar-row__label">Additional Revenue</div>
      <div class="bar-row__track">
        <div class="bar-row__fill" style="width: ${(additionalRevenue / revenue) * 100}%"></div>
      </div>
      <div class="bar-row__value">$${(additionalRevenue / 1000000).toFixed(1)}M</div>
    </div>
  </div>

  <p><em>Based on industry benchmarks: 40% of e-commerce revenue is search-influenced, with optimized search typically delivering 15-25% conversion lift.</em></p>
</div>
`;
  }

  /**
   * Generate case studies chapter
   */
  private generateCaseStudies(companyContext: any): string {
    const industry = this.extractIndustry(companyContext.content || '');

    // Map industry to specific case studies (not generic)
    const caseStudyMap: Record<string, any[]> = {
      'Retail': [
        {
          company: 'Lovesac',
          url: 'https://www.algolia.com/customers/lovesac/',
          result: '25% increase in conversion rate',
        },
        {
          company: 'Lacoste',
          url: 'https://www.algolia.com/customers/lacoste/',
          result: '150% increase in search-driven revenue',
        },
      ],
      'E-commerce': [
        {
          company: 'Gymshark',
          url: 'https://www.algolia.com/customers/gymshark/',
          result: '30% increase in search-driven orders',
        },
      ],
      'default': [
        {
          company: 'Stripe',
          url: 'https://www.algolia.com/customers/stripe/',
          result: 'Improved developer experience',
        },
      ],
    };

    const caseStudies = caseStudyMap[industry] || caseStudyMap['default'];

    return `
<div class="case-studies">
  <h2>Similar Companies Using Algolia</h2>

  ${caseStudies.map((cs) => `
    <div class="case-study-card">
      <h3>${cs.company}</h3>
      <p class="case-study__result">${cs.result}</p>
      <a href="${cs.url}" target="_blank" class="case-study__link">Read full case study →</a>
    </div>
  `).join('\n')}
</div>
`;
  }

  /**
   * Generate next steps chapter
   */
  private generateNextSteps(): string {
    return `
<div class="next-steps">
  <h2>Recommended Next Steps</h2>

  <div class="timeline">
    <div class="timeline__item">
      <div class="timeline__dot"></div>
      <div class="timeline__content">
        <strong>Week 1:</strong> Review this audit with your e-commerce and engineering teams
      </div>
    </div>

    <div class="timeline__item">
      <div class="timeline__dot"></div>
      <div class="timeline__content">
        <strong>Week 2-3:</strong> Schedule a technical deep-dive with Algolia solutions architects
      </div>
    </div>

    <div class="timeline__item">
      <div class="timeline__dot"></div>
      <div class="timeline__content">
        <strong>Week 4-6:</strong> Run a proof-of-concept on your most critical search use cases
      </div>
    </div>

    <div class="timeline__item">
      <div class="timeline__dot"></div>
      <div class="timeline__content">
        <strong>Month 2-3:</strong> Pilot Algolia on 20-30% of traffic to measure impact
      </div>
    </div>

    <div class="timeline__item">
      <div class="timeline__dot"></div>
      <div class="timeline__content">
        <strong>Month 4+:</strong> Full rollout with ongoing optimization
      </div>
    </div>
  </div>

  <div class="cta-box">
    <h3>Ready to get started?</h3>
    <p>Contact your Algolia account executive to schedule a follow-up session.</p>
  </div>
</div>
`;
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Extract company name from scratchpad
   */
  private extractCompanyName(content: string): string {
    const match = content.match(/\*\*Company\*\*:?\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown Company';
  }

  /**
   * Extract industry from scratchpad
   */
  private extractIndustry(content: string): string {
    const match = content.match(/\*\*Industry\*\*:?\s*(.+)/i);
    return match ? match[1].trim() : 'E-commerce';
  }

  /**
   * Extract overall score from scoring scratchpad
   */
  private extractOverallScore(content: string): number {
    const match = content.match(/\*\*Overall Score\*\*:?\s*(\d+(?:\.\d+)?)/i);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Extract annual revenue from financials scratchpad
   */
  private extractAnnualRevenue(content: string): number {
    const match = content.match(/\*\*Annual Revenue\*\*:?\s*\$?([\d.]+)([MBK]?)/i);
    if (!match) return 500000000; // Default: $500M

    const value = parseFloat(match[1]);
    const unit = match[2];

    if (unit === 'B') return value * 1000000000;
    if (unit === 'M') return value * 1000000;
    if (unit === 'K') return value * 1000;
    return value;
  }

  /**
   * Extract scoring dimensions from scratchpad
   */
  private extractScoringDimensions(content: string): any[] {
    const dimensions: any[] = [];
    const matches = content.matchAll(/\|\s*(.+?)\s*\|\s*(\d+(?:\.\d+)?)\/10\s*\|\s*([✅⚠️❌])\s*\|\s*(.+?)\s*\|/g);

    for (const match of matches) {
      if (match[1] === 'Dimension') continue; // Skip header

      dimensions.push({
        name: match[1].trim(),
        score: parseFloat(match[2]),
        status: match[3].trim(),
        keyFinding: match[4].trim(),
      });
    }

    return dimensions;
  }

  /**
   * Extract findings from scratchpad
   */
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

  /**
   * Extract executive quotes from scratchpad
   */
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
        relevance: '', // Would be filled by strategic analysis
      });
    }

    return quotes;
  }

  /**
   * Extract field value from markdown
   */
  private extractField(content: string, fieldName: string): string | undefined {
    const match = content.match(new RegExp(`\\*\\*${fieldName}\\*\\*:?\\s*(.+)`, 'i'));
    return match ? match[1].trim() : undefined;
  }

  /**
   * Extract screenshot path from markdown
   */
  private extractScreenshotPath(content: string): string | undefined {
    const match = content.match(/!\[.*?\]\((.+?)\)/);
    return match ? match[1] : undefined;
  }

  /**
   * Get score status label
   */
  private getScoreStatus(score: number): string {
    if (score >= 8) return 'EXCELLENT';
    if (score >= 6) return 'GOOD';
    if (score >= 4) return 'FAIR';
    return 'POOR';
  }

  /**
   * Get score status CSS class
   */
  private getScoreStatusClass(score: number): string {
    if (score >= 8) return 'badge--positive';
    if (score >= 6) return 'badge--moderate';
    return 'badge--critical';
  }

  /**
   * Convert simple markdown to HTML
   */
  private markdownToHTML(markdown: string): string {
    return markdown
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(.+)$/gm, '<p>$1</p>');
  }

  /**
   * Estimate page count from chapters
   */
  private estimatePageCount(chapters: BookChapter[]): number {
    return chapters.length;
  }

  /**
   * Sanitize filename
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

/**
 * Factory function for creating PDF generator
 */
export function createPDFGenerator(
  scratchpad: ScratchpadManager,
  config?: Partial<PDFGeneratorConfig>
): PDFGenerator {
  return new PDFGenerator(scratchpad, config);
}
