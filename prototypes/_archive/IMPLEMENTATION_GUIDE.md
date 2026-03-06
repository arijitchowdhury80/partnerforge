# Algolia Search Audit Platform - Implementation Guide

**Status**: Engineering Specification
**Date**: 2026-03-02
**Audience**: Backend, Frontend, DevOps Engineers

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Development Environment](#development-environment)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [MCP Integration](#mcp-integration)
6. [Testing Strategy](#testing-strategy)
7. [Deployment](#deployment)
8. [Monitoring & Observability](#monitoring--observability)

---

## Quick Start

### Prerequisites

```bash
# Required software
node >= 20.0.0
npm >= 10.0.0
docker >= 24.0.0
docker-compose >= 2.20.0

# Optional (for local MCP testing)
python >= 3.11
playwright >= 1.40.0
```

### Clone & Setup

```bash
# 1. Clone repository
git clone https://github.com/algolia/search-audit-platform.git
cd search-audit-platform

# 2. Install dependencies
npm install                    # Root workspace
cd frontend && npm install     # Frontend
cd ../backend && npm install   # Backend

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your API keys (BuiltWith, SimilarWeb, etc.)

# 4. Start local services (PostgreSQL + Redis)
docker-compose up -d

# 5. Run database migrations
cd backend && npm run migrate

# 6. Start development servers
npm run dev                    # Runs frontend + backend concurrently
```

**Endpoints**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## Development Environment

### Project Structure

```
search-audit-platform/
├── frontend/                  # React SPA
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Page components (Dashboard, AuditDetails, etc.)
│   │   ├── hooks/             # Custom React hooks
│   │   ├── stores/            # Zustand stores
│   │   ├── api/               # API client (axios)
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utility functions
│   ├── public/
│   ├── package.json
│   └── vite.config.ts         # Vite config
│
├── backend/                   # Node.js + Express API
│   ├── src/
│   │   ├── api/               # REST endpoints
│   │   │   ├── routes/        # Route definitions
│   │   │   └── controllers/   # Request handlers
│   │   ├── services/          # Business logic
│   │   │   ├── audit-engine.ts
│   │   │   ├── mcp-proxy.ts
│   │   │   ├── browser-pool.ts
│   │   │   └── phases/        # Phase 1-5 implementations
│   │   ├── db/                # Database layer
│   │   │   ├── migrations/
│   │   │   ├── models/        # Sequelize models
│   │   │   └── repositories/  # Data access layer
│   │   ├── websocket/         # Socket.IO server
│   │   ├── jobs/              # BullMQ job processors
│   │   ├── middleware/        # Express middleware (auth, validation)
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Utility functions
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                    # Shared types/utilities
│   ├── types/                 # Shared TypeScript types
│   └── constants/             # Shared constants
│
├── scripts/                   # Deployment & utility scripts
│   ├── seed-db.ts             # Seed development data
│   ├── migrate.ts             # Database migrations
│   └── test-mcp.ts            # Test MCP connections
│
├── docker-compose.yml         # Local development services
├── .env.example               # Environment variables template
├── package.json               # Root workspace config
└── README.md
```

### Environment Variables

```bash
# .env file (backend)

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/search_audit
REDIS_URL=redis://localhost:6379

# Authentication
OKTA_DOMAIN=dev-12345.okta.com
OKTA_CLIENT_ID=your_client_id
OKTA_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_jwt_secret

# MCP API Keys
BUILTWITH_API_KEY=your_builtwith_key
SIMILARWEB_API_KEY=your_similarweb_key
PERPLEXITY_API_KEY=your_perplexity_key

# File Storage
AWS_REGION=us-east-1
AWS_S3_BUCKET=algolia-search-audit-assets
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Browser Pool
BROWSER_POOL_SIZE=10
BROWSER_TIMEOUT=30000

# Application
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
```

---

## Backend Implementation

### 1. Database Models (Sequelize)

**User Model** (`backend/src/db/models/user.ts`):

```typescript
import { Model, DataTypes } from 'sequelize';
import sequelize from '../connection';

export class User extends Model {
  public id!: string;
  public okta_id!: string;
  public email!: string;
  public name!: string;
  public team!: string;
  public role!: string;
  public readonly created_at!: Date;
  public readonly last_login!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    okta_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    name: DataTypes.STRING(255),
    team: DataTypes.STRING(100),
    role: {
      type: DataTypes.STRING(50),
      defaultValue: 'user',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    last_login: DataTypes.DATE,
  },
  { sequelize, tableName: 'users', underscored: true, timestamps: false }
);
```

**Audit Model** (`backend/src/db/models/audit.ts`):

```typescript
import { Model, DataTypes } from 'sequelize';
import sequelize from '../connection';

export class Audit extends Model {
  public id!: string;
  public domain!: string;
  public company_name!: string;
  public vertical!: string;
  public created_by!: string;
  public created_at!: Date;
  public started_at!: Date;
  public completed_at!: Date;
  public status!: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  public phase!: string;
  public progress_pct!: number;
  public overall_score!: number;
  public critical_gaps!: number;
  public opportunity_min!: number;
  public opportunity_max!: number;
  public error_message!: string;
  public config!: object;
  public metadata!: object;
}

Audit.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    company_name: DataTypes.STRING(255),
    vertical: DataTypes.STRING(100),
    created_by: {
      type: DataTypes.UUID,
      references: { model: 'users', key: 'id' },
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    started_at: DataTypes.DATE,
    completed_at: DataTypes.DATE,
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    phase: DataTypes.STRING(50),
    progress_pct: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    overall_score: DataTypes.DECIMAL(3, 1),
    critical_gaps: DataTypes.INTEGER,
    opportunity_min: DataTypes.BIGINT,
    opportunity_max: DataTypes.BIGINT,
    error_message: DataTypes.TEXT,
    config: DataTypes.JSONB,
    metadata: DataTypes.JSONB,
  },
  { sequelize, tableName: 'audits', underscored: true, timestamps: false }
);

// Associations
User.hasMany(Audit, { foreignKey: 'created_by' });
Audit.belongsTo(User, { foreignKey: 'created_by' });
```

### 2. API Routes

**Audit Routes** (`backend/src/api/routes/audits.ts`):

```typescript
import { Router } from 'express';
import { requireAuth, requireOwnership } from '../middleware/auth';
import * as auditController from '../controllers/audit-controller';

const router = Router();

router.get('/audits', requireAuth, auditController.listAudits);
router.post('/audits', requireAuth, auditController.createAudit);
router.get('/audits/:id', requireAuth, requireOwnership, auditController.getAudit);
router.patch('/audits/:id', requireAuth, requireOwnership, auditController.updateAudit);
router.delete('/audits/:id', requireAuth, requireOwnership, auditController.deleteAudit);
router.post('/audits/:id/rerun', requireAuth, requireOwnership, auditController.rerunPhases);

// Scratchpad files
router.get('/audits/:id/scratchpad', requireAuth, requireOwnership, auditController.listScratchpad);
router.get('/audits/:id/scratchpad/:file', requireAuth, requireOwnership, auditController.getScratchpadFile);

// Screenshots
router.get('/audits/:id/screenshots', requireAuth, requireOwnership, auditController.listScreenshots);
router.get('/audits/:id/screenshots/:file', requireAuth, requireOwnership, auditController.getScreenshot);

// Deliverables
router.get('/audits/:id/deliverables', requireAuth, requireOwnership, auditController.listDeliverables);
router.get('/audits/:id/deliverables/:type', requireAuth, requireOwnership, auditController.downloadDeliverable);
router.post('/audits/:id/deliverables/:type/email', requireAuth, requireOwnership, auditController.emailDeliverable);

// Fact-check
router.post('/audits/:id/fact-check', requireAuth, requireOwnership, auditController.runFactCheck);

export default router;
```

**Controller Example** (`backend/src/api/controllers/audit-controller.ts`):

```typescript
import { Request, Response } from 'express';
import { AuditRepository } from '../../db/repositories/audit-repository';
import { enqueueAudit } from '../../jobs/audit-queue';

export async function createAudit(req: Request, res: Response) {
  try {
    const { domain, company_name, vertical, phases, custom_queries } = req.body;
    const userId = req.user.id;

    // Validate domain
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    // Create audit record
    const audit = await AuditRepository.create({
      domain,
      company_name,
      vertical,
      created_by: userId,
      status: 'pending',
      config: {
        phases: phases || ['phase_1', 'phase_2', 'phase_3', 'phase_4_5'],
        custom_queries: custom_queries || [],
      },
    });

    // Enqueue audit job
    await enqueueAudit(audit.id, audit.config);

    // Return audit
    res.status(201).json(audit);
  } catch (error) {
    console.error('Error creating audit:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function listAudits(req: Request, res: Response) {
  try {
    const userId = req.user.id;
    const { status, team, offset = 0, limit = 20 } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (team) filters.team = team;

    // Users see their own audits + team audits
    const audits = await AuditRepository.findAll({
      where: {
        created_by: userId,
        ...filters,
      },
      offset: Number(offset),
      limit: Number(limit),
      order: [['created_at', 'DESC']],
    });

    res.json(audits);
  } catch (error) {
    console.error('Error listing audits:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ... other controller methods
```

### 3. Audit Engine (Core Orchestration)

**Audit Engine** (`backend/src/services/audit-engine.ts`):

```typescript
import { Audit } from '../db/models/audit';
import { Phase1Service } from './phases/phase1-service';
import { Phase2Service } from './phases/phase2-service';
import { Phase3Service } from './phases/phase3-service';
import { Phase45Service } from './phases/phase45-service';
import { StatusCallback, AuditConfig } from '../types';

export class AuditEngine {
  private auditId: string;
  private config: AuditConfig;
  private statusCallback: StatusCallback;

  constructor(auditId: string, config: AuditConfig, statusCallback: StatusCallback) {
    this.auditId = auditId;
    this.config = config;
    this.statusCallback = statusCallback;
  }

  async run() {
    try {
      // Update status to in_progress
      await Audit.update(
        { status: 'in_progress', started_at: new Date() },
        { where: { id: this.auditId } }
      );

      // Phase 1: Pre-Audit Research
      if (this.config.phases.includes('phase_1')) {
        await this.runPhase1();
      }

      // Phase 2: Browser Testing
      if (this.config.phases.includes('phase_2')) {
        await this.runPhase2();
      }

      // Phase 3: Scoring
      if (this.config.phases.includes('phase_3')) {
        await this.runPhase3();
      }

      // Phase 4-5: Deliverables
      if (this.config.phases.includes('phase_4_5')) {
        await this.runPhase45();
      }

      // Mark as completed
      await Audit.update(
        { status: 'completed', completed_at: new Date(), progress_pct: 100 },
        { where: { id: this.auditId } }
      );

      this.statusCallback({ auditId: this.auditId, status: 'completed', progress_pct: 100 });
    } catch (error) {
      console.error('Audit engine error:', error);
      await Audit.update(
        {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date(),
        },
        { where: { id: this.auditId } }
      );

      this.statusCallback({
        auditId: this.auditId,
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  private async runPhase1() {
    this.statusCallback({
      auditId: this.auditId,
      phase: 'phase_1',
      message: 'Starting pre-audit research...',
    });

    await Audit.update({ phase: 'phase_1' }, { where: { id: this.auditId } });

    const phase1 = new Phase1Service(this.auditId, this.config, this.statusCallback);
    await phase1.execute();

    this.statusCallback({
      auditId: this.auditId,
      phase: 'phase_1',
      status: 'completed',
      message: 'Pre-audit research completed',
    });
  }

  private async runPhase2() {
    this.statusCallback({
      auditId: this.auditId,
      phase: 'phase_2',
      message: 'Starting browser testing...',
    });

    await Audit.update({ phase: 'phase_2' }, { where: { id: this.auditId } });

    const phase2 = new Phase2Service(this.auditId, this.config, this.statusCallback);
    await phase2.execute();

    this.statusCallback({
      auditId: this.auditId,
      phase: 'phase_2',
      status: 'completed',
      message: 'Browser testing completed',
    });
  }

  private async runPhase3() {
    // ... similar pattern
  }

  private async runPhase45() {
    // ... similar pattern
  }
}
```

### 4. Job Queue (BullMQ)

**Queue Setup** (`backend/src/jobs/audit-queue.ts`):

```typescript
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { AuditEngine } from '../services/audit-engine';
import { io } from '../websocket/server';

const connection = new IORedis(process.env.REDIS_URL);

export const auditQueue = new Queue('audits', { connection });

export const auditWorker = new Worker(
  'audits',
  async (job) => {
    const { auditId, config } = job.data;

    // Status callback broadcasts via WebSocket
    const statusCallback = (update: any) => {
      io.to(auditId).emit('audit:progress', update);
    };

    const engine = new AuditEngine(auditId, config, statusCallback);
    await engine.run();

    return { auditId, status: 'completed' };
  },
  {
    connection,
    concurrency: 5, // Process 5 audits concurrently
  }
);

// Job lifecycle events
auditWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
  io.to(job.data.auditId).emit('audit:complete', { auditId: job.data.auditId });
});

auditWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err);
  io.to(job.data.auditId).emit('audit:error', {
    auditId: job.data.auditId,
    error: err.message,
  });
});

// Enqueue audit
export async function enqueueAudit(auditId: string, config: any) {
  await auditQueue.add(
    'run-audit',
    { auditId, config },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000, // 1 minute
      },
    }
  );
}
```

### 5. WebSocket Server

**Socket.IO Setup** (`backend/src/websocket/server.ts`):

```typescript
import { Server } from 'socket.io';
import { createServer } from 'http';
import app from '../app'; // Express app

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Subscribe to audit updates
  socket.on('subscribe', ({ auditId }) => {
    socket.join(auditId);
    console.log(`Client ${socket.id} subscribed to audit ${auditId}`);
  });

  // Unsubscribe from audit updates
  socket.on('unsubscribe', ({ auditId }) => {
    socket.leave(auditId);
    console.log(`Client ${socket.id} unsubscribed from audit ${auditId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

export default httpServer;
```

---

## Frontend Implementation

### 1. API Client (Axios)

**API Client** (`frontend/src/api/client.ts`):

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor (add auth token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor (handle errors)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

**API Endpoints** (`frontend/src/api/audits.ts`):

```typescript
import apiClient from './client';
import { Audit, AuditCreateRequest } from '../types';

export const auditsApi = {
  list: (params?: { status?: string; team?: string; offset?: number; limit?: number }) =>
    apiClient.get<Audit[]>('/audits', { params }),

  create: (data: AuditCreateRequest) => apiClient.post<Audit>('/audits', data),

  get: (id: string) => apiClient.get<Audit>(`/audits/${id}`),

  update: (id: string, data: Partial<Audit>) => apiClient.patch<Audit>(`/audits/${id}`, data),

  delete: (id: string) => apiClient.delete(`/audits/${id}`),

  rerun: (id: string, phases: string[]) =>
    apiClient.post(`/audits/${id}/rerun`, { phases }),

  // Scratchpad
  getScratchpad: (id: string, file: string) =>
    apiClient.get<string>(`/audits/${id}/scratchpad/${file}`),

  // Screenshots
  getScreenshots: (id: string) =>
    apiClient.get<Screenshot[]>(`/audits/${id}/screenshots`),

  // Deliverables
  getDeliverables: (id: string) =>
    apiClient.get<Deliverable[]>(`/audits/${id}/deliverables`),

  downloadDeliverable: (id: string, type: string) =>
    apiClient.get(`/audits/${id}/deliverables/${type}`, { responseType: 'blob' }),
};
```

### 2. State Management (Zustand)

**Audit Store** (`frontend/src/stores/audit-store.ts`):

```typescript
import { create } from 'zustand';
import { Audit } from '../types';
import { auditsApi } from '../api/audits';

interface AuditState {
  audits: Audit[];
  currentAudit: Audit | null;
  loading: boolean;
  error: string | null;

  fetchAudits: (params?: any) => Promise<void>;
  fetchAudit: (id: string) => Promise<void>;
  createAudit: (data: any) => Promise<Audit>;
  updateAudit: (id: string, data: Partial<Audit>) => Promise<void>;
  deleteAudit: (id: string) => Promise<void>;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  audits: [],
  currentAudit: null,
  loading: false,
  error: null,

  fetchAudits: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await auditsApi.list(params);
      set({ audits: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  fetchAudit: async (id) => {
    set({ loading: true, error: null });
    try {
      const response = await auditsApi.get(id);
      set({ currentAudit: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
    }
  },

  createAudit: async (data) => {
    set({ loading: true, error: null });
    try {
      const response = await auditsApi.create(data);
      set((state) => ({
        audits: [response.data, ...state.audits],
        loading: false,
      }));
      return response.data;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateAudit: async (id, data) => {
    try {
      const response = await auditsApi.update(id, data);
      set((state) => ({
        audits: state.audits.map((a) => (a.id === id ? response.data : a)),
        currentAudit: state.currentAudit?.id === id ? response.data : state.currentAudit,
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  deleteAudit: async (id) => {
    try {
      await auditsApi.delete(id);
      set((state) => ({
        audits: state.audits.filter((a) => a.id !== id),
      }));
    } catch (error: any) {
      set({ error: error.message });
    }
  },
}));
```

### 3. Real-Time Updates (Socket.IO)

**Socket Hook** (`frontend/src/hooks/useSocket.ts`):

```typescript
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket(auditId: string, onProgress: (data: any) => void) {
  useEffect(() => {
    // Initialize socket once
    if (!socket) {
      socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4000', {
        auth: {
          token: localStorage.getItem('access_token'),
        },
      });
    }

    // Subscribe to audit updates
    socket.emit('subscribe', { auditId });

    // Listen for progress updates
    socket.on('audit:progress', onProgress);
    socket.on('audit:phase_complete', onProgress);
    socket.on('audit:complete', onProgress);
    socket.on('audit:error', onProgress);

    // Cleanup
    return () => {
      socket?.emit('unsubscribe', { auditId });
      socket?.off('audit:progress');
      socket?.off('audit:phase_complete');
      socket?.off('audit:complete');
      socket?.off('audit:error');
    };
  }, [auditId, onProgress]);
}
```

**Usage in Component**:

```typescript
import { useSocket } from '../hooks/useSocket';

function ExecutionMonitor({ auditId }: { auditId: string }) {
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  useSocket(auditId, (data) => {
    if (data.progress_pct) {
      setProgress(data.progress_pct);
    }
    if (data.message) {
      setLogs((prev) => [...prev, data.message]);
    }
  });

  return (
    <div>
      <ProgressBar value={progress} />
      <LogViewer logs={logs} />
    </div>
  );
}
```

### 4. Key Components

**Audit Card** (`frontend/src/components/AuditCard.tsx`):

```typescript
import { Audit } from '../types';

interface AuditCardProps {
  audit: Audit;
  onView: () => void;
  onDownload: () => void;
  onStar: () => void;
}

export function AuditCard({ audit, onView, onDownload, onStar }: AuditCardProps) {
  const statusColors = {
    completed: 'green',
    in_progress: 'yellow',
    failed: 'red',
    pending: 'gray',
  };

  return (
    <div className="audit-card">
      <div className="audit-card__header">
        <h3>{audit.company_name}</h3>
        <span className={`badge badge--${statusColors[audit.status]}`}>
          {audit.status.toUpperCase()}
        </span>
      </div>

      <div className="audit-card__metadata">
        <span>Created: {new Date(audit.created_at).toLocaleDateString()}</span>
        <span>by {audit.created_by.name}</span>
      </div>

      {audit.overall_score && (
        <div className="audit-card__metrics">
          <span>Score: {audit.overall_score}/10</span>
          <span>{audit.critical_gaps} Critical Gaps</span>
          <span>
            ${audit.opportunity_min / 1e6}M-${audit.opportunity_max / 1e6}M Opportunity
          </span>
        </div>
      )}

      <div className="audit-card__actions">
        <button onClick={onView}>View Report</button>
        <button onClick={onDownload}>Download All</button>
        <button onClick={onStar}>⭐ Star</button>
      </div>
    </div>
  );
}
```

---

## MCP Integration

### MCP Proxy Service

**BuiltWith Proxy** (`backend/src/services/mcp-proxy/builtwith.ts`):

```typescript
import axios from 'axios';
import { RedisClient } from '../../utils/redis';

export class BuiltWithProxy {
  private redis: RedisClient;
  private apiKey: string;

  constructor() {
    this.redis = new RedisClient();
    this.apiKey = process.env.BUILTWITH_API_KEY;
  }

  async domainLookup(domain: string): Promise<any> {
    const cacheKey = `builtwith:domain-lookup:${domain}`;

    // Check cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Call API
    const response = await axios.get(
      `https://api.builtwith.com/v20/api.json?KEY=${this.apiKey}&LOOKUP=${domain}`
    );

    // Cache for 24 hours
    await this.redis.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  }

  async relationshipsApi(domain: string): Promise<any> {
    const cacheKey = `builtwith:relationships:${domain}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await axios.get(
      `https://api.builtwith.com/rv1/api.json?KEY=${this.apiKey}&LOOKUP=${domain}`
    );

    await this.redis.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  }

  // ... other endpoints
}
```

**SimilarWeb Proxy** (`backend/src/services/mcp-proxy/similarweb.ts`):

```typescript
import axios from 'axios';
import { RedisClient } from '../../utils/redis';

export class SimilarWebProxy {
  private redis: RedisClient;
  private apiKey: string;
  private baseUrl = 'https://api.similarweb.com/v1';

  constructor() {
    this.redis = new RedisClient();
    this.apiKey = process.env.SIMILARWEB_API_KEY;
  }

  async getTrafficAndEngagement(
    domain: string,
    params: { start_date: string; end_date: string; country: string; web_source: string }
  ): Promise<any> {
    const cacheKey = `similarweb:traffic:${domain}:${JSON.stringify(params)}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const response = await axios.get(`${this.baseUrl}/website/${domain}/traffic-and-engagement/visits`, {
      params,
      headers: { 'api-key': this.apiKey },
    });

    await this.redis.setex(cacheKey, 86400, JSON.stringify(response.data));

    return response.data;
  }

  async getTrafficSources(domain: string, params: any): Promise<any> {
    // ... similar pattern
  }

  // ... other 12 endpoints
}
```

---

## Testing Strategy

### Backend Tests

**Unit Test Example** (`backend/tests/services/audit-engine.test.ts`):

```typescript
import { AuditEngine } from '../../src/services/audit-engine';
import { Audit } from '../../src/db/models/audit';
import { Phase1Service } from '../../src/services/phases/phase1-service';

jest.mock('../../src/services/phases/phase1-service');
jest.mock('../../src/db/models/audit');

describe('AuditEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should run Phase 1 successfully', async () => {
    const config = { phases: ['phase_1'], domain: 'costco.com' };
    const statusCallback = jest.fn();

    const engine = new AuditEngine('audit-123', config, statusCallback);

    Phase1Service.prototype.execute = jest.fn().mockResolvedValue({});

    await engine.run();

    expect(Phase1Service.prototype.execute).toHaveBeenCalled();
    expect(Audit.update).toHaveBeenCalledWith(
      { status: 'completed', completed_at: expect.any(Date), progress_pct: 100 },
      { where: { id: 'audit-123' } }
    );
  });

  it('should handle Phase 1 failure', async () => {
    const config = { phases: ['phase_1'], domain: 'costco.com' };
    const statusCallback = jest.fn();

    const engine = new AuditEngine('audit-123', config, statusCallback);

    Phase1Service.prototype.execute = jest.fn().mockRejectedValue(new Error('MCP error'));

    await expect(engine.run()).rejects.toThrow('MCP error');

    expect(Audit.update).toHaveBeenCalledWith(
      {
        status: 'failed',
        error_message: 'MCP error',
        completed_at: expect.any(Date),
      },
      { where: { id: 'audit-123' } }
    );
  });
});
```

**Integration Test Example** (`backend/tests/api/audits.integration.test.ts`):

```typescript
import request from 'supertest';
import app from '../../src/app';
import { User } from '../../src/db/models/user';
import { generateToken } from '../../src/utils/auth';

describe('POST /api/audits', () => {
  let token: string;

  beforeAll(async () => {
    const user = await User.create({
      okta_id: 'test-okta-id',
      email: 'test@algolia.com',
      name: 'Test User',
      team: 'Engineering',
    });
    token = generateToken(user);
  });

  it('should create a new audit', async () => {
    const response = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${token}`)
      .send({
        domain: 'costco.com',
        company_name: 'Costco Wholesale',
        vertical: 'General Retail',
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.domain).toBe('costco.com');
    expect(response.body.status).toBe('pending');
  });

  it('should return 400 if domain is missing', async () => {
    const response = await request(app)
      .post('/api/audits')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Domain is required');
  });
});
```

### Frontend Tests

**Component Test Example** (`frontend/src/components/AuditCard.test.tsx`):

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { AuditCard } from './AuditCard';

const mockAudit = {
  id: 'audit-123',
  company_name: 'Costco Wholesale',
  domain: 'costco.com',
  status: 'completed',
  created_at: new Date('2026-02-21'),
  created_by: { name: 'Alex Rivera' },
  overall_score: 4.4,
  critical_gaps: 3,
  opportunity_min: 15000000,
  opportunity_max: 30000000,
};

describe('AuditCard', () => {
  it('should render audit information', () => {
    render(
      <AuditCard
        audit={mockAudit}
        onView={jest.fn()}
        onDownload={jest.fn()}
        onStar={jest.fn()}
      />
    );

    expect(screen.getByText('Costco Wholesale')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('Score: 4.4/10')).toBeInTheDocument();
  });

  it('should call onView when View Report is clicked', () => {
    const onView = jest.fn();

    render(
      <AuditCard
        audit={mockAudit}
        onView={onView}
        onDownload={jest.fn()}
        onStar={jest.fn()}
      />
    );

    fireEvent.click(screen.getByText('View Report'));

    expect(onView).toHaveBeenCalled();
  });
});
```

---

## Deployment

### Docker Setup

**Dockerfile (Backend)**:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 4000

CMD ["node", "dist/index.js"]
```

**docker-compose.yml (Production)**:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: search_audit
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://admin:${DB_PASSWORD}@postgres:5432/search_audit
      REDIS_URL: redis://redis:6379
      NODE_ENV: production
    depends_on:
      - postgres
      - redis
    ports:
      - "4000:4000"

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: https://api.searchaudit.algolia.com
    ports:
      - "3000:3000"

volumes:
  postgres_data:
  redis_data:
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm test

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to AWS
        run: |
          # Build Docker image
          docker build -t search-audit-backend ./backend
          # Push to ECR
          # Deploy to ECS
          # (AWS CLI commands here)

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        run: npx vercel deploy --prod
```

---

## Monitoring & Observability

### Logging (Winston)

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### Error Tracking (Sentry)

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Express error handler
app.use(Sentry.Handlers.errorHandler());
```

### Metrics (Prometheus)

```typescript
import client from 'prom-client';

const register = new client.Registry();

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

register.registerMetric(httpRequestDuration);

// Expose metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Summary

This implementation guide provides:

1. **Quick Start**: Clone, setup, and run locally in 5 steps
2. **Backend**: Models, routes, controllers, audit engine, job queue
3. **Frontend**: API client, state management, real-time updates, components
4. **MCP Integration**: Proxy services with caching
5. **Testing**: Unit tests, integration tests, component tests
6. **Deployment**: Docker, CI/CD, monitoring

**Next Steps**:
1. Run `npm install` in frontend and backend
2. Setup environment variables
3. Start Docker services (PostgreSQL + Redis)
4. Run migrations
5. Start development servers
6. Begin implementation following the roadmap in SAAS_ARCHITECTURE.md

**Questions?** Contact the Engineering Team lead or open an issue in the repo.

---

**Document Version**: 1.0
**Last Updated**: 2026-03-02
**Status**: Ready for Engineering Kickoff
