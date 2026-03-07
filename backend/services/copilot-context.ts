/**
 * Copilot Context Service
 *
 * Tracks user navigation context to provide contextual responses.
 * Stores: current page, company being viewed, active audit, filters.
 */

import { logger } from '../utils/logger';

interface UserContext {
  userId: string;
  page: string;
  companyId?: string;
  companyName?: string;
  companyDomain?: string;
  auditId?: string;
  tab?: string;
  filters?: Record<string, any>;
  lastUpdated: Date;
}

export class CopilotContext {
  private contextStore: Map<string, UserContext>;

  constructor() {
    this.contextStore = new Map();
  }

  updateContext(
    userId: string,
    page: string,
    metadata?: {
      companyId?: string;
      companyName?: string;
      companyDomain?: string;
      auditId?: string;
      tab?: string;
      filters?: Record<string, any>;
    }
  ): void {
    const context: UserContext = {
      userId,
      page,
      ...metadata,
      lastUpdated: new Date(),
    };

    this.contextStore.set(userId, context);
    logger.info('Updated copilot context', { userId, page });
  }

  async getContext(userId: string): Promise<UserContext> {
    const context = this.contextStore.get(userId);
    if (!context) {
      return { userId, page: 'unknown', lastUpdated: new Date() };
    }
    return context;
  }

  clearContext(userId: string): void {
    this.contextStore.delete(userId);
    logger.info('Cleared copilot context', { userId });
  }

  async buildContextPrompt(userId: string): Promise<string> {
    const context = await this.getContext(userId);
    let prompt = `User is on: ${context.page}\n`;
    if (context.companyId) {
      prompt += `Viewing company: ${context.companyName || context.companyDomain || context.companyId}\n`;
    }
    if (context.auditId) {
      prompt += `Viewing audit: ${context.auditId}\n`;
    }
    if (context.tab) {
      prompt += `Active tab: ${context.tab}\n`;
    }
    if (context.filters && Object.keys(context.filters).length > 0) {
      prompt += `Active filters: ${JSON.stringify(context.filters)}\n`;
    }
    return prompt;
  }
}
