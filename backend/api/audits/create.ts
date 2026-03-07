/**
 * POST /api/audits
 *
 * Creates a new audit and queues it for execution
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { AuditOrchestrator } from '../../services/audit-orchestrator';
import { auditQueue } from '../../queue/setup';

const router = Router();

interface CreateAuditRequest {
  company_domain: string;
  audit_type: 'partner-intel' | 'search-audit';
}

interface CreateAuditResponse {
  audit_id: string;
  company_id: string;
  company_domain: string;
  status: string;
  websocket_url: string;
  created_at: string;
}

/**
 * Create new audit
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { company_domain, audit_type } = req.body as CreateAuditRequest;

    // Validate request body
    if (!company_domain) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'company_domain is required',
      });
    }

    if (!audit_type) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'audit_type is required',
      });
    }

    if (!['partner-intel', 'search-audit'].includes(audit_type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'audit_type must be "partner-intel" or "search-audit"',
      });
    }

    logger.info('Creating audit via API', { company_domain, audit_type });

    // Create audit using orchestrator
    const orchestrator = new AuditOrchestrator();
    const audit = await orchestrator.createAudit(company_domain, audit_type);

    // Queue the audit job
    const job = await auditQueue.add('execute-audit', {
      auditId: audit.id,
    });

    logger.info('Audit queued', {
      audit_id: audit.id,
      job_id: job.id,
      company_domain,
      audit_type,
    });

    // Build WebSocket URL
    const wsProtocol = req.protocol === 'https' ? 'wss' : 'ws';
    const wsHost = req.get('host') || 'localhost:3001';
    const websocketUrl = `${wsProtocol}://${wsHost}/ws`;

    // Return response
    const response: CreateAuditResponse = {
      audit_id: audit.id,
      company_id: audit.company_id,
      company_domain,
      status: audit.status,
      websocket_url: websocketUrl,
      created_at: audit.created_at.toISOString(),
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Failed to create audit', { error });

    // Handle specific errors
    if (error.message && error.message.includes('Invalid domain')) {
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
      });
    }

    // Generic error
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create audit',
    });
  }
});

export default router;
