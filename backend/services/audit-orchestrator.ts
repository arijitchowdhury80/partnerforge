/**
 * Audit Orchestrator Service
 *
 * Master controller for running audits. Coordinates:
 * - Audit creation and initialization
 * - Phase execution (Enrichment → Search Audit → Strategic Analysis → Deliverables)
 * - Progress tracking and WebSocket updates
 * - Error handling and retry logic
 */

import { logger } from '../utils/logger';
import { SupabaseClient } from '../database/supabase';
import { WebSocketManager } from './websocket-manager';
import { auditQueue } from '../queue/setup';
import { Audit, Company } from '../types';
import { DatabaseError } from '../utils/errors';
import { Job } from 'bullmq';

export interface AuditPhase {
  phase: string;
  percent: number;
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AuditProgress {
  audit_id: string;
  current_phase: string;
  progress_percent: number;
  phases: AuditPhase[];
  error_message?: string;
}

export class AuditOrchestrator {
  private db: SupabaseClient;
  private wsManager?: WebSocketManager;

  constructor(wsManager?: WebSocketManager) {
    this.db = new SupabaseClient();
    this.wsManager = wsManager;
  }

  /**
   * Create a new audit
   */
  async createAudit(
    domain: string,
    type: 'partner-intel' | 'search-audit'
  ): Promise<Audit> {
    try {
      logger.info('Creating audit', { domain, type });

      // Validate domain format
      if (!this.isValidDomain(domain)) {
        throw new Error(`Invalid domain format: ${domain}`);
      }

      // Normalize domain (remove protocol, www, trailing slash)
      const normalizedDomain = this.normalizeDomain(domain);

      // Check if company exists, create if not
      let company = await this.db.getCompany(normalizedDomain);

      if (!company) {
        logger.info('Company not found, creating new company', { domain: normalizedDomain });
        company = await this.db.insert<Company>('companies', {
          domain: normalizedDomain,
          name: this.extractCompanyName(normalizedDomain),
          created_at: new Date(),
          updated_at: new Date(),
        });
        logger.info('Company created', { company_id: company.id });
      }

      // Map audit type to database enum format
      const auditType = type === 'partner-intel' ? 'partner_intel' : 'search_audit';

      // Create audit record
      const audit = await this.db.createAudit(company.id, auditType);
      logger.info('Audit created', { audit_id: audit.id, company_id: company.id });

      // Update audit with initial progress
      await this.updateProgress(audit.id, 'initialization', 0, 'Audit created');

      return audit;
    } catch (error) {
      logger.error('Failed to create audit', { domain, type, error });
      throw error;
    }
  }

  /**
   * Start audit execution (queues the audit job)
   */
  async startAudit(auditId: string): Promise<void> {
    try {
      logger.info('Starting audit', { audit_id: auditId });

      // Update audit status to running
      await this.db.update('audits', auditId, {
        status: 'running',
        updated_at: new Date(),
      });

      // Emit audit started event
      if (this.wsManager) {
        this.wsManager.emitAuditStarted(auditId, {
          audit_id: auditId,
          started_at: new Date().toISOString(),
        });
      }

      // Phase 1: Enrichment
      await this.updateProgress(auditId, 'enrichment', 5, 'Starting enrichment phase');
      await this.runEnrichment(auditId);
      await this.updateProgress(auditId, 'enrichment', 25, 'Enrichment completed');

      // Phase 2: Search Audit
      await this.updateProgress(auditId, 'search-audit', 30, 'Starting search audit');
      await this.runSearchAudit(auditId);
      await this.updateProgress(auditId, 'search-audit', 50, 'Search audit completed');

      // Phase 3: Strategic Analysis
      await this.updateProgress(auditId, 'strategic-analysis', 55, 'Starting strategic analysis');
      await this.runStrategicAnalysis(auditId);
      await this.updateProgress(auditId, 'strategic-analysis', 75, 'Strategic analysis completed');

      // Phase 4: Deliverables
      await this.updateProgress(auditId, 'deliverables', 80, 'Generating deliverables');
      await this.generateDeliverables(auditId);
      await this.updateProgress(auditId, 'deliverables', 100, 'All deliverables generated');

      // Mark audit as completed
      await this.db.update('audits', auditId, {
        status: 'completed',
        updated_at: new Date(),
      });

      // Emit completion event
      if (this.wsManager) {
        this.wsManager.emitAuditCompleted(auditId, {
          audit_id: auditId,
          completed_at: new Date().toISOString(),
        });
      }

      logger.info('Audit completed successfully', { audit_id: auditId });
    } catch (error) {
      await this.handleError(auditId, error as Error);
      throw error;
    }
  }

  /**
   * Run enrichment phase
   * Calls enrichment-orchestrator.ts (will be built by another agent)
   */
  async runEnrichment(auditId: string): Promise<void> {
    logger.info('Running enrichment phase', { audit_id: auditId });

    // Emit progress updates
    await this.updateProgress(auditId, 'enrichment', 10, 'Fetching traffic data (SimilarWeb)');
    await this.updateProgress(auditId, 'enrichment', 15, 'Fetching technology stack (BuiltWith)');
    await this.updateProgress(auditId, 'enrichment', 20, 'Fetching financials (Yahoo Finance)');

    // TODO: Call enrichment-orchestrator.ts when available
    // For now, this is a stub that will be implemented by another agent
    logger.info('Enrichment phase completed (stub)', { audit_id: auditId });
  }

  /**
   * Run search audit phase
   * Calls search-audit-worker.ts (will be built by another agent)
   */
  async runSearchAudit(auditId: string): Promise<void> {
    logger.info('Running search audit phase', { audit_id: auditId });

    // Emit progress updates
    await this.updateProgress(auditId, 'search-audit', 35, 'Running homepage search tests');
    await this.updateProgress(auditId, 'search-audit', 40, 'Testing mobile experience');
    await this.updateProgress(auditId, 'search-audit', 45, 'Testing NLP queries');

    // TODO: Call search-audit-worker.ts when available
    // For now, this is a stub that will be implemented by another agent
    logger.info('Search audit phase completed (stub)', { audit_id: auditId });
  }

  /**
   * Run strategic analysis phase
   * Calls strategic-analysis-engine.ts (will be built by another agent)
   */
  async runStrategicAnalysis(auditId: string): Promise<void> {
    logger.info('Running strategic analysis phase', { audit_id: auditId });

    // Emit progress updates
    await this.updateProgress(auditId, 'strategic-analysis', 60, 'Analyzing competitive landscape');
    await this.updateProgress(auditId, 'strategic-analysis', 65, 'Identifying strategic opportunities');
    await this.updateProgress(auditId, 'strategic-analysis', 70, 'Mapping to Algolia value props');

    // TODO: Call strategic-analysis-engine.ts when available
    // For now, this is a stub that will be implemented by another agent
    logger.info('Strategic analysis phase completed (stub)', { audit_id: auditId });
  }

  /**
   * Generate deliverables phase
   * Calls export-generator.ts (to be built in Phase 3)
   */
  async generateDeliverables(auditId: string): Promise<void> {
    logger.info('Generating deliverables', { audit_id: auditId });

    // Emit progress updates
    await this.updateProgress(auditId, 'deliverables', 85, 'Generating audit report');
    await this.updateProgress(auditId, 'deliverables', 90, 'Generating presentation deck');
    await this.updateProgress(auditId, 'deliverables', 95, 'Generating AE brief');

    // TODO: Call export-generator.ts when available (Phase 3)
    // For now, this is a stub
    logger.info('Deliverables generation completed (stub)', { audit_id: auditId });
  }

  /**
   * Handle errors during audit execution
   */
  async handleError(auditId: string, error: Error): Promise<void> {
    logger.error('Audit error', { audit_id: auditId, error });

    try {
      // Get current audit to check retry count
      const audits = await this.db.query<Audit>('audits', { id: auditId });
      const audit = audits[0];

      if (!audit) {
        logger.error('Audit not found for error handling', { audit_id: auditId });
        return;
      }

      const retryCount = (audit.data?.retry_count || 0) as number;
      const maxRetries = 3;

      // Update audit with error
      await this.db.update('audits', auditId, {
        status: 'failed',
        data: {
          ...audit.data,
          error_message: error.message,
          error_stack: error.stack,
          retry_count: retryCount,
          failed_at: new Date().toISOString(),
        },
        updated_at: new Date(),
      });

      // Emit error event
      if (this.wsManager) {
        this.wsManager.emitAuditError(auditId, {
          message: error.message,
          retry_count: retryCount,
          will_retry: retryCount < maxRetries,
        });
      }

      // Log to audit_log table
      await this.db.insert('audit_log', {
        actor_id: 'system',
        action_type: 'audit_failed',
        resource_type: 'audit',
        resource_id: auditId,
        new_value: { error: error.message, retry_count: retryCount },
        created_at: new Date(),
      });

      // Retry if under max retries
      if (retryCount < maxRetries) {
        logger.info('Retrying audit', { audit_id: auditId, retry_count: retryCount + 1 });

        // Update retry count
        await this.db.update('audits', auditId, {
          data: {
            ...audit.data,
            retry_count: retryCount + 1,
          },
        });

        // Re-queue the audit with exponential backoff
        const backoffDelay = Math.pow(2, retryCount) * 60000; // 1min, 2min, 4min
        await auditQueue.add(
          'execute-audit',
          { auditId },
          { delay: backoffDelay }
        );
      }
    } catch (handlerError) {
      logger.error('Error in error handler', { audit_id: auditId, error: handlerError });
    }
  }

  /**
   * Update progress and emit WebSocket events
   */
  async updateProgress(
    auditId: string,
    phase: string,
    percent: number,
    message: string
  ): Promise<void> {
    logger.info('Audit progress', { audit_id: auditId, phase, percent, message });

    try {
      // Update audit record with progress
      const audits = await this.db.query<Audit>('audits', { id: auditId });
      const audit = audits[0];

      if (audit) {
        await this.db.update('audits', auditId, {
          data: {
            ...audit.data,
            current_phase: phase,
            progress_percent: percent,
            last_update: new Date().toISOString(),
          },
          updated_at: new Date(),
        });
      }

      // Emit progress via WebSocket
      if (this.wsManager) {
        this.wsManager.emitProgress(auditId, percent, 100, message);
      }
    } catch (error) {
      logger.error('Failed to update progress', { audit_id: auditId, error });
      // Don't throw - progress updates are non-critical
    }
  }

  /**
   * Get audit status
   */
  async getAuditStatus(auditId: string): Promise<AuditProgress | null> {
    try {
      const audits = await this.db.query<Audit>('audits', { id: auditId });
      const audit = audits[0];

      if (!audit) {
        return null;
      }

      const currentPhase = (audit.data?.current_phase as string) || 'initialization';
      const progressPercent = (audit.data?.progress_percent as number) || 0;
      const errorMessage = (audit.data?.error_message as string) || undefined;

      // Define phase structure
      const phases: AuditPhase[] = [
        {
          phase: 'enrichment',
          percent: 25,
          message: 'Collecting company data',
          status: progressPercent >= 25 ? 'completed' : (currentPhase === 'enrichment' ? 'running' : 'pending'),
        },
        {
          phase: 'search-audit',
          percent: 50,
          message: 'Running search tests',
          status: progressPercent >= 50 ? 'completed' : (currentPhase === 'search-audit' ? 'running' : 'pending'),
        },
        {
          phase: 'strategic-analysis',
          percent: 75,
          message: 'Analyzing opportunities',
          status: progressPercent >= 75 ? 'completed' : (currentPhase === 'strategic-analysis' ? 'running' : 'pending'),
        },
        {
          phase: 'deliverables',
          percent: 100,
          message: 'Generating reports',
          status: progressPercent >= 100 ? 'completed' : (currentPhase === 'deliverables' ? 'running' : 'pending'),
        },
      ];

      return {
        audit_id: audit.id,
        current_phase: currentPhase,
        progress_percent: progressPercent,
        phases,
        error_message: errorMessage,
      };
    } catch (error) {
      logger.error('Failed to get audit status', { audit_id: auditId, error });
      return null;
    }
  }

  // Helper methods

  private isValidDomain(domain: string): boolean {
    // Basic domain validation
    const domainRegex = /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/.*)?$/;
    return domainRegex.test(domain);
  }

  private normalizeDomain(domain: string): string {
    // Remove protocol
    let normalized = domain.replace(/^https?:\/\//, '');

    // Remove www.
    normalized = normalized.replace(/^www\./, '');

    // Remove trailing slash and path
    normalized = normalized.split('/')[0];

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    return normalized;
  }

  private extractCompanyName(domain: string): string {
    // Extract company name from domain (e.g., costco.com -> Costco)
    const parts = domain.split('.');
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}
