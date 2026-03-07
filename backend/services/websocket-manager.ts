import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

// Logger will be imported from utils/logger.ts once Agent 1 completes
const logger = {
  info: (message: string, meta?: any) => console.log('[INFO]', message, meta || ''),
  error: (message: string, meta?: any) => console.error('[ERROR]', message, meta || ''),
  warn: (message: string, meta?: any) => console.warn('[WARN]', message, meta || ''),
};

export interface AuditStreamEvent {
  type: 'audit:started' | 'test:started' | 'test:completed' | 'test:failed' |
        'screenshot:captured' | 'finding:detected' | 'audit:completed' | 'audit:error';
  data: any;
  timestamp: Date;
}

export class WebSocketManager {
  private io: SocketIOServer;
  private activeAudits: Map<string, Set<string>> = new Map(); // auditId -> socketIds

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.WEBSOCKET_CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/ws',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupEventHandlers();
    logger.info('WebSocket server initialized', {
      corsOrigin: process.env.WEBSOCKET_CORS_ORIGIN || 'http://localhost:5173',
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Subscribe to audit updates
      socket.on('subscribe:audit', (auditId: string) => {
        logger.info('Client subscribed to audit', { socketId: socket.id, auditId });

        if (!this.activeAudits.has(auditId)) {
          this.activeAudits.set(auditId, new Set());
        }
        this.activeAudits.get(auditId)!.add(socket.id);

        socket.join(`audit:${auditId}`);

        // Send acknowledgment
        socket.emit('subscribed', { auditId });
      });

      // Unsubscribe from audit updates
      socket.on('unsubscribe:audit', (auditId: string) => {
        logger.info('Client unsubscribed from audit', { socketId: socket.id, auditId });

        this.activeAudits.get(auditId)?.delete(socket.id);
        socket.leave(`audit:${auditId}`);

        // Send acknowledgment
        socket.emit('unsubscribed', { auditId });
      });

      // Handle client ping (keep-alive)
      socket.on('ping', () => {
        socket.emit('pong');
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error('WebSocket error', { socketId: socket.id, error });
      });

      // Disconnect
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', { socketId: socket.id, reason });

        // Clean up subscriptions
        for (const [auditId, sockets] of this.activeAudits.entries()) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.activeAudits.delete(auditId);
            logger.info('No more subscribers for audit', { auditId });
          }
        }
      });
    });
  }

  /**
   * Emit event to all clients subscribed to an audit
   */
  emitAuditEvent(auditId: string, event: AuditStreamEvent) {
    const subscribers = this.activeAudits.get(auditId)?.size || 0;

    if (subscribers === 0) {
      logger.warn('No subscribers for audit event', { auditId, eventType: event.type });
      return;
    }

    this.io.to(`audit:${auditId}`).emit('audit:event', {
      ...event,
      timestamp: new Date(),
    });

    logger.info('Audit event emitted', {
      auditId,
      eventType: event.type,
      subscribers,
    });
  }

  /**
   * Emit progress update
   */
  emitProgress(auditId: string, current: number, total: number, message?: string) {
    this.emitAuditEvent(auditId, {
      type: 'test:started',
      data: {
        progress: {
          current,
          total,
          percentage: Math.round((current / total) * 100),
        },
        message,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Emit screenshot with base64 data
   */
  emitScreenshot(auditId: string, screenshot: any) {
    this.emitAuditEvent(auditId, {
      type: 'screenshot:captured',
      data: screenshot,
      timestamp: new Date(),
    });
  }

  /**
   * Emit finding detected
   */
  emitFinding(auditId: string, finding: any) {
    this.emitAuditEvent(auditId, {
      type: 'finding:detected',
      data: finding,
      timestamp: new Date(),
    });
  }

  /**
   * Emit audit started
   */
  emitAuditStarted(auditId: string, data: any) {
    this.emitAuditEvent(auditId, {
      type: 'audit:started',
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Emit audit completed
   */
  emitAuditCompleted(auditId: string, data: any) {
    this.emitAuditEvent(auditId, {
      type: 'audit:completed',
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Emit audit error
   */
  emitAuditError(auditId: string, error: any) {
    this.emitAuditEvent(auditId, {
      type: 'audit:error',
      data: {
        error: error.message || String(error),
        code: error.code,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Get active connections for an audit
   */
  getActiveConnections(auditId: string): number {
    return this.activeAudits.get(auditId)?.size || 0;
  }

  /**
   * Get all active audits being watched
   */
  getActiveAudits(): string[] {
    return Array.from(this.activeAudits.keys());
  }

  /**
   * Check if audit has active subscribers
   */
  hasSubscribers(auditId: string): boolean {
    return (this.activeAudits.get(auditId)?.size || 0) > 0;
  }

  /**
   * Disconnect all clients from an audit room
   */
  disconnectAudit(auditId: string) {
    const room = this.io.sockets.adapter.rooms.get(`audit:${auditId}`);
    if (room) {
      for (const socketId of room) {
        const socket = this.io.sockets.sockets.get(socketId);
        socket?.leave(`audit:${auditId}`);
      }
    }
    this.activeAudits.delete(auditId);
    logger.info('Disconnected all clients from audit', { auditId });
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      connectedClients: this.io.sockets.sockets.size,
      activeAudits: this.activeAudits.size,
      totalSubscriptions: Array.from(this.activeAudits.values()).reduce(
        (sum, set) => sum + set.size,
        0
      ),
    };
  }

  /**
   * Cleanup and close server
   */
  async close() {
    logger.info('Closing WebSocket server');
    await this.io.close();
    this.activeAudits.clear();
    logger.info('WebSocket server closed');
  }
}
