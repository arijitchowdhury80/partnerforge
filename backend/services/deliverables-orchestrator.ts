/**
 * Deliverables Orchestrator Service
 *
 * Coordinates all 5 deliverables generators to produce complete audit output.
 * This is the main entry point for generating all deliverables from scratchpad files.
 *
 * ARCHITECTURE:
 * - Takes scratchpad workspace as input
 * - Orchestrates 5 generators in parallel
 * - Tracks generation progress via callbacks
 * - Returns paths to all generated files
 * - Stores metadata in database
 *
 * GENERATORS:
 * 1. PDF Book Generator (36-47 pages)
 * 2. Landing Page Generator (HTML + content spec)
 * 3. Presentation Deck Generator (30-33 slides)
 * 4. AE Pre-Call Brief Generator (5 pages)
 * 5. Strategic Signal Brief Generator (1 page)
 *
 * OUTPUT:
 * - 7 total files (PDF, HTML, MD spec, deck MD, AE brief MD, signal brief MD, report MD)
 * - Metadata record in database
 * - Progress events via callback
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';
import { SupabaseClient } from '../database/supabase';
import { ScratchpadManager } from './scratchpad-manager';
import { PDFGenerator, createPDFGenerator } from './pdf-generator';
import { LandingPageGenerator, createLandingPageGenerator } from './landing-page-generator';
import { DeckGenerator, createDeckGenerator } from './deck-generator';
import { AEBriefGenerator, createAEBriefGenerator } from './ae-brief-generator';
import { SignalBriefGenerator, createSignalBriefGenerator } from './signal-brief-generator';
import { ReportGenerator } from './report-generator';

/**
 * Orchestrator configuration
 */
export interface DeliverablesConfig {
  generatePDF: boolean;
  generateLandingPage: boolean;
  generateDeck: boolean;
  generateAEBrief: boolean;
  generateSignalBrief: boolean;
  generateMarkdownReport: boolean; // Database-based report
  outputBaseDir?: string;
  onProgress?: (event: ProgressEvent) => void;
}

/**
 * Progress event
 */
export interface ProgressEvent {
  step: string;
  deliverable: string;
  status: 'started' | 'completed' | 'failed';
  timestamp: Date;
  error?: string;
}

/**
 * Orchestration result
 */
export interface DeliverablesResult {
  companyId: string;
  auditId: string;
  companyName: string;
  files: {
    pdfBook?: string;
    landingPageHTML?: string;
    landingPageSpec?: string;
    deckMarkdown?: string;
    aeBrief?: string;
    signalBrief?: string;
    markdownReport?: string;
  };
  metadata: {
    generatedAt: Date;
    totalFiles: number;
    totalSize: number; // bytes
    estimatedReadTime: number; // minutes
  };
  databaseRecordId?: string;
}

/**
 * Deliverables Orchestrator
 *
 * Main coordinator for generating all audit deliverables from scratchpad files.
 * Runs generators in parallel, tracks progress, and stores metadata.
 */
export class DeliverablesOrchestrator {
  private scratchpad: ScratchpadManager;
  private config: DeliverablesConfig;
  private db: SupabaseClient;

  constructor(scratchpad: ScratchpadManager, config?: Partial<DeliverablesConfig>) {
    this.scratchpad = scratchpad;
    this.config = {
      generatePDF: config?.generatePDF ?? true,
      generateLandingPage: config?.generateLandingPage ?? true,
      generateDeck: config?.generateDeck ?? true,
      generateAEBrief: config?.generateAEBrief ?? true,
      generateSignalBrief: config?.generateSignalBrief ?? true,
      generateMarkdownReport: config?.generateMarkdownReport ?? true,
      outputBaseDir: config?.outputBaseDir || './deliverables',
      onProgress: config?.onProgress,
    };
    this.db = new SupabaseClient();
  }

  /**
   * Generate all deliverables
   */
  async generateAll(): Promise<DeliverablesResult> {
    try {
      logger.info('Starting deliverables orchestration');

      const companyId = this.scratchpad['companyId'];
      const auditId = this.scratchpad['auditId'];
      const files = await this.scratchpad.getAllFiles();
      const companyName = this.extractCompanyName(files[0].content || '');

      this.emitProgress('initialization', 'All deliverables', 'started');

      // Generate all deliverables in parallel
      const results = await Promise.allSettled([
        this.config.generatePDF ? this.generatePDFBook() : Promise.resolve(null),
        this.config.generateLandingPage ? this.generateLandingPage() : Promise.resolve(null),
        this.config.generateDeck ? this.generateDeck() : Promise.resolve(null),
        this.config.generateAEBrief ? this.generateAEBrief() : Promise.resolve(null),
        this.config.generateSignalBrief ? this.generateSignalBrief() : Promise.resolve(null),
        this.config.generateMarkdownReport ? this.generateMarkdownReport(companyId, auditId) : Promise.resolve(null),
      ]);

      // Collect file paths from successful results
      const filePaths: DeliverablesResult['files'] = {};
      const generatedFiles: string[] = [];

      if (results[0].status === 'fulfilled' && results[0].value) {
        filePaths.pdfBook = results[0].value.pdfPath;
        generatedFiles.push(results[0].value.pdfPath);
      } else if (results[0].status === 'rejected') {
        logger.error('PDF generation failed', results[0].reason);
        this.emitProgress('pdf', 'PDF Book', 'failed', results[0].reason);
      }

      if (results[1].status === 'fulfilled' && results[1].value) {
        filePaths.landingPageHTML = results[1].value.htmlPath;
        filePaths.landingPageSpec = results[1].value.contentSpecPath;
        generatedFiles.push(results[1].value.htmlPath, results[1].value.contentSpecPath);
      } else if (results[1].status === 'rejected') {
        logger.error('Landing page generation failed', results[1].reason);
        this.emitProgress('landing-page', 'Landing Page', 'failed', results[1].reason);
      }

      if (results[2].status === 'fulfilled' && results[2].value) {
        filePaths.deckMarkdown = results[2].value.markdownPath;
        generatedFiles.push(results[2].value.markdownPath);
      } else if (results[2].status === 'rejected') {
        logger.error('Deck generation failed', results[2].reason);
        this.emitProgress('deck', 'Presentation Deck', 'failed', results[2].reason);
      }

      if (results[3].status === 'fulfilled' && results[3].value) {
        filePaths.aeBrief = results[3].value.briefPath;
        generatedFiles.push(results[3].value.briefPath);
      } else if (results[3].status === 'rejected') {
        logger.error('AE brief generation failed', results[3].reason);
        this.emitProgress('ae-brief', 'AE Brief', 'failed', results[3].reason);
      }

      if (results[4].status === 'fulfilled' && results[4].value) {
        filePaths.signalBrief = results[4].value.briefPath;
        generatedFiles.push(results[4].value.briefPath);
      } else if (results[4].status === 'rejected') {
        logger.error('Signal brief generation failed', results[4].reason);
        this.emitProgress('signal-brief', 'Signal Brief', 'failed', results[4].reason);
      }

      if (results[5].status === 'fulfilled' && results[5].value) {
        filePaths.markdownReport = results[5].value.reportPath;
        generatedFiles.push(results[5].value.reportPath);
      } else if (results[5].status === 'rejected') {
        logger.error('Markdown report generation failed', results[5].reason);
        this.emitProgress('markdown-report', 'Markdown Report', 'failed', results[5].reason);
      }

      // Calculate metadata
      const totalSize = await this.calculateTotalSize(generatedFiles);
      const estimatedReadTime = this.estimateReadTime(generatedFiles);

      const metadata = {
        generatedAt: new Date(),
        totalFiles: generatedFiles.length,
        totalSize,
        estimatedReadTime,
      };

      // Store metadata in database
      const databaseRecordId = await this.storeMetadata(companyId, auditId, filePaths, metadata);

      this.emitProgress('finalization', 'All deliverables', 'completed');

      logger.info(`Deliverables generated: ${metadata.totalFiles} files, ${(metadata.totalSize / 1024 / 1024).toFixed(2)}MB`);

      return {
        companyId,
        auditId,
        companyName,
        files: filePaths,
        metadata,
        databaseRecordId,
      };
    } catch (error) {
      logger.error('Deliverables orchestration failed', error);
      this.emitProgress('orchestration', 'All deliverables', 'failed', String(error));
      throw new Error(`Deliverables orchestration failed: ${error}`);
    }
  }

  /**
   * Generate PDF book
   */
  private async generatePDFBook() {
    this.emitProgress('pdf', 'PDF Book', 'started');

    try {
      const generator = createPDFGenerator(this.scratchpad, {
        outputDir: path.join(this.config.outputBaseDir!, 'pdfs'),
      });

      const result = await generator.generatePDF();

      this.emitProgress('pdf', 'PDF Book', 'completed');

      return result;
    } catch (error) {
      this.emitProgress('pdf', 'PDF Book', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Generate landing page
   */
  private async generateLandingPage() {
    this.emitProgress('landing-page', 'Landing Page', 'started');

    try {
      const generator = createLandingPageGenerator(this.scratchpad, {
        outputDir: path.join(this.config.outputBaseDir!, 'landing-pages'),
      });

      const result = await generator.generateLandingPage();

      this.emitProgress('landing-page', 'Landing Page', 'completed');

      return result;
    } catch (error) {
      this.emitProgress('landing-page', 'Landing Page', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Generate presentation deck
   */
  private async generateDeck() {
    this.emitProgress('deck', 'Presentation Deck', 'started');

    try {
      const generator = createDeckGenerator(this.scratchpad, {
        outputDir: path.join(this.config.outputBaseDir!, 'decks'),
      });

      const result = await generator.generateDeck();

      this.emitProgress('deck', 'Presentation Deck', 'completed');

      return result;
    } catch (error) {
      this.emitProgress('deck', 'Presentation Deck', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Generate AE pre-call brief
   */
  private async generateAEBrief() {
    this.emitProgress('ae-brief', 'AE Brief', 'started');

    try {
      const generator = createAEBriefGenerator(this.scratchpad, {
        outputDir: path.join(this.config.outputBaseDir!, 'ae-briefs'),
      });

      const result = await generator.generateBrief();

      this.emitProgress('ae-brief', 'AE Brief', 'completed');

      return result;
    } catch (error) {
      this.emitProgress('ae-brief', 'AE Brief', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Generate strategic signal brief
   */
  private async generateSignalBrief() {
    this.emitProgress('signal-brief', 'Signal Brief', 'started');

    try {
      const generator = createSignalBriefGenerator(this.scratchpad, {
        outputDir: path.join(this.config.outputBaseDir!, 'signal-briefs'),
      });

      const result = await generator.generateBrief();

      this.emitProgress('signal-brief', 'Signal Brief', 'completed');

      return result;
    } catch (error) {
      this.emitProgress('signal-brief', 'Signal Brief', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Generate markdown report (database-based)
   */
  private async generateMarkdownReport(companyId: string, auditId: string) {
    this.emitProgress('markdown-report', 'Markdown Report', 'started');

    try {
      const generator = new ReportGenerator();
      const result = await generator.generateReport(companyId, auditId);

      // Save markdown to file
      await fs.mkdir(path.join(this.config.outputBaseDir!, 'reports'), { recursive: true });

      const reportPath = path.join(
        this.config.outputBaseDir!,
        'reports',
        `${this.sanitizeFileName(companyId)}-${auditId}-report.md`
      );

      await fs.writeFile(reportPath, result.markdown, 'utf-8');

      this.emitProgress('markdown-report', 'Markdown Report', 'completed');

      return { reportPath, ...result };
    } catch (error) {
      this.emitProgress('markdown-report', 'Markdown Report', 'failed', String(error));
      throw error;
    }
  }

  /**
   * Emit progress event
   */
  private emitProgress(step: string, deliverable: string, status: ProgressEvent['status'], error?: string) {
    if (this.config.onProgress) {
      this.config.onProgress({
        step,
        deliverable,
        status,
        timestamp: new Date(),
        error,
      });
    }
  }

  /**
   * Calculate total size of generated files
   */
  private async calculateTotalSize(filePaths: string[]): Promise<number> {
    let totalSize = 0;

    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch (error) {
        logger.warn(`Could not stat file: ${filePath}`, error);
      }
    }

    return totalSize;
  }

  /**
   * Estimate read time based on file types
   */
  private estimateReadTime(filePaths: string[]): number {
    // Rough estimates:
    // - PDF book: 30-45 min
    // - Landing page: 10 min
    // - Deck: 25-30 min (presentation time)
    // - AE brief: 10-15 min
    // - Signal brief: 3 min

    let totalMinutes = 0;

    for (const filePath of filePaths) {
      const fileName = path.basename(filePath);

      if (fileName.includes('book') && fileName.endsWith('.pdf')) {
        totalMinutes += 35; // Average of 30-45
      } else if (fileName.includes('landing-page') && fileName.endsWith('.html')) {
        totalMinutes += 10;
      } else if (fileName.includes('deck') && fileName.endsWith('.md')) {
        totalMinutes += 28; // Average of 25-30
      } else if (fileName.includes('ae-precall-brief')) {
        totalMinutes += 12; // Average of 10-15
      } else if (fileName.includes('signal-brief')) {
        totalMinutes += 3;
      } else if (fileName.includes('report') && fileName.endsWith('.md')) {
        totalMinutes += 20;
      }
    }

    return totalMinutes;
  }

  /**
   * Store metadata in database
   */
  private async storeMetadata(
    companyId: string,
    auditId: string,
    filePaths: DeliverablesResult['files'],
    metadata: DeliverablesResult['metadata']
  ): Promise<string> {
    try {
      const record = await this.db.insert('audit_deliverables_metadata', {
        company_id: companyId,
        audit_id: auditId,
        generated_at: metadata.generatedAt,
        total_files: metadata.totalFiles,
        total_size_bytes: metadata.totalSize,
        estimated_read_time_minutes: metadata.estimatedReadTime,
        pdf_book_path: filePaths.pdfBook,
        landing_page_html_path: filePaths.landingPageHTML,
        landing_page_spec_path: filePaths.landingPageSpec,
        deck_markdown_path: filePaths.deckMarkdown,
        ae_brief_path: filePaths.aeBrief,
        signal_brief_path: filePaths.signalBrief,
        markdown_report_path: filePaths.markdownReport,
      });

      return record.id;
    } catch (error) {
      logger.error('Failed to store deliverables metadata in database', error);
      throw error;
    }
  }

  /**
   * Extract company name from scratchpad
   */
  private extractCompanyName(content: string): string {
    const match = content.match(/\*\*Company\*\*:?\s*(.+)/i);
    return match ? match[1].trim() : 'Unknown Company';
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
 * Factory function for creating deliverables orchestrator
 */
export function createDeliverablesOrchestrator(
  scratchpad: ScratchpadManager,
  config?: Partial<DeliverablesConfig>
): DeliverablesOrchestrator {
  return new DeliverablesOrchestrator(scratchpad, config);
}

/**
 * Convenience function: Generate all deliverables from scratchpad
 */
export async function generateAllDeliverables(
  companyId: string,
  auditId: string,
  companyName: string,
  config?: Partial<DeliverablesConfig>
): Promise<DeliverablesResult> {
  const scratchpad = new ScratchpadManager(companyId, auditId, companyName);
  const orchestrator = createDeliverablesOrchestrator(scratchpad, config);
  return orchestrator.generateAll();
}
