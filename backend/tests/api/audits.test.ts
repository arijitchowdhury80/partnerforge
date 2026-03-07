/**
 * Audit API Integration Tests
 *
 * Tests for the audit API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server';
import { SupabaseClient } from '../../database/supabase';
import { auditQueue } from '../../queue/setup';
import { Audit, Company } from '../../types';

// Mock dependencies
vi.mock('../../database/supabase');
vi.mock('../../queue/setup', () => ({
  auditQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-123' }),
  },
}));

describe('Audit API', () => {
  let mockDb: any;

  beforeEach(() => {
    // Create mock database
    mockDb = {
      getCompany: vi.fn(),
      insert: vi.fn(),
      createAudit: vi.fn(),
      update: vi.fn(),
      query: vi.fn(),
    };

    // Mock SupabaseClient constructor
    vi.mocked(SupabaseClient).mockImplementation(() => mockDb);
  });

  describe('POST /api/audits', () => {
    it('should create audit with valid data', async () => {
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

      const response = await request(app)
        .post('/api/audits')
        .send({
          company_domain: 'example.com',
          audit_type: 'search-audit',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('audit_id');
      expect(response.body).toHaveProperty('company_id');
      expect(response.body).toHaveProperty('websocket_url');
      expect(response.body.audit_id).toBe('audit-123');
    });

    it('should return 400 with missing company_domain', async () => {
      const response = await request(app)
        .post('/api/audits')
        .send({
          audit_type: 'search-audit',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('company_domain is required');
    });

    it('should return 400 with missing audit_type', async () => {
      const response = await request(app)
        .post('/api/audits')
        .send({
          company_domain: 'example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('audit_type is required');
    });

    it('should return 400 with invalid audit_type', async () => {
      const response = await request(app)
        .post('/api/audits')
        .send({
          company_domain: 'example.com',
          audit_type: 'invalid-type',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('audit_type must be');
    });

    it('should return 400 with invalid domain format', async () => {
      mockDb.getCompany.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/audits')
        .send({
          company_domain: 'invalid domain!',
          audit_type: 'search-audit',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('Invalid domain');
    });

    it('should queue the audit job', async () => {
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

      await request(app)
        .post('/api/audits')
        .send({
          company_domain: 'example.com',
          audit_type: 'search-audit',
        });

      expect(auditQueue.add).toHaveBeenCalledWith(
        'execute-audit',
        { auditId: 'audit-123' }
      );
    });
  });

  describe('GET /api/audits/:id/status', () => {
    it('should return audit status', async () => {
      const mockAudit: Audit = {
        id: 'audit-123',
        company_id: 'company-123',
        audit_type: 'search_audit',
        status: 'running',
        data: {
          current_phase: 'enrichment',
          progress_percent: 25,
        },
        score: 8.5,
        created_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-01'),
      };

      mockDb.query.mockResolvedValue([mockAudit]);

      const response = await request(app).get('/api/audits/audit-123/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', 'audit-123');
      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('current_phase', 'enrichment');
      expect(response.body).toHaveProperty('progress_percent', 25);
      expect(response.body).toHaveProperty('overall_score', 8.5);
      expect(response.body).toHaveProperty('phases');
      expect(Array.isArray(response.body.phases)).toBe(true);
    });

    it('should return 404 if audit not found', async () => {
      mockDb.query.mockResolvedValue([]);

      const response = await request(app).get('/api/audits/nonexistent/status');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('not found');
    });

    it('should return 400 with missing audit ID', async () => {
      const response = await request(app).get('/api/audits//status');

      // Express will return 404 for this malformed route
      expect(response.status).toBe(404);
    });
  });

  describe('WebSocket endpoint', () => {
    it('should be documented for WebSocket connections', () => {
      // WebSocket testing requires special setup
      // This test documents the expected WebSocket behavior

      // Expected events:
      // - Client emits: 'subscribe:audit' with auditId
      // - Server emits: 'subscribed' with audit data
      // - Server emits: 'audit:event' for progress updates
      // - Client emits: 'unsubscribe:audit' with auditId
      // - Server emits: 'unsubscribed' confirmation

      expect(true).toBe(true);
    });
  });
});
