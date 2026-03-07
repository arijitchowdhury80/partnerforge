import { Router, Request, Response, NextFunction } from 'express';
import { WebSocketManager } from '../../services/websocket-manager';

// Logger will be imported from utils/logger.ts once Agent 1 completes
const logger = {
  info: (message: string, meta?: any) => console.log('[INFO]', message, meta || ''),
  error: (message: string, meta?: any) => console.error('[ERROR]', message, meta || ''),
  warn: (message: string, meta?: any) => console.warn('[WARN]', message, meta || ''),
};

export function createLiveStreamRoutes(wsManager: WebSocketManager) {
  const router = Router();

  /**
   * GET /audits/:auditId/connections
   * Get active WebSocket connections for an audit
   */
  router.get('/audits/:auditId/connections', (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const activeConnections = wsManager.getActiveConnections(auditId);

      res.json({
        auditId,
        activeConnections,
        hasSubscribers: wsManager.hasSubscribers(auditId),
        timestamp: new Date(),
      });
    } catch (error: any) {
      logger.error('Failed to get connections', { error: error.message });
      res.status(500).json({ error: 'Failed to get connections' });
    }
  });

  /**
   * POST /audits/:auditId/test-event
   * Manually trigger a test event (for debugging/testing)
   */
  router.post('/audits/:auditId/test-event', (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const { type, data } = req.body;

      if (!type) {
        return res.status(400).json({ error: 'Event type required' });
      }

      wsManager.emitAuditEvent(auditId, {
        type: type as any,
        data: data || {},
        timestamp: new Date(),
      });

      res.json({
        success: true,
        auditId,
        eventType: type,
        subscribers: wsManager.getActiveConnections(auditId),
      });
    } catch (error: any) {
      logger.error('Failed to emit test event', { error: error.message });
      res.status(500).json({ error: 'Failed to emit test event' });
    }
  });

  /**
   * GET /audits/stats
   * Get WebSocket server statistics
   */
  router.get('/audits/stats', (req: Request, res: Response) => {
    try {
      const stats = wsManager.getStats();

      res.json({
        ...stats,
        activeAuditIds: wsManager.getActiveAudits(),
        timestamp: new Date(),
      });
    } catch (error: any) {
      logger.error('Failed to get stats', { error: error.message });
      res.status(500).json({ error: 'Failed to get stats' });
    }
  });

  /**
   * POST /audits/:auditId/disconnect
   * Force disconnect all clients from an audit (admin/cleanup)
   */
  router.post('/audits/:auditId/disconnect', (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;

      wsManager.disconnectAudit(auditId);

      res.json({
        success: true,
        auditId,
        message: 'All clients disconnected from audit',
      });
    } catch (error: any) {
      logger.error('Failed to disconnect audit', { error: error.message });
      res.status(500).json({ error: 'Failed to disconnect audit' });
    }
  });

  /**
   * POST /audits/:auditId/emit/progress
   * Emit progress update (for manual testing)
   */
  router.post('/audits/:auditId/emit/progress', (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const { current, total, message } = req.body;

      if (current === undefined || total === undefined) {
        return res.status(400).json({ error: 'current and total required' });
      }

      wsManager.emitProgress(auditId, current, total, message);

      res.json({
        success: true,
        auditId,
        progress: { current, total, percentage: Math.round((current / total) * 100) },
      });
    } catch (error: any) {
      logger.error('Failed to emit progress', { error: error.message });
      res.status(500).json({ error: 'Failed to emit progress' });
    }
  });

  /**
   * POST /audits/:auditId/emit/screenshot
   * Emit screenshot (for manual testing)
   */
  router.post('/audits/:auditId/emit/screenshot', (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const { testId, query, imageBase64 } = req.body;

      if (!testId || !imageBase64) {
        return res.status(400).json({ error: 'testId and imageBase64 required' });
      }

      wsManager.emitScreenshot(auditId, {
        testId,
        query,
        image: imageBase64,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        auditId,
        testId,
      });
    } catch (error: any) {
      logger.error('Failed to emit screenshot', { error: error.message });
      res.status(500).json({ error: 'Failed to emit screenshot' });
    }
  });

  /**
   * POST /audits/:auditId/emit/finding
   * Emit finding (for manual testing)
   */
  router.post('/audits/:auditId/emit/finding', (req: Request, res: Response) => {
    try {
      const { auditId } = req.params;
      const { testId, severity, title, screenshotPath } = req.body;

      if (!testId || !severity || !title) {
        return res.status(400).json({ error: 'testId, severity, and title required' });
      }

      wsManager.emitFinding(auditId, {
        testId,
        severity,
        title,
        screenshotPath,
      });

      res.json({
        success: true,
        auditId,
        testId,
      });
    } catch (error: any) {
      logger.error('Failed to emit finding', { error: error.message });
      res.status(500).json({ error: 'Failed to emit finding' });
    }
  });

  return router;
}
