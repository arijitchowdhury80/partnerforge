/**
 * Copilot Chat API Endpoint
 * POST /api/copilot/chat
 */

import { Request, Response } from 'express';
import { CopilotService } from '../../services/copilot';
import { logger } from '../../utils/logger';

const copilot = new CopilotService();
const rateLimitStore: Map<string, { count: number; resetAt: Date }> = new Map();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = new Date();
  const userLimit = rateLimitStore.get(userId);
  if (!userLimit || now > userLimit.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (userLimit.count >= RATE_LIMIT_MAX) return { allowed: false, remaining: 0 };
  userLimit.count++;
  rateLimitStore.set(userId, userLimit);
  return { allowed: true, remaining: RATE_LIMIT_MAX - userLimit.count };
}

export async function chat(req: Request, res: Response): Promise<void> {
  try {
    const { message, conversationHistory = [], context } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Invalid request', message: 'message is required and must be a string' });
      return;
    }
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      res.status(429).json({ error: 'Rate limit exceeded', message: `You have reached the daily limit of ${RATE_LIMIT_MAX} messages. Please try again tomorrow.`, remaining: 0 });
      return;
    }
    logger.info('Copilot chat request', { userId, messageLength: message.length, historyLength: conversationHistory.length });
    const response = await copilot.chat(userId, message, conversationHistory, context);
    res.status(200).json({ ...response, rateLimit: { remaining: rateLimit.remaining, max: RATE_LIMIT_MAX } });
  } catch (error) {
    logger.error('Copilot chat error', { error });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to process chat message' });
  }
}

export async function status(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not authenticated' });
      return;
    }
    const userLimit = rateLimitStore.get(userId);
    const now = new Date();
    if (!userLimit || now > userLimit.resetAt) {
      res.status(200).json({ remaining: RATE_LIMIT_MAX, max: RATE_LIMIT_MAX, resetAt: new Date(now.getTime() + RATE_LIMIT_WINDOW_MS) });
      return;
    }
    res.status(200).json({ remaining: RATE_LIMIT_MAX - userLimit.count, max: RATE_LIMIT_MAX, resetAt: userLimit.resetAt });
  } catch (error) {
    logger.error('Copilot status error', { error });
    res.status(500).json({ error: 'Internal server error', message: 'Failed to get status' });
  }
}
