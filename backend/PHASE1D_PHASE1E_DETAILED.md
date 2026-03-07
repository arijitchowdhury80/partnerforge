# Phase 1D & 1E: Browser Automation + AI Copilot

**Purpose**: Core UX features that make Algolia-Arian a modern, self-service platform
**Status**: 🏗️ To Be Built (Week 1)
**Total**: 10 files, ~1,850 lines
**Time**: 5-7 hours (parallelizable with Agents 4 and 5)

---

## 🎯 Why These Are Core (Not Add-Ons)

### Browser Automation = Core Search Audit Experience
- Without live browser testing, the platform is just a data aggregator
- Users MUST see what's happening in real-time (transparency + trust)
- Screenshots + annotations = verifiable findings
- This is the primary value proposition

### AI Copilot = Self-Service Onboarding
- Complex platform with multiple data sources, screens, and workflows
- Users should NOT need training or onboarding calls
- Chat guides users through the interface contextually
- Grows smarter as the system grows (learns from usage patterns)

---

# Phase 1D: Browser Automation (Agent 4)

**Files**: 4 files, ~700 lines
**Time**: 2-3 hours
**Dependencies**: Phase 1A complete (needs http-client.ts, logger.ts, errors.ts)

---

## File 1D.1: `services/browser-automation.ts`

**Purpose**: Playwright wrapper for running search audits with screenshot capture
**Lines**: ~250

### Core Functionality

```typescript
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface BrowserTestStep {
  id: string;
  name: string;
  query?: string;
  action: 'navigate' | 'search' | 'click' | 'scroll' | 'wait';
  selector?: string;
  expectedResults?: {
    minResults?: number;
    contains?: string[];
    excludes?: string[];
  };
}

export interface Screenshot {
  testId: string;
  query?: string;
  imagePath: string;
  imageBase64: string;
  timestamp: Date;
  annotations?: Annotation[];
}

export interface Annotation {
  type: 'box' | 'arrow' | 'label';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
}

export interface BrowserTestResult {
  testId: string;
  passed: boolean;
  finding?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  screenshot: Screenshot;
}

export class BrowserAutomationService extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private screenshotPath: string;

  constructor(screenshotPath = './screenshots') {
    super();
    this.screenshotPath = screenshotPath;
  }

  async initialize() {
    logger.info('Initializing browser automation');

    this.browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS === 'true',
      timeout: parseInt(process.env.BROWSER_TIMEOUT || '30000'),
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });

    this.page = await this.context.newPage();

    logger.info('Browser initialized');
  }

  async runSearchAudit(
    domain: string,
    testSteps: BrowserTestStep[]
  ): Promise<BrowserTestResult[]> {
    if (!this.page) {
      throw new AppError('Browser not initialized', 'BROWSER_ERROR', 500);
    }

    const results: BrowserTestResult[] = [];

    this.emit('audit:started', { domain, totalSteps: testSteps.length });

    for (const [index, step] of testSteps.entries()) {
      this.emit('test:started', {
        step: step.name,
        query: step.query,
        progress: `${index + 1}/${testSteps.length}`,
      });

      try {
        const result = await this.runTestStep(domain, step);
        results.push(result);

        this.emit('test:completed', {
          testId: step.id,
          passed: result.passed,
          finding: result.finding,
        });

        // Stream screenshot to frontend
        this.emit('screenshot:captured', {
          testId: step.id,
          query: step.query,
          image: result.screenshot.imageBase64,
          timestamp: result.screenshot.timestamp,
        });

        if (!result.passed && result.finding) {
          this.emit('finding:detected', {
            testId: step.id,
            severity: result.severity,
            title: result.finding,
            screenshotPath: result.screenshot.imagePath,
          });
        }
      } catch (error) {
        logger.error('Test step failed', { step: step.name, error });
        this.emit('test:failed', { testId: step.id, error: error.message });
      }
    }

    this.emit('audit:completed', { totalTests: results.length });

    return results;
  }

  private async runTestStep(
    domain: string,
    step: BrowserTestStep
  ): Promise<BrowserTestResult> {
    const page = this.page!;

    switch (step.action) {
      case 'navigate':
        await page.goto(`https://${domain}`, { waitUntil: 'networkidle' });
        break;

      case 'search':
        if (!step.query) throw new Error('Search query required');

        // Find search input (try common selectors)
        const searchSelectors = [
          'input[type="search"]',
          'input[name="q"]',
          'input[placeholder*="Search"]',
          '[data-testid="search-input"]',
          '.search-input',
        ];

        let searchInput = null;
        for (const selector of searchSelectors) {
          searchInput = await page.$(selector);
          if (searchInput) break;
        }

        if (!searchInput) {
          throw new Error('Search input not found');
        }

        await searchInput.fill(step.query);
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');
        break;

      case 'click':
        if (!step.selector) throw new Error('Selector required for click');
        await page.click(step.selector);
        await page.waitForLoadState('networkidle');
        break;

      case 'scroll':
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(500);
        break;

      case 'wait':
        await page.waitForTimeout(2000);
        break;
    }

    // Capture screenshot
    const screenshot = await this.captureScreenshot(step.id, step.query);

    // Analyze results
    const analysis = await this.analyzeResults(page, step);

    return {
      testId: step.id,
      passed: analysis.passed,
      finding: analysis.finding,
      severity: analysis.severity,
      screenshot,
    };
  }

  private async captureScreenshot(
    testId: string,
    query?: string
  ): Promise<Screenshot> {
    const page = this.page!;
    const timestamp = new Date();
    const filename = `${testId}-${timestamp.getTime()}.png`;
    const imagePath = `${this.screenshotPath}/${filename}`;

    const screenshotBuffer = await page.screenshot({
      path: imagePath,
      fullPage: true,
    });

    const imageBase64 = screenshotBuffer.toString('base64');

    return {
      testId,
      query,
      imagePath,
      imageBase64,
      timestamp,
      annotations: [], // Will be populated by annotation engine
    };
  }

  private async analyzeResults(
    page: Page,
    step: BrowserTestStep
  ): Promise<{ passed: boolean; finding?: string; severity?: string }> {
    if (!step.expectedResults) {
      return { passed: true };
    }

    // Count results
    const resultCount = await page.locator('.search-result, .product-item, [data-testid="result"]').count();

    // Check minimum results
    if (step.expectedResults.minResults && resultCount < step.expectedResults.minResults) {
      return {
        passed: false,
        finding: `Only ${resultCount} results found (expected at least ${step.expectedResults.minResults})`,
        severity: 'high',
      };
    }

    // Check for required content
    if (step.expectedResults.contains) {
      const pageContent = await page.textContent('body');
      for (const keyword of step.expectedResults.contains) {
        if (!pageContent?.includes(keyword)) {
          return {
            passed: false,
            finding: `Expected content "${keyword}" not found`,
            severity: 'medium',
          };
        }
      }
    }

    // Check for excluded content
    if (step.expectedResults.excludes) {
      const pageContent = await page.textContent('body');
      for (const keyword of step.expectedResults.excludes) {
        if (pageContent?.includes(keyword)) {
          return {
            passed: false,
            finding: `Unwanted content "${keyword}" found`,
            severity: 'low',
          };
        }
      }
    }

    return { passed: true };
  }

  async cleanup() {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    logger.info('Browser cleaned up');
  }
}
```

---

## File 1D.2: `services/websocket-manager.ts`

**Purpose**: Socket.IO setup for live streaming audit progress to frontend
**Lines**: ~150

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { logger } from '../utils/logger';

export interface AuditStreamEvent {
  type: 'audit:started' | 'test:started' | 'test:completed' | 'test:failed' |
        'screenshot:captured' | 'finding:detected' | 'audit:completed';
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
      },
      path: '/ws',
    });

    this.setupEventHandlers();
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
      });

      // Unsubscribe from audit updates
      socket.on('unsubscribe:audit', (auditId: string) => {
        logger.info('Client unsubscribed from audit', { socketId: socket.id, auditId });

        this.activeAudits.get(auditId)?.delete(socket.id);
        socket.leave(`audit:${auditId}`);
      });

      // Disconnect
      socket.on('disconnect', () => {
        logger.info('WebSocket client disconnected', { socketId: socket.id });

        // Clean up subscriptions
        for (const [auditId, sockets] of this.activeAudits.entries()) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.activeAudits.delete(auditId);
          }
        }
      });
    });
  }

  // Emit event to all clients subscribed to an audit
  emitAuditEvent(auditId: string, event: AuditStreamEvent) {
    this.io.to(`audit:${auditId}`).emit('audit:event', {
      ...event,
      timestamp: new Date(),
    });
  }

  // Emit progress update
  emitProgress(auditId: string, current: number, total: number) {
    this.emitAuditEvent(auditId, {
      type: 'test:started',
      data: { progress: { current, total } },
      timestamp: new Date(),
    });
  }

  // Emit screenshot
  emitScreenshot(auditId: string, screenshot: any) {
    this.emitAuditEvent(auditId, {
      type: 'screenshot:captured',
      data: screenshot,
      timestamp: new Date(),
    });
  }

  // Emit finding
  emitFinding(auditId: string, finding: any) {
    this.emitAuditEvent(auditId, {
      type: 'finding:detected',
      data: finding,
      timestamp: new Date(),
    });
  }

  // Get active connections for an audit
  getActiveConnections(auditId: string): number {
    return this.activeAudits.get(auditId)?.size || 0;
  }
}
```

---

## File 1D.3: `workers/audit-browser-worker.ts`

**Purpose**: BullMQ worker that runs browser audits in background
**Lines**: ~200

```typescript
import { Worker, Job } from 'bullmq';
import { BrowserAutomationService } from '../services/browser-automation';
import { WebSocketManager } from '../services/websocket-manager';
import { logger } from '../utils/logger';
import { supabase } from '../database/supabase';

export interface AuditBrowserJobData {
  auditId: string;
  companyId: string;
  domain: string;
  testSteps: any[];
}

export function createAuditBrowserWorker(wsManager: WebSocketManager) {
  const worker = new Worker<AuditBrowserJobData>(
    'audit-browser',
    async (job: Job<AuditBrowserJobData>) => {
      const { auditId, companyId, domain, testSteps } = job.data;

      logger.info('Starting browser audit', { auditId, domain });

      const browser = new BrowserAutomationService();

      try {
        await browser.initialize();

        // Forward browser events to WebSocket
        browser.on('audit:started', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'audit:started',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('test:started', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'test:started',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('test:completed', (data) => {
          wsManager.emitAuditEvent(auditId, {
            type: 'test:completed',
            data,
            timestamp: new Date(),
          });
        });

        browser.on('screenshot:captured', (data) => {
          wsManager.emitScreenshot(auditId, data);
        });

        browser.on('finding:detected', (data) => {
          wsManager.emitFinding(auditId, data);
        });

        // Run the audit
        const results = await browser.runSearchAudit(domain, testSteps);

        // Save results to database
        await supabase
          .from('audits')
          .update({
            browser_test_results: results,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', auditId);

        logger.info('Browser audit completed', {
          auditId,
          totalTests: results.length,
          passed: results.filter((r) => r.passed).length,
        });

        wsManager.emitAuditEvent(auditId, {
          type: 'audit:completed',
          data: { results },
          timestamp: new Date(),
        });

        return { success: true, results };
      } catch (error) {
        logger.error('Browser audit failed', { auditId, error });

        await supabase
          .from('audits')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', auditId);

        throw error;
      } finally {
        await browser.cleanup();
      }
    },
    {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
      concurrency: parseInt(process.env.MAX_CONCURRENT_BROWSERS || '3'),
      limiter: {
        max: 3, // Max 3 concurrent browser audits
        duration: 60000, // Per minute
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info('Browser audit worker completed', { jobId: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.error('Browser audit worker failed', { jobId: job?.id, error: err });
  });

  return worker;
}
```

---

## File 1D.4: `api/audits/live-stream.ts`

**Purpose**: WebSocket endpoint setup in Express
**Lines**: ~100

```typescript
import { Router } from 'express';
import { WebSocketManager } from '../../services/websocket-manager';

export function createLiveStreamRoutes(wsManager: WebSocketManager) {
  const router = Router();

  // Get active connections for an audit
  router.get('/audits/:auditId/connections', (req, res) => {
    const { auditId } = req.params;
    const activeConnections = wsManager.getActiveConnections(auditId);

    res.json({
      auditId,
      activeConnections,
      timestamp: new Date(),
    });
  });

  // Manually trigger a test event (for debugging)
  router.post('/audits/:auditId/test-event', (req, res) => {
    const { auditId } = req.params;
    const { type, data } = req.body;

    wsManager.emitAuditEvent(auditId, {
      type,
      data,
      timestamp: new Date(),
    });

    res.json({ success: true });
  });

  return router;
}
```

---

# Phase 1E: AI Copilot (Agent 5)

**Files**: 6 files, ~1,150 lines
**Time**: 3-4 hours
**Dependencies**: Phase 1B complete (needs database/supabase.ts)

---

## File 1E.1: `services/copilot.ts`

**Purpose**: Anthropic Agent SDK integration with tool-first architecture
**Lines**: ~300

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { CopilotTools } from './copilot-tools';
import { CopilotContext } from './copilot-context';
import { CopilotRAG } from './copilot-rag';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotResponse {
  message: string;
  actions?: Action[];
  navigation?: string; // URL to navigate to
  citations?: string[];
}

export interface Action {
  type: 'button' | 'link';
  label: string;
  action: string;
  data?: any;
}

export class CopilotService {
  private anthropic: Anthropic;
  private tools: CopilotTools;
  private contextService: CopilotContext;
  private ragService: CopilotRAG;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    this.tools = new CopilotTools();
    this.contextService = new CopilotContext();
    this.ragService = new CopilotRAG();
  }

  async chat(
    userId: string,
    message: string,
    conversationHistory: Message[],
    userContext?: any
  ): Promise<CopilotResponse> {
    logger.info('Copilot chat request', { userId, message });

    // Get user's current page context
    const pageContext = userContext || await this.contextService.getContext(userId);

    // Get relevant documentation (RAG)
    const docContext = await this.ragService.search(message);

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(pageContext, docContext);

    // Call Anthropic Agent SDK
    const response = await this.anthropic.messages.create({
      model: process.env.COPILOT_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: parseInt(process.env.COPILOT_MAX_TOKENS || '2048'),
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: 'user', content: message }
      ],
      tools: this.tools.getToolDefinitions(),
    });

    // Handle tool use
    if (response.stop_reason === 'tool_use') {
      const toolResults = await this.executeTools(response);

      // Continue conversation with tool results
      const finalResponse = await this.anthropic.messages.create({
        model: process.env.COPILOT_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        ],
      });

      return this.formatResponse(finalResponse, pageContext);
    }

    return this.formatResponse(response, pageContext);
  }

  private buildSystemPrompt(pageContext: any, docContext: string): string {
    return `You are the Algolia Arian Copilot, an AI assistant embedded throughout the Partner Intelligence platform.

CRITICAL RULES:
1. ONLY answer questions about data in the database (companies, audits, technologies, enrichment data)
2. ALWAYS call the appropriate tool BEFORE answering data questions - never guess or make up data
3. NEVER invent statistics, scores, or metrics that don't exist in the database
4. If you don't have the data, say "I don't have that information in the database"
5. ALWAYS cite sources with (Company ID, Audit ID, Date) format
6. Provide navigation buttons like [View Company →] when relevant

USER CONTEXT:
- Current Page: ${pageContext.page || 'unknown'}
- Viewing Company: ${pageContext.companyName || 'none'}
- Company ID: ${pageContext.companyId || 'none'}
- Current Tab: ${pageContext.tab || 'none'}

AVAILABLE TOOLS:
- getCompany(domain): Get company profile, ICP score, status, technologies
- getLatestAudit(companyId): Get most recent audit with findings, scores, screenshots
- searchCompanies(filters): Filter companies by technology, ICP score, status, traffic
- getTechnologies(companyId): Get full tech stack from BuiltWith
- getFinancials(companyId): Get revenue, growth, margins
- getCompetitors(companyId): Get competitor analysis

RELEVANT DOCUMENTATION:
${docContext}

RESPONSE STYLE:
- Concise and actionable (2-3 sentences max)
- Include navigation buttons when helpful
- Use markdown for formatting
- Cite sources for all data points

EXAMPLES:

User: "What's Costco's search provider?"
You: "According to the audit from March 1, 2026 (Audit ID: aud_123), Costco uses **Elastic Enterprise Search** v8.1. [View Tech Stack →]"

User: "Show me hot leads using Adobe AEM"
You: "I found 47 companies using Adobe AEM with ICP score ≥80 (Hot status). Top 5:
1. Hallmark (Score: 92) - Retail, $4.2B revenue
2. Herman Miller (Score: 88) - Furniture, $2.8B revenue
...
[View All 47 →]"

User: "Why is their search score low?"
You: "Costco scored 4.4/10 on search experience. Main gaps:
• **No NLP** - Complex queries return irrelevant results
• **Zero recommendations** - No "You might also like"
• **Poor typo handling** - Misspellings return no results
[View Full Scorecard →]"

FORBIDDEN:
- General web search or external knowledge
- Making recommendations without data
- Executing actions without user approval
- Answering questions about other products/companies not in the database`;
  }

  private async executeTools(response: any): Promise<any[]> {
    const toolCalls = response.content.filter((c: any) => c.type === 'tool_use');

    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall: any) => {
        const result = await this.tools.executeTool(toolCall.name, toolCall.input);

        return {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(result),
        };
      })
    );

    return toolResults;
  }

  private formatResponse(response: any, pageContext: any): CopilotResponse {
    const messageContent = response.content.find((c: any) => c.type === 'text');
    const message = messageContent?.text || '';

    // Extract navigation buttons from markdown links
    const navigationRegex = /\[([^\]]+)\s*→\]/g;
    const actions: Action[] = [];
    let match;

    while ((match = navigationRegex.exec(message)) !== null) {
      actions.push({
        type: 'button',
        label: match[1],
        action: 'navigate',
        data: this.inferNavigationPath(match[1], pageContext),
      });
    }

    return {
      message,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private inferNavigationPath(label: string, pageContext: any): string {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.includes('tech stack')) {
      return `/companies/${pageContext.companyId}/tech-stack`;
    } else if (lowerLabel.includes('scorecard')) {
      return `/audits/${pageContext.auditId}/scorecard`;
    } else if (lowerLabel.includes('findings')) {
      return `/audits/${pageContext.auditId}/findings`;
    } else if (lowerLabel.includes('company')) {
      return `/companies/${pageContext.companyId}`;
    }

    return '/';
  }
}
```

---

## File 1E.2: `services/copilot-tools.ts`

**Purpose**: MCP tool definitions for database queries
**Lines**: ~250

```typescript
import { supabase } from '../database/supabase';
import { logger } from '../utils/logger';

export class CopilotTools {
  getToolDefinitions() {
    return [
      {
        name: 'getCompany',
        description: 'Get company details by domain (profile, ICP score, status, technologies)',
        input_schema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Company domain (e.g., costco.com)',
            },
          },
          required: ['domain'],
        },
      },
      {
        name: 'getLatestAudit',
        description: 'Get the most recent audit for a company (findings, scores, screenshots)',
        input_schema: {
          type: 'object',
          properties: {
            companyId: {
              type: 'string',
              description: 'Company ID (comp_xxx)',
            },
          },
          required: ['companyId'],
        },
      },
      {
        name: 'searchCompanies',
        description: 'Search companies by filters (technology, ICP score, status, traffic)',
        input_schema: {
          type: 'object',
          properties: {
            technology: {
              type: 'string',
              description: 'Filter by technology (e.g., Adobe AEM, Elastic)',
            },
            icpScore: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
              },
            },
            status: {
              type: 'string',
              enum: ['hot', 'warm', 'cold'],
              description: 'Filter by ICP status',
            },
            limit: {
              type: 'number',
              description: 'Max results (default 10)',
            },
          },
        },
      },
      {
        name: 'getTechnologies',
        description: 'Get full technology stack for a company from BuiltWith',
        input_schema: {
          type: 'object',
          properties: {
            companyId: {
              type: 'string',
              description: 'Company ID',
            },
          },
          required: ['companyId'],
        },
      },
      {
        name: 'getFinancials',
        description: 'Get financial data for a company (revenue, growth, margins)',
        input_schema: {
          type: 'object',
          properties: {
            companyId: {
              type: 'string',
              description: 'Company ID',
            },
          },
          required: ['companyId'],
        },
      },
      {
        name: 'getCompetitors',
        description: 'Get competitor analysis for a company from SimilarWeb',
        input_schema: {
          type: 'object',
          properties: {
            companyId: {
              type: 'string',
              description: 'Company ID',
            },
          },
          required: ['companyId'],
        },
      },
    ];
  }

  async executeTool(toolName: string, input: any): Promise<any> {
    logger.info('Executing copilot tool', { toolName, input });

    switch (toolName) {
      case 'getCompany':
        return this.getCompany(input.domain);

      case 'getLatestAudit':
        return this.getLatestAudit(input.companyId);

      case 'searchCompanies':
        return this.searchCompanies(input);

      case 'getTechnologies':
        return this.getTechnologies(input.companyId);

      case 'getFinancials':
        return this.getFinancials(input.companyId);

      case 'getCompetitors':
        return this.getCompetitors(input.companyId);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async getCompany(domain: string) {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('domain', domain)
      .single();

    if (error) throw error;
    return data;
  }

  private async getLatestAudit(companyId: string) {
    const { data, error } = await supabase
      .from('audits')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    return data;
  }

  private async searchCompanies(filters: any) {
    let query = supabase
      .from('companies')
      .select('*');

    if (filters.technology) {
      query = query.contains('technologies', [filters.technology]);
    }

    if (filters.icpScore) {
      if (filters.icpScore.min) {
        query = query.gte('icp_score', filters.icpScore.min);
      }
      if (filters.icpScore.max) {
        query = query.lte('icp_score', filters.icpScore.max);
      }
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    query = query.limit(filters.limit || 10);

    const { data, error } = await query;

    if (error) throw error;
    return data;
  }

  private async getTechnologies(companyId: string) {
    const { data, error } = await supabase
      .from('companies')
      .select('technologies')
      .eq('id', companyId)
      .single();

    if (error) throw error;
    return data?.technologies || [];
  }

  private async getFinancials(companyId: string) {
    const { data, error } = await supabase
      .from('company_financials')
      .select('*')
      .eq('company_id', companyId)
      .order('fiscal_year', { ascending: false })
      .limit(3);

    if (error) throw error;
    return data;
  }

  private async getCompetitors(companyId: string) {
    const { data, error } = await supabase
      .from('company_competitors')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return data;
  }
}
```

---

## File 1E.3: `services/copilot-context.ts`

**Purpose**: Track user's current page/context for contextual chat
**Lines**: ~150

```typescript
import { RedisClient } from '../cache/redis-client';

export interface UserContext {
  userId: string;
  page: string; // 'dashboard', 'company-details', 'audit-details'
  companyId?: string;
  companyName?: string;
  auditId?: string;
  tab?: string; // 'overview', 'research', 'tests', 'deliverables'
  filters?: any;
  lastUpdated: Date;
}

export class CopilotContext {
  private redis: RedisClient;

  constructor() {
    this.redis = new RedisClient();
  }

  async updateContext(userId: string, context: Partial<UserContext>) {
    const existing = await this.getContext(userId);

    const updated: UserContext = {
      ...existing,
      ...context,
      userId,
      lastUpdated: new Date(),
    };

    await this.redis.set(
      `copilot:context:${userId}`,
      JSON.stringify(updated),
      300 // 5 minutes TTL
    );

    return updated;
  }

  async getContext(userId: string): Promise<UserContext> {
    const cached = await this.redis.get(`copilot:context:${userId}`);

    if (cached) {
      return JSON.parse(cached);
    }

    return {
      userId,
      page: 'dashboard',
      lastUpdated: new Date(),
    };
  }

  async clearContext(userId: string) {
    await this.redis.del(`copilot:context:${userId}`);
  }
}
```

---

## File 1E.4: `services/copilot-rag.ts`

**Purpose**: RAG system for documentation Q&A using pgvector
**Lines**: ~200

```typescript
import { supabase } from '../database/supabase';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class CopilotRAG {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });
  }

  async search(query: string): Promise<string> {
    try {
      // Generate embedding for query
      const embedding = await this.openai.embeddings.create({
        model: process.env.RAG_EMBEDDING_MODEL || 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embedding.data[0].embedding;

      // Search vector database
      const { data, error } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: parseFloat(process.env.RAG_MATCH_THRESHOLD || '0.78'),
        match_count: parseInt(process.env.RAG_MATCH_COUNT || '3'),
      });

      if (error) {
        logger.error('RAG search failed', { error });
        return '';
      }

      // Concatenate relevant docs
      return data.map((d: any) => d.content).join('\n\n');
    } catch (error) {
      logger.error('RAG search error', { error });
      return '';
    }
  }

  async indexDocument(id: string, content: string, metadata: any) {
    const embedding = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: content,
    });

    const { error } = await supabase
      .from('copilot_documents')
      .insert({
        id,
        content,
        metadata,
        embedding: embedding.data[0].embedding,
      });

    if (error) {
      logger.error('Failed to index document', { error });
      throw error;
    }

    logger.info('Document indexed', { id });
  }
}
```

---

## File 1E.5: `api/copilot/chat.ts`

**Purpose**: Chat API endpoint
**Lines**: ~150

```typescript
import { Router } from 'express';
import { CopilotService } from '../../services/copilot';
import { CopilotContext } from '../../services/copilot-context';
import { logger } from '../../utils/logger';

export function createCopilotRoutes() {
  const router = Router();
  const copilot = new CopilotService();
  const contextService = new CopilotContext();

  // Chat endpoint
  router.post('/chat', async (req, res, next) => {
    try {
      const { userId, message, conversationHistory, userContext } = req.body;

      if (!userId || !message) {
        return res.status(400).json({ error: 'userId and message required' });
      }

      // Update user context if provided
      if (userContext) {
        await contextService.updateContext(userId, userContext);
      }

      // Get copilot response
      const response = await copilot.chat(
        userId,
        message,
        conversationHistory || [],
        userContext
      );

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // Update user context (called by frontend on page navigation)
  router.post('/context', async (req, res, next) => {
    try {
      const { userId, context } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId required' });
      }

      const updated = await contextService.updateContext(userId, context);

      res.json(updated);
    } catch (error) {
      next(error);
    }
  });

  // Get user context
  router.get('/context/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      const context = await contextService.getContext(userId);

      res.json(context);
    } catch (error) {
      next(error);
    }
  });

  // Clear conversation history
  router.delete('/context/:userId', async (req, res, next) => {
    try {
      const { userId } = req.params;
      await contextService.clearContext(userId);

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

---

## File 1E.6: `middleware/copilot-context.ts`

**Purpose**: Middleware to track user context on every request
**Lines**: ~100

```typescript
import { Request, Response, NextFunction } from 'express';
import { CopilotContext } from '../services/copilot-context';

const contextService = new CopilotContext();

export function copilotContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Extract user ID from auth token (assumes auth middleware ran first)
  const userId = (req as any).user?.id;

  if (!userId) {
    return next(); // Skip if no authenticated user
  }

  // Extract page context from request path
  const path = req.path;
  let page = 'dashboard';
  let companyId: string | undefined;
  let auditId: string | undefined;

  if (path.startsWith('/api/companies/')) {
    page = 'company-details';
    companyId = path.split('/')[3];
  } else if (path.startsWith('/api/audits/')) {
    page = 'audit-details';
    auditId = path.split('/')[3];
  }

  // Update context asynchronously (don't block request)
  contextService.updateContext(userId, {
    page,
    companyId,
    auditId,
  }).catch((error) => {
    console.error('Failed to update copilot context', error);
  });

  next();
}
```

---

## Testing Phase 1D & 1E

### Test Script: `tests/phase1d-1e-integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BrowserAutomationService } from '../services/browser-automation';
import { WebSocketManager } from '../services/websocket-manager';
import { CopilotService } from '../services/copilot';

describe('Phase 1D & 1E Integration Tests', () => {
  describe('Browser Automation', () => {
    let browser: BrowserAutomationService;

    beforeAll(async () => {
      browser = new BrowserAutomationService();
      await browser.initialize();
    });

    it('should run a simple search test', async () => {
      const testSteps = [
        {
          id: 'test-1',
          name: 'Navigate to homepage',
          action: 'navigate' as const,
        },
        {
          id: 'test-2',
          name: 'Search for "laptop"',
          action: 'search' as const,
          query: 'laptop',
          expectedResults: {
            minResults: 1,
          },
        },
      ];

      const results = await browser.runSearchAudit('amazon.com', testSteps);

      expect(results).toHaveLength(2);
      expect(results[0].testId).toBe('test-1');
      expect(results[0].screenshot).toBeDefined();
    });

    afterAll(async () => {
      await browser.cleanup();
    });
  });

  describe('AI Copilot', () => {
    let copilot: CopilotService;

    beforeAll(() => {
      copilot = new CopilotService();
    });

    it('should answer a data question using tools', async () => {
      const response = await copilot.chat(
        'user-123',
        "What's Costco's ICP score?",
        [],
        { page: 'dashboard' }
      );

      expect(response.message).toContain('Costco');
      expect(response.message).toMatch(/\d+/); // Contains a number (the score)
    });

    it('should provide navigation buttons', async () => {
      const response = await copilot.chat(
        'user-123',
        "Show me Costco's tech stack",
        [],
        { page: 'company-details', companyId: 'comp_123' }
      );

      expect(response.actions).toBeDefined();
      expect(response.actions?.length).toBeGreaterThan(0);
      expect(response.actions?.[0].type).toBe('button');
    });

    it('should not hallucinate data', async () => {
      const response = await copilot.chat(
        'user-123',
        "What's Nike's revenue?",
        [],
        { page: 'dashboard' }
      );

      // Should say "I don't have that information" if Nike not in DB
      expect(
        response.message.toLowerCase().includes("don't have") ||
        response.message.toLowerCase().includes("not found")
      ).toBe(true);
    });
  });
});
```

---

## Dependencies to Install

```bash
# Phase 1D: Browser Automation
npm install playwright socket.io
npm install -D @types/socket.io

# Phase 1E: AI Copilot
npm install @anthropic-ai/sdk
npm install @supabase/pgvector-js
npm install openai
```

---

## Environment Variables (.env.example)

```bash
# Phase 1D: Browser Automation
BROWSER_HEADLESS=true
BROWSER_TIMEOUT=30000
SCREENSHOT_PATH=./screenshots
MAX_CONCURRENT_BROWSERS=3
WEBSOCKET_PORT=3002
WEBSOCKET_CORS_ORIGIN=http://localhost:5173

# Phase 1E: AI Copilot
ANTHROPIC_API_KEY=sk-ant-...
COPILOT_MODEL=claude-sonnet-4-5-20250929
COPILOT_MAX_TOKENS=2048
OPENAI_API_KEY=sk-...
RAG_EMBEDDING_MODEL=text-embedding-3-small
RAG_MATCH_THRESHOLD=0.78
RAG_MATCH_COUNT=3
COPILOT_RATE_LIMIT=20
COPILOT_CACHE_TTL=3600
```

---

## Success Criteria

### Phase 1D: Browser Automation
✅ Playwright launches and navigates to websites
✅ Can type search queries and capture screenshots
✅ WebSocket streams events to frontend in real-time
✅ Screenshots saved to disk with base64 encoding
✅ Browser worker processes jobs from BullMQ queue

### Phase 1E: AI Copilot
✅ Anthropic Agent SDK successfully calls database tools
✅ Copilot responds to questions without hallucinating
✅ Context-aware responses based on user's current page
✅ Navigation buttons work and link to correct pages
✅ RAG system retrieves relevant documentation
✅ Rate limiting prevents abuse (20 messages/day per user)

---

**Status**: 🏗️ Ready for implementation
**Owner**: Backend Team (Agents 4 & 5)
**Last Updated**: March 6, 2026, 8:30 PM
