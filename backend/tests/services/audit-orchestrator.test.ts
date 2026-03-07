/**
 * Audit Orchestrator Tests
 *
 * Tests for the AuditOrchestrator service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditOrchestrator } from '../../services/audit-orchestrator';
import { SupabaseClient } from '../../database/supabase';
import { WebSocketManager } from '../../services/websocket-manager';
import { Audit, Company } from '../../types';

// Mock dependencies
vi.mock('../../database/supabase');
vi.mock('../../services/websocket-manager');
vi.mock('../../queue/setup', () => ({
  auditQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  },
}));

describe('AuditOrchestrator', () => {
  let orchestrator: AuditOrchestrator;
  let mockDb: any;
  let mockWsManager: any;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      getCompany: vi.fn(),
      insert: vi.fn(),
      createAudit: vi.fn(),
      update: vi.fn(),
      query: vi.fn(),
    };

    // Create mock WebSocket manager
    mockWsManager = {
      emitAuditStarted: vi.fn(),
      emitAuditCompleted: vi.fn(),
      emitAuditError: vi.fn(),
      emitProgress: vi.fn(),
    };

    // Mock SupabaseClient constructor
    vi.mocked(SupabaseClient).mockImplementation(() => mockDb);

    // Create orchestrator
    orchestrator = new AuditOrchestrator(mockWsManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createAudit', () => {
    it('should create audit with valid domain', async () => {
      const mockCompany: Company = {
        id: 'company-123',
        domain: 'example.com',
        name: 'Example',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'pending',
        data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.getCompany.mockResolvedValue(mockCompany);
      mockDb.createAudit.mockResolvedValue(mockAudit);
      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.update.mockResolvedValue(mockAudit);

      const result = await orchestrator.createAudit('example.com', 'search-audit');

      expect(result).toBeDefined();
      expect(result.id).toBe('audit-123');
      expect(result.company_id).toBe('company-123');
      expect(mockDb.getCompany).toHaveBeenCalledWith('example.com');
      expect(mockDb.createAudit).toHaveBeenCalledWith('company-123', 'search_audit');
    });

    it('should create company if not exists', async () => {
      const mockCompany: Company = {
        id: 'company-new',
        domain: 'newcompany.com',
        name: 'Newcompany',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAudit: Audit = {
        id: 'audit-new',
        company_id: 'company-new',
        audit_type: 'search_audit',
        status: 'pending',
        data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.getCompany.mockResolvedValue(null);
      mockDb.insert.mockResolvedValue(mockCompany);
      mockDb.createAudit.mockResolvedValue(mockAudit);
      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.update.mockResolvedValue(mockAudit);

      const result = await orchestrator.createAudit('newcompany.com', 'search-audit');

      expect(result).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith('companies', expect.objectContaining({
        domain: 'newcompany.com',
        name: 'Newcompany',
      }));
    });

    it('should throw error with invalid domain', async () => {
      await expect(
        orchestrator.createAudit('invalid domain!', 'search-audit')
      ).rejects.toThrow('Invalid domain format');
    });

    it('should normalize domain (remove protocol and www)', async () => {
      const mockCompany: Company = {
        id: 'company-123',
        domain: 'example.com',
        name: 'Example',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'pending',
        data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.getCompany.mockResolvedValue(mockCompany);
      mockDb.createAudit.mockResolvedValue(mockAudit);
      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.update.mockResolvedValue(mockAudit);

      await orchestrator.createAudit('https://www.example.com', 'search-audit');

      expect(mockDb.getCompany).toHaveBeenCalledWith('example.com');
    });
  });

  describe('startAudit', () => {
    it('should run all phases successfully', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.update.mockResolvedValue(mockAudit);
      mockDb.query.mockResolvedValue([mockAudit]);

      // Mock phase methods to resolve immediately
      vi.spyOn(orchestrator as any, 'runEnrichment').mockResolvedValue(undefined);
      vi.spyOn(orchestrator as any, 'runSearchAudit').mockResolvedValue(undefined);
      vi.spyOn(orchestrator as any, 'runStrategicAnalysis').mockResolvedValue(undefined);
      vi.spyOn(orchestrator as any, 'generateDeliverables').mockResolvedValue(undefined);

      await orchestrator.startAudit('audit-123');

      expect(mockDb.update).toHaveBeenCalledWith('audits', 'audit-123', expect.objectContaining({
        status: 'completed',
      }));

      expect(mockWsManager.emitAuditStarted).toHaveBeenCalledWith('audit-123', expect.anything());
      expect(mockWsManager.emitAuditCompleted).toHaveBeenCalledWith('audit-123', expect.anything());
    });

    it('should handle errors and call error handler', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.update.mockResolvedValue(mockAudit);
      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.insert.mockResolvedValue({});

      const testError = new Error('Test error');
      vi.spyOn(orchestrator as any, 'runEnrichment').mockRejectedValue(testError);

      await expect(orchestrator.startAudit('audit-123')).rejects.toThrow('Test error');

      expect(mockDb.update).toHaveBeenCalledWith('audits', 'audit-123', expect.objectContaining({
        status: 'failed',
      }));

      expect(mockWsManager.emitAuditError).toHaveBeenCalledWith('audit-123', expect.anything());
    });
  });

  describe('getAuditStatus', () => {
    it('should return audit progress', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {
          current_phase: 'enrichment',
          progress_percent: 15,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockAudit]);

      const status = await orchestrator.getAuditStatus('audit-123');

      expect(status).toBeDefined();
      expect(status?.audit_id).toBe('audit-123');
      expect(status?.current_phase).toBe('enrichment');
      expect(status?.progress_percent).toBe(15);
      expect(status?.phases).toHaveLength(4);
    });

    it('should return null if audit not found', async () => {
      mockDb.query.mockResolvedValue([]);

      const status = await orchestrator.getAuditStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('updateProgress', () => {
    it('should update audit and emit WebSocket event', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {},
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.update.mockResolvedValue(mockAudit);

      await orchestrator.updateProgress('audit-123', 'enrichment', 50, 'Halfway there');

      expect(mockDb.update).toHaveBeenCalledWith('audits', 'audit-123', expect.objectContaining({
        data: expect.objectContaining({
          current_phase: 'enrichment',
          progress_percent: 50,
        }),
      }));

      expect(mockWsManager.emitProgress).toHaveBeenCalledWith('audit-123', 50, 100, 'Halfway there');
    });
  });

  describe('handleError', () => {
    it('should retry audit if under max retries', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {
          retry_count: 1,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.update.mockResolvedValue(mockAudit);
      mockDb.insert.mockResolvedValue({});

      const error = new Error('Test error');
      await orchestrator.handleError('audit-123', error);

      expect(mockDb.update).toHaveBeenCalledWith('audits', 'audit-123', expect.objectContaining({
        status: 'failed',
        data: expect.objectContaining({
          error_message: 'Test error',
          retry_count: 1,
        }),
      }));

      // Should update retry count
      expect(mockDb.update).toHaveBeenCalledWith('audits', 'audit-123', expect.objectContaining({
        data: expect.objectContaining({
          retry_count: 2,
        }),
      }));
    });

    it('should not retry if max retries reached', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {
          retry_count: 3,
        },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue([mockAudit]);
      mockDb.update.mockResolvedValue(mockAudit);
      mockDb.insert.mockResolvedValue({});

      const error = new Error('Test error');
      await orchestrator.handleError('audit-123', error);

      // Should only update once (mark as failed)
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });
  });
});
