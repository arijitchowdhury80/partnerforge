/**
 * Sources Index
 *
 * Register all source modules here.
 * To add a new source:
 * 1. Create a new file in this folder (e.g., newsource.ts)
 * 2. Export it here
 * 3. Add it to the SOURCES map
 * That's it!
 */

import { similarweb } from './similarweb';
import { builtwith } from './builtwith';
import { yahoofinance } from './yahoofinance';
import { secedgar } from './secedgar';
import { websearch } from './websearch';
import { jsearch } from './jsearch';

import type { SourceId, SourceModule } from '../types';

// =============================================================================
// Source Registry
// =============================================================================

/**
 * All available sources - add new sources here
 */
export const SOURCES: Record<SourceId, SourceModule<unknown>> = {
  similarweb,
  builtwith,
  yahoofinance,
  secedgar,
  websearch,
  jsearch,
};

/**
 * Get a specific source module
 */
export function getSource(id: SourceId): SourceModule<unknown> {
  return SOURCES[id];
}

/**
 * Get all available sources (those with API keys configured)
 */
export function getAvailableSources(): SourceId[] {
  return Object.entries(SOURCES)
    .filter(([_, module]) => module.isAvailable())
    .map(([id]) => id as SourceId);
}

/**
 * Check if a source is available
 */
export function isSourceAvailable(id: SourceId): boolean {
  return SOURCES[id]?.isAvailable() ?? false;
}

// =============================================================================
// Individual Exports
// =============================================================================

export { similarweb } from './similarweb';
export { builtwith } from './builtwith';
export { yahoofinance } from './yahoofinance';
export { secedgar } from './secedgar';
export { websearch } from './websearch';
export { jsearch } from './jsearch';
