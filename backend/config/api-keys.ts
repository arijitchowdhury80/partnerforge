/**
 * API Keys Configuration
 *
 * Manages external API keys for data sources:
 * - SimilarWeb API
 * - BuiltWith API
 * - Yahoo Finance (no key needed, uses MCP)
 * - Apify API
 * - Apollo.io API
 * - Anthropic API (for AI Copilot)
 */

import { logger } from '../utils/logger';

export interface ApiKeys {
  similarweb: string | null;
  builtwith: string | null;
  apify: string | null;
  apollo: string | null;
  anthropic: string | null;
}

/**
 * Load API keys from environment variables
 *
 * Validates key format and logs warnings for missing keys
 */
function loadApiKeys(): ApiKeys {
  const keys: ApiKeys = {
    similarweb: process.env.SIMILARWEB_API_KEY || null,
    builtwith: process.env.BUILTWITH_API_KEY || null,
    apify: process.env.APIFY_API_KEY || null,
    apollo: process.env.APOLLO_API_KEY || null,
    anthropic: process.env.ANTHROPIC_API_KEY || null,
  };

  // Validate and warn about missing keys
  const missingKeys: string[] = [];

  Object.entries(keys).forEach(([service, key]) => {
    if (!key) {
      missingKeys.push(service);
    }
  });

  if (missingKeys.length > 0) {
    logger.warn('Missing API keys', {
      services: missingKeys,
      message: 'Some features may not work without API keys',
    });
  }

  // Log loaded keys (masked)
  logger.info('API keys loaded', {
    similarweb: keys.similarweb ? maskKey(keys.similarweb) : 'missing',
    builtwith: keys.builtwith ? maskKey(keys.builtwith) : 'missing',
    apify: keys.apify ? maskKey(keys.apify) : 'missing',
    apollo: keys.apollo ? maskKey(keys.apollo) : 'missing',
    anthropic: keys.anthropic ? maskKey(keys.anthropic) : 'missing',
  });

  return keys;
}

/**
 * Mask API key for logging
 *
 * Shows first 8 characters, rest as asterisks
 */
function maskKey(key: string): string {
  if (key.length <= 8) {
    return '***';
  }
  const prefix = key.substring(0, 8);
  const masked = '*'.repeat(key.length - 8);
  return prefix + masked;
}

/**
 * Validate API key format
 *
 * Basic validation for key format
 */
export function validateApiKey(key: string, service: string): boolean {
  if (!key || typeof key !== 'string') {
    return false;
  }

  // Minimum length check
  if (key.length < 10) {
    logger.warn('API key too short', { service, length: key.length });
    return false;
  }

  return true;
}

// Export loaded keys
export const apiKeys = loadApiKeys();

// Export helper to check if service is available
export function isServiceAvailable(service: keyof ApiKeys): boolean {
  return apiKeys[service] !== null;
}
