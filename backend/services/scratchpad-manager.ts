/**
 * Scratchpad Manager Service
 *
 * Manages 12 intermediate scratchpad files that store structured
 * audit research data before final report generation.
 *
 * ARCHITECTURE:
 * - Each audit creates a workspace directory with 12 numbered markdown files
 * - Files persist across audit phases for incremental data collection
 * - Report generator reads from scratchpad files to build final deliverables
 *
 * FILE NAMING: {companyName}-{auditId}-{fileNumber}-{fileName}.md
 * DIRECTORY: ./scratchpads/{companyId}/{auditId}/
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger';

/**
 * Scratchpad file definition
 */
export interface ScratchpadFile {
  fileNumber: number;
  fileName: string;
  title: string;
  description: string;
  filePath?: string;
  content?: string;
  lastModified?: Date;
}

/**
 * Scratchpad workspace for an audit
 */
export interface ScratchpadWorkspace {
  companyId: string;
  auditId: string;
  companyName: string;
  workspaceDir: string;
  files: ScratchpadFile[];
  createdAt: Date;
}

/**
 * The 12 scratchpad files used in every audit
 */
export const SCRATCHPAD_FILES: Omit<ScratchpadFile, 'filePath' | 'content' | 'lastModified'>[] = [
  {
    fileNumber: 1,
    fileName: 'company-context',
    title: 'Company Context',
    description: 'Company overview, industry, vertical, business model',
  },
  {
    fileNumber: 2,
    fileName: 'tech-stack',
    title: 'Technology Stack',
    description: 'Technology stack from BuiltWith (e-commerce, CMS, search, analytics)',
  },
  {
    fileNumber: 3,
    fileName: 'traffic',
    title: 'Traffic Analysis',
    description: 'Traffic analysis from SimilarWeb (visits, engagement, sources)',
  },
  {
    fileNumber: 4,
    fileName: 'financials',
    title: 'Financial Profile',
    description: 'Financial data from Yahoo Finance (3-year trends, margins, growth)',
  },
  {
    fileNumber: 5,
    fileName: 'competitors',
    title: 'Competitor Analysis',
    description: 'Competitor analysis (similar sites, search providers, positioning)',
  },
  {
    fileNumber: 6,
    fileName: 'hiring',
    title: 'Hiring Signals',
    description: 'Hiring signals from Apify (open roles, growth areas)',
  },
  {
    fileNumber: 7,
    fileName: 'intel',
    title: 'Investor Intelligence',
    description: 'Investor intelligence (10-K, earnings calls, executive quotes)',
  },
  {
    fileNumber: 8,
    fileName: 'strategic',
    title: 'Strategic Context',
    description: 'Strategic angles and trigger events (why now?)',
  },
  {
    fileNumber: 9,
    fileName: 'search-tests',
    title: 'Search Test Results',
    description: 'Search test results summary (20 tests, pass/fail, evidence)',
  },
  {
    fileNumber: 10,
    fileName: 'screenshots',
    title: 'Screenshot Inventory',
    description: 'Screenshot inventory with annotations and issue detection',
  },
  {
    fileNumber: 11,
    fileName: 'scoring',
    title: 'Scoring Breakdown',
    description: '10-dimension scores breakdown (relevance, typos, SAYT, etc.)',
  },
  {
    fileNumber: 12,
    fileName: 'recommendations',
    title: 'Algolia Recommendations',
    description: 'Algolia value prop recommendations mapped to findings',
  },
];

/**
 * Scratchpad Manager
 *
 * Manages lifecycle of scratchpad files for an audit:
 * - Create workspace directory
 * - Initialize 12 numbered files
 * - Update files incrementally during audit
 * - Read files for report generation
 * - Cleanup old workspaces
 */
export class ScratchpadManager {
  private companyId: string;
  private auditId: string;
  private companyName: string;
  private workspaceDir: string;
  private baseDir: string;

  constructor(
    companyId: string,
    auditId: string,
    companyName: string,
    baseDir: string = './scratchpads'
  ) {
    this.companyId = companyId;
    this.auditId = auditId;
    this.companyName = this.sanitizeFileName(companyName);
    this.baseDir = baseDir;
    this.workspaceDir = path.join(baseDir, companyId, auditId);
  }

  /**
   * Initialize workspace and create all 12 scratchpad files
   */
  async initialize(): Promise<ScratchpadWorkspace> {
    try {
      logger.info(`Initializing scratchpad workspace: ${this.workspaceDir}`);

      // Create workspace directory
      await fs.mkdir(this.workspaceDir, { recursive: true });

      // Create all 12 files with headers
      const files: ScratchpadFile[] = [];

      for (const fileSpec of SCRATCHPAD_FILES) {
        const fileName = this.buildFileName(fileSpec.fileNumber, fileSpec.fileName);
        const filePath = path.join(this.workspaceDir, fileName);

        // Create file with header
        const header = this.buildFileHeader(fileSpec);
        await fs.writeFile(filePath, header, 'utf-8');

        files.push({
          ...fileSpec,
          filePath,
          content: header,
          lastModified: new Date(),
        });

        logger.debug(`Created scratchpad file: ${fileName}`);
      }

      logger.info(`Scratchpad workspace initialized with ${files.length} files`);

      return {
        companyId: this.companyId,
        auditId: this.auditId,
        companyName: this.companyName,
        workspaceDir: this.workspaceDir,
        files,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to initialize scratchpad workspace', error);
      throw new Error(`Scratchpad initialization failed: ${error}`);
    }
  }

  /**
   * Create or update a specific scratchpad file
   */
  async createFile(fileNumber: number, fileName: string, content: string): Promise<string> {
    try {
      const fileSpec = SCRATCHPAD_FILES.find((f) => f.fileNumber === fileNumber);
      if (!fileSpec) {
        throw new Error(`Invalid file number: ${fileNumber}. Must be 1-12.`);
      }

      const fullFileName = this.buildFileName(fileNumber, fileName);
      const filePath = path.join(this.workspaceDir, fullFileName);

      // Ensure directory exists
      await fs.mkdir(this.workspaceDir, { recursive: true });

      // Write content with header
      const header = this.buildFileHeader(fileSpec);
      const fullContent = `${header}\n\n${content}`;
      await fs.writeFile(filePath, fullContent, 'utf-8');

      logger.info(`Created scratchpad file: ${fullFileName} (${content.length} chars)`);

      return filePath;
    } catch (error) {
      logger.error(`Failed to create scratchpad file ${fileNumber}`, error);
      throw new Error(`Failed to create scratchpad file: ${error}`);
    }
  }

  /**
   * Update an existing scratchpad file
   */
  async updateFile(fileNumber: number, content: string): Promise<void> {
    try {
      const fileSpec = SCRATCHPAD_FILES.find((f) => f.fileNumber === fileNumber);
      if (!fileSpec) {
        throw new Error(`Invalid file number: ${fileNumber}`);
      }

      const fullFileName = this.buildFileName(fileNumber, fileSpec.fileName);
      const filePath = path.join(this.workspaceDir, fullFileName);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Scratchpad file ${fileNumber} does not exist. Use createFile() first.`);
      }

      // Update content (preserve header)
      const header = this.buildFileHeader(fileSpec);
      const fullContent = `${header}\n\n${content}`;
      await fs.writeFile(filePath, fullContent, 'utf-8');

      logger.info(`Updated scratchpad file: ${fullFileName}`);
    } catch (error) {
      logger.error(`Failed to update scratchpad file ${fileNumber}`, error);
      throw new Error(`Failed to update scratchpad file: ${error}`);
    }
  }

  /**
   * Append content to an existing scratchpad file
   */
  async appendToFile(fileNumber: number, content: string): Promise<void> {
    try {
      const fileSpec = SCRATCHPAD_FILES.find((f) => f.fileNumber === fileNumber);
      if (!fileSpec) {
        throw new Error(`Invalid file number: ${fileNumber}`);
      }

      const fullFileName = this.buildFileName(fileNumber, fileSpec.fileName);
      const filePath = path.join(this.workspaceDir, fullFileName);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`Scratchpad file ${fileNumber} does not exist. Use createFile() first.`);
      }

      // Append content
      await fs.appendFile(filePath, `\n\n${content}`, 'utf-8');

      logger.info(`Appended to scratchpad file: ${fullFileName}`);
    } catch (error) {
      logger.error(`Failed to append to scratchpad file ${fileNumber}`, error);
      throw new Error(`Failed to append to scratchpad file: ${error}`);
    }
  }

  /**
   * Read a specific scratchpad file
   */
  async getFile(fileNumber: number): Promise<string> {
    try {
      const fileSpec = SCRATCHPAD_FILES.find((f) => f.fileNumber === fileNumber);
      if (!fileSpec) {
        throw new Error(`Invalid file number: ${fileNumber}`);
      }

      const fullFileName = this.buildFileName(fileNumber, fileSpec.fileName);
      const filePath = path.join(this.workspaceDir, fullFileName);

      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      logger.error(`Failed to read scratchpad file ${fileNumber}`, error);
      throw new Error(`Failed to read scratchpad file: ${error}`);
    }
  }

  /**
   * Read all scratchpad files
   */
  async getAllFiles(): Promise<Record<number, string>> {
    try {
      const files: Record<number, string> = {};

      for (const fileSpec of SCRATCHPAD_FILES) {
        const content = await this.getFile(fileSpec.fileNumber);
        files[fileSpec.fileNumber] = content;
      }

      logger.info(`Read ${Object.keys(files).length} scratchpad files`);
      return files;
    } catch (error) {
      logger.error('Failed to read all scratchpad files', error);
      throw new Error(`Failed to read all scratchpad files: ${error}`);
    }
  }

  /**
   * Get file metadata (path, size, last modified)
   */
  async getFileMetadata(fileNumber: number): Promise<{
    filePath: string;
    size: number;
    lastModified: Date;
  }> {
    try {
      const fileSpec = SCRATCHPAD_FILES.find((f) => f.fileNumber === fileNumber);
      if (!fileSpec) {
        throw new Error(`Invalid file number: ${fileNumber}`);
      }

      const fullFileName = this.buildFileName(fileNumber, fileSpec.fileName);
      const filePath = path.join(this.workspaceDir, fullFileName);

      const stats = await fs.stat(filePath);

      return {
        filePath,
        size: stats.size,
        lastModified: stats.mtime,
      };
    } catch (error) {
      logger.error(`Failed to get metadata for scratchpad file ${fileNumber}`, error);
      throw new Error(`Failed to get file metadata: ${error}`);
    }
  }

  /**
   * Check if workspace exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.workspaceDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all scratchpad files and workspace directory
   */
  async cleanup(): Promise<void> {
    try {
      logger.info(`Cleaning up scratchpad workspace: ${this.workspaceDir}`);
      await fs.rm(this.workspaceDir, { recursive: true, force: true });
      logger.info('Scratchpad workspace cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup scratchpad workspace', error);
      throw new Error(`Failed to cleanup scratchpad workspace: ${error}`);
    }
  }

  /**
   * Build file name: {companyName}-{auditId}-{fileNumber}-{fileName}.md
   */
  private buildFileName(fileNumber: number, fileName: string): string {
    const paddedNumber = String(fileNumber).padStart(2, '0');
    return `${this.companyName}-${this.auditId.substring(0, 8)}-${paddedNumber}-${fileName}.md`;
  }

  /**
   * Build file header with metadata
   */
  private buildFileHeader(fileSpec: Omit<ScratchpadFile, 'filePath' | 'content' | 'lastModified'>): string {
    return `# ${fileSpec.title}

**Company**: ${this.companyName}
**Audit ID**: ${this.auditId}
**File**: ${fileSpec.fileNumber} of 12
**Purpose**: ${fileSpec.description}
**Last Updated**: ${new Date().toISOString()}

---
`;
  }

  /**
   * Sanitize company name for file names
   */
  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Get workspace directory path
   */
  getWorkspaceDir(): string {
    return this.workspaceDir;
  }

  /**
   * List all files in workspace
   */
  async listFiles(): Promise<ScratchpadFile[]> {
    try {
      const files: ScratchpadFile[] = [];

      for (const fileSpec of SCRATCHPAD_FILES) {
        const fullFileName = this.buildFileName(fileSpec.fileNumber, fileSpec.fileName);
        const filePath = path.join(this.workspaceDir, fullFileName);

        try {
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');

          files.push({
            ...fileSpec,
            filePath,
            content,
            lastModified: stats.mtime,
          });
        } catch {
          // File doesn't exist yet
          files.push({
            ...fileSpec,
            filePath,
            content: '',
            lastModified: undefined,
          });
        }
      }

      return files;
    } catch (error) {
      logger.error('Failed to list scratchpad files', error);
      throw new Error(`Failed to list scratchpad files: ${error}`);
    }
  }
}

/**
 * Factory function for creating scratchpad manager
 */
export function createScratchpadManager(
  companyId: string,
  auditId: string,
  companyName: string,
  baseDir?: string
): ScratchpadManager {
  return new ScratchpadManager(companyId, auditId, companyName, baseDir);
}
