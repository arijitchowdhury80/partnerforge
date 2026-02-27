/**
 * BuiltWith Source Module
 *
 * Provides: Tech stack, search provider, CMS, ecommerce platform
 * API: BuiltWith Free API (via Edge Function proxy)
 *
 * SECURITY: API key is stored in Supabase Secrets, NOT in frontend bundle
 */

import type { SourceModule, SourceResult, BuiltWithData, SourceOptions } from '../types';
import { callEnrichProxy } from '@/services/supabase';

// Partner tech patterns to detect
const PARTNER_PATTERNS: Record<string, RegExp> = {
  'Adobe Experience Manager': /adobe experience manager|aem|adobe aem/i,
  'Adobe Commerce': /adobe commerce|magento/i,
  'Amplience': /amplience/i,
  'Spryker': /spryker/i,
  'Shopify': /shopify/i,
  'Commercetools': /commercetools/i,
  'Salesforce Commerce': /salesforce commerce|demandware/i,
  'BigCommerce': /bigcommerce/i,
};

// Search provider patterns
const SEARCH_PATTERNS: Record<string, RegExp> = {
  'Algolia': /algolia/i,
  'Elasticsearch': /elasticsearch|elastic search/i,
  'Coveo': /coveo/i,
  'Bloomreach': /bloomreach/i,
  'Searchspring': /searchspring/i,
  'Klevu': /klevu/i,
  'Constructor.io': /constructor\.io|constructor io/i,
  'Lucidworks': /lucidworks/i,
  'Solr': /apache solr|solr/i,
};

interface RawTech {
  Name?: string;
  name?: string;
  Tag?: string;
  category?: string;
  FirstDetected?: string;
}

export const builtwith: SourceModule<BuiltWithData> = {
  id: 'builtwith',
  name: 'BuiltWith',

  // Edge Function availability checked at runtime
  isAvailable: () => true,

  async enrich(domain: string, _options?: SourceOptions): Promise<SourceResult<BuiltWithData>> {
    const startTime = Date.now();

    try {
      const { data: raw, error } = await callEnrichProxy<{
        Results?: Array<{ Result?: { Paths?: Array<{ Technologies?: RawTech[] }> } }>;
      }>({
        source: 'builtwith',
        domain,
      });

      if (error || !raw) {
        throw new Error(error || 'No data returned');
      }

      const techs = raw.Results?.[0]?.Result?.Paths?.[0]?.Technologies || [];

      // Extract and categorize technologies
      const technologies: BuiltWithData['technologies'] = techs.map((t: RawTech) => ({
        name: t.Name || t.name || 'Unknown',
        category: t.Tag || t.category || 'Other',
        first_detected: t.FirstDetected || undefined,
      }));

      // Detect partner tech
      const partnerTech: string[] = [];
      for (const [partner, pattern] of Object.entries(PARTNER_PATTERNS)) {
        if (techs.some((t: RawTech) => pattern.test(t.Name || ''))) {
          partnerTech.push(partner);
        }
      }

      // Detect search provider
      let searchProvider: string | undefined;
      for (const [provider, pattern] of Object.entries(SEARCH_PATTERNS)) {
        if (techs.some((t: RawTech) => pattern.test(t.Name || ''))) {
          searchProvider = provider;
          break;
        }
      }

      // Detect CMS
      const cmsPatterns = [/wordpress/i, /drupal/i, /contentful/i, /sanity/i, /strapi/i];
      const cms = techs.find((t: RawTech) => cmsPatterns.some(p => p.test(t.Name || '')))?.Name;

      // Detect ecommerce platform
      const ecomPatterns = [/shopify/i, /magento/i, /bigcommerce/i, /woocommerce/i, /salesforce commerce/i];
      const ecommercePlatform = techs.find((t: RawTech) => ecomPatterns.some(p => p.test(t.Name || '')))?.Name;

      // Extract analytics and tag managers
      const analytics = techs
        .filter((t: RawTech) => /analytics|tracking|pixel/i.test(t.Tag || t.category || ''))
        .map((t: RawTech) => t.Name || '');

      const tagManagers = techs
        .filter((t: RawTech) => /tag manager|gtm|tealium|segment/i.test(t.Name || ''))
        .map((t: RawTech) => t.Name || '');

      const data: BuiltWithData = {
        technologies,
        search_provider: searchProvider,
        ecommerce_platform: ecommercePlatform,
        cms,
        partner_tech: partnerTech,
        analytics,
        tag_managers: tagManagers,
      };

      console.log(`[BuiltWith] ${domain}: ${technologies.length} techs, search=${searchProvider || 'none'} (${Date.now() - startTime}ms)`);

      return {
        source: 'builtwith',
        success: true,
        data,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[BuiltWith] ${domain}: ${error}`);

      return {
        source: 'builtwith',
        success: false,
        data: null,
        error,
        fetched_at: new Date().toISOString(),
        cached: false,
      };
    }
  },
};

export default builtwith;
