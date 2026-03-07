/**
 * WebSocket endpoint: /api/audits/:id/live
 *
 * Provides real-time updates for an audit via WebSocket
 */

import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../../utils/logger';
import { SupabaseClient } from '../../../database/supabase';
import { Audit } from '../../../types';

/**
 * Setup WebSocket endpoint for audit live streaming
 *
 * This is called from server.ts during WebSocketManager initialization
 */
export function setupAuditLiveStream(io: SocketIOServer): void {
  io.on('connection', (socket) => {
    logger.info('Client connected for audit live stream', { socket_id: socket.id });

    // Handle subscription to specific audit
    socket.on('subscribe:audit', async (auditId: string) => {
      try {
        logger.info('Client subscribing to audit', {
          socket_id: socket.id,
          audit_id: auditId,
        });

        // Validate audit exists
        const db = new SupabaseClient();
        const audits = await db.query<Audit>('audits', { id: auditId });

        if (!audits || audits.length === 0) {
          socket.emit('error', {
            message: `Audit not found: ${auditId}`,
            code: 'AUDIT_NOT_FOUND',
          });
          return;
        }

        // Join audit room
        await socket.join(`audit:${auditId}`);

        // Send acknowledgment with current audit state
        const audit = audits[0];
        socket.emit('subscribed', {
          audit_id: auditId,
          status: audit.status,
          current_phase: audit.data?.current_phase || 'initialization',
          progress_percent: audit.data?.progress_percent || 0,
          subscribed_at: new Date().toISOString(),
        });

        logger.info('Client subscribed to audit', {
          socket_id: socket.id,
          audit_id: auditId,
        });
      } catch (error: any) {
        logger.error('Failed to subscribe to audit', {
          socket_id: socket.id,
          audit_id: auditId,
          error,
        });

        socket.emit('error', {
          message: 'Failed to subscribe to audit',
          code: 'SUBSCRIPTION_ERROR',
        });
      }
    });

    // Handle unsubscription
    socket.on('unsubscribe:audit', (auditId: string) => {
      logger.info('Client unsubscribing from audit', {
        socket_id: socket.id,
        audit_id: auditId,
      });

      socket.leave(`audit:${auditId}`);

      socket.emit('unsubscribed', {
        audit_id: auditId,
        unsubscribed_at: new Date().toISOString(),
      });
    });

    // Handle ping (keep-alive)
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info('Client disconnected from audit stream', {
        socket_id: socket.id,
        reason,
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socket_id: socket.id,
        error,
      });
    });
  });
}

/**
 * Event types emitted by the audit orchestrator:
 *
 * 'audit:event' - Generic audit event
 *   - type: 'audit:started' | 'test:started' | 'test:completed' | 'test:failed' |
 *           'screenshot:captured' | 'finding:detected' | 'audit:completed' | 'audit:error'
 *   - data: Event-specific data
 *   - timestamp: ISO timestamp
 *
 * 'progress' - Progress update
 *   - phase: Current phase name
 *   - percent: Progress percentage (0-100)
 *   - message: Human-readable progress message
 *
 * 'complete' - Audit completed
 *   - audit_id: Audit ID
 *   - completed_at: ISO timestamp
 *
 * 'error' - Audit error
 *   - error: Error message
 *   - code: Error code (if available)
 *
 * Client should listen for these events:
 *
 * socket.on('audit:event', (event) => {
 *   console.log('Audit event:', event.type, event.data);
 * });
 *
 * socket.on('subscribed', (data) => {
 *   console.log('Subscribed to audit:', data.audit_id);
 * });
 *
 * socket.on('error', (error) => {
 *   console.error('WebSocket error:', error);
 * });
 */

export default setupAuditLiveStream;
