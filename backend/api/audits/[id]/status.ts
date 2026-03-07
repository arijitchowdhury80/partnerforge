/**
 * GET /api/audits/:id/status
 *
 * Returns the current status and progress of an audit
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { AuditOrchestrator } from '../../../services/audit-orchestrator';
import { SupabaseClient } from '../../../database/supabase';
import { Audit } from '../../../types';

const router = Router();

interface AuditStatusResponse {
  id: string;
  company_id: string;
  audit_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  overall_score?: number;
  current_phase: string;
  progress_percent: number;
  phases: Array<{
    phase: string;
    percent: number;
    message: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
  }>;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get audit status
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Audit ID is required',
      });
    }

    logger.info('Fetching audit status', { audit_id: id });

    // Get audit from database
    const db = new SupabaseClient();
    const audits = await db.query<Audit>('audits', { id });

    if (!audits || audits.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Audit not found: ${id}`,
      });
    }

    const audit = audits[0];

    // Get detailed progress from orchestrator
    const orchestrator = new AuditOrchestrator();
    const progress = await orchestrator.getAuditStatus(id);

    if (!progress) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Audit progress not found: ${id}`,
      });
    }

    // Build response
    const response: AuditStatusResponse = {
      id: audit.id,
      company_id: audit.company_id,
      audit_type: audit.audit_type,
      status: audit.status,
      overall_score: audit.score,
      current_phase: progress.current_phase,
      progress_percent: progress.progress_percent,
      phases: progress.phases,
      error_message: progress.error_message,
      created_at: typeof audit.created_at === 'string' ? audit.created_at : audit.created_at.toISOString(),
      updated_at: typeof audit.updated_at === 'string' ? audit.updated_at : audit.updated_at.toISOString(),
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Failed to fetch audit status', { error });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit status',
    });
  }
});

export default router;
