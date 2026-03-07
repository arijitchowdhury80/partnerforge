/**
 * Copilot Context Middleware
 * Extracts user navigation context and attaches to req object
 */

import { Request, Response, NextFunction } from 'express';
import { CopilotContext } from '../services/copilot-context';
import { logger } from '../utils/logger';

const contextService = new CopilotContext();

export function copilotContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      next();
      return;
    }
    const page = req.headers['x-current-page'] as string;
    const companyId = req.headers['x-company-id'] as string;
    const companyName = req.headers['x-company-name'] as string;
    const companyDomain = req.headers['x-company-domain'] as string;
    const auditId = req.headers['x-audit-id'] as string;
    const tab = req.headers['x-tab'] as string;
    let filters: Record<string, any> | undefined;
    const filtersHeader = req.headers['x-filters'] as string;
    if (filtersHeader) {
      try {
        filters = JSON.parse(filtersHeader);
      } catch (e) {
        logger.warn('Failed to parse filters header', { filtersHeader });
      }
    }
    if (page) {
      contextService.updateContext(userId, page, { companyId, companyName, companyDomain, auditId, tab, filters });
    }
    (req as any).copilotContext = { userId, page, companyId, companyName, companyDomain, auditId, tab, filters };
    next();
  } catch (error) {
    logger.error('Copilot context middleware error', { error });
    next();
  }
}
