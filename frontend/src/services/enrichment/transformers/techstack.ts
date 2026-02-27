/**
 * TechStack Data Transformer
 *
 * Transforms BuiltWith API data into the TechStackData type
 * with comprehensive partner tech and search provider detection.
 */

import type { TechStackData, Technology } from '@/types';
import type {
  BuiltWithFullData,
  BuiltWithTechStack,
  BuiltWithTechnology,
} from '../clients/builtwith';

// ============================================================================
// Partner Technology Detection
// ============================================================================

/**
 * Partner technology patterns for Algolia displacement analysis.
 * These are technologies where Algolia has partner relationships
 * or strong integration stories.
 */
export const PARTNER_TECH_PATTERNS: Record<string, string[]> = {
  'Adobe Experience Manager': ['aem', 'adobe experience manager', 'adobe aem'],
  'Amplience': ['amplience'],
  'Spryker': ['spryker'],
  'Contentful': ['contentful'],
  'Sitecore': ['sitecore'],
  'commercetools': ['commercetools', 'commerce tools'],
  'Salesforce Commerce Cloud': ['salesforce commerce', 'demandware', 'sfcc', 'sfra'],
  'SAP Commerce Cloud': ['sap commerce', 'hybris', 'sap hybris'],
  'Shopify Plus': ['shopify plus', 'shopify'],
  'BigCommerce': ['bigcommerce', 'big commerce'],
  'Magento': ['magento', 'adobe commerce'],
  'VTEX': ['vtex'],
  'Elastic Path': ['elastic path', 'elasticpath'],
  'Oracle Commerce Cloud': ['oracle commerce', 'atg'],
  'Kibo Commerce': ['kibo', 'mozu'],
  'Bloomreach': ['bloomreach', 'hippo cms'],
  'Sanity': ['sanity'],
  'Strapi': ['strapi'],
  'Prismic': ['prismic'],
  'Contentstack': ['contentstack'],
};

// ============================================================================
// Search Provider Detection
// ============================================================================

/**
 * Search provider patterns for competitive analysis.
 * Detecting current search solutions helps position Algolia.
 */
export const SEARCH_PROVIDERS: Record<string, string[]> = {
  'Algolia': ['algolia'],
  'Elasticsearch': ['elasticsearch', 'elastic search', 'elastic.co'],
  'Coveo': ['coveo'],
  'Constructor.io': ['constructor.io', 'constructor io', 'constructorio'],
  'SearchSpring': ['searchspring', 'search spring'],
  'Klevu': ['klevu'],
  'Bloomreach Discovery': ['bloomreach discovery', 'bloomreach search'],
  'Lucidworks': ['lucidworks', 'lucidworks fusion'],
  'Apache Solr': ['solr', 'apache solr'],
  'Swiftype': ['swiftype'],
  'Doofinder': ['doofinder'],
  'HawkSearch': ['hawksearch', 'hawk search'],
  'Yext': ['yext'],
  'Attraqt': ['attraqt'],
  'Findify': ['findify'],
  'Unbxd': ['unbxd'],
  'Loop54': ['loop54'],
  'Prefixbox': ['prefixbox'],
  'Sooqr': ['sooqr'],
  'AddSearch': ['addsearch'],
  'Sajari': ['sajari'],
  'Typesense': ['typesense'],
  'Meilisearch': ['meilisearch'],
};

// ============================================================================
// Weak Search Platform Detection
// ============================================================================

/**
 * Platforms known to have limited native search capabilities.
 * These represent better displacement opportunities for Algolia.
 */
export const WEAK_SEARCH_PLATFORMS = [
  'Adobe Experience Manager',
  'Amplience',
  'Contentful',
  'Sitecore',
  'Magento',
  'Sanity',
  'Strapi',
  'Prismic',
  'Contentstack',
  'Bloomreach',
  'Kibo Commerce',
];

// ============================================================================
// Main Transformer
// ============================================================================

/**
 * Transform BuiltWith API data into TechStackData type
 */
export function transformTechStackData(
  domain: string,
  bwData: BuiltWithFullData | null
): TechStackData | null {
  if (!bwData?.tech_stack) return null;

  const ts = bwData.tech_stack;

  return {
    domain,
    technologies: transformTechnologies(ts.technologies),
    partner_tech_detected: detectPartnerTech(ts),
    search_provider: detectSearchProvider(ts),
    cms: ts.cms[0],
    ecommerce_platform: ts.ecommerce[0],
    analytics: ts.analytics,
    tag_managers: extractTagManagers(ts),
    cdn: ts.cdn[0],
  };
}

/**
 * Transform from BuiltWithTechStack directly (without full data wrapper)
 */
export function transformTechStackFromBuiltWith(
  domain: string,
  techStack: BuiltWithTechStack | null
): TechStackData | null {
  if (!techStack) return null;

  return {
    domain,
    technologies: transformTechnologies(techStack.technologies),
    partner_tech_detected: detectPartnerTech(techStack),
    search_provider: detectSearchProvider(techStack),
    cms: techStack.cms[0],
    ecommerce_platform: techStack.ecommerce[0],
    analytics: techStack.analytics,
    tag_managers: extractTagManagers(techStack),
    cdn: techStack.cdn[0],
  };
}

// ============================================================================
// Technology Transformation
// ============================================================================

/**
 * Transform BuiltWith technologies into our Technology type
 */
export function transformTechnologies(techs: BuiltWithTechnology[]): Technology[] {
  return techs.map((t) => ({
    name: t.name,
    category: t.categories[0] || t.tag || 'Unknown',
    first_detected: t.first_detected,
    last_detected: t.last_detected,
  }));
}

/**
 * Extract tag managers from tech stack
 */
export function extractTagManagers(techStack: BuiltWithTechStack): string[] {
  const tagManagerPatterns = [
    /google tag manager/i,
    /tealium/i,
    /adobe launch/i,
    /segment/i,
    /ensighten/i,
    /signal/i,
    /commanders act/i,
  ];

  const tagManagers: string[] = [];

  for (const tech of techStack.technologies) {
    const techName = tech.name.toLowerCase();
    for (const pattern of tagManagerPatterns) {
      if (pattern.test(techName) && !tagManagers.includes(tech.name)) {
        tagManagers.push(tech.name);
        break;
      }
    }
  }

  // Also check analytics array (sometimes tag managers end up there)
  for (const analytic of techStack.analytics) {
    const analyticName = analytic.toLowerCase();
    for (const pattern of tagManagerPatterns) {
      if (pattern.test(analyticName) && !tagManagers.includes(analytic)) {
        tagManagers.push(analytic);
        break;
      }
    }
  }

  return tagManagers;
}

// ============================================================================
// Partner Technology Detection
// ============================================================================

/**
 * Detect partner technologies from BuiltWith tech stack
 */
export function detectPartnerTech(techStack: BuiltWithTechStack): string[] {
  const detected: string[] = [];

  // Collect all tech names for searching
  const allTechNames = techStack.technologies.map((t) => t.name.toLowerCase());
  const allCategories = [...techStack.cms, ...techStack.ecommerce].map((s) =>
    s.toLowerCase()
  );
  const combined = [...allTechNames, ...allCategories];

  for (const [partner, patterns] of Object.entries(PARTNER_TECH_PATTERNS)) {
    if (patterns.some((p) => combined.some((t) => t.includes(p)))) {
      detected.push(partner);
    }
  }

  return detected;
}

/**
 * Check if a specific partner technology is detected
 */
export function hasPartnerTech(techStack: BuiltWithTechStack, partner: string): boolean {
  const patterns = PARTNER_TECH_PATTERNS[partner];
  if (!patterns) return false;

  const allTechNames = techStack.technologies.map((t) => t.name.toLowerCase());
  const allCategories = [...techStack.cms, ...techStack.ecommerce].map((s) =>
    s.toLowerCase()
  );
  const combined = [...allTechNames, ...allCategories];

  return patterns.some((p) => combined.some((t) => t.includes(p)));
}

// ============================================================================
// Search Provider Detection
// ============================================================================

/**
 * Detect the current search provider from BuiltWith tech stack
 */
export function detectSearchProvider(
  techStack: BuiltWithTechStack
): string | undefined {
  // Check categorized search technologies first
  const searchTechs = techStack.search.map((s) => s.toLowerCase());

  for (const [provider, patterns] of Object.entries(SEARCH_PROVIDERS)) {
    if (patterns.some((p) => searchTechs.some((t) => t.includes(p)))) {
      return provider;
    }
  }

  // Check all technologies as fallback
  const allTechs = techStack.technologies.map((t) => t.name.toLowerCase());

  for (const [provider, patterns] of Object.entries(SEARCH_PROVIDERS)) {
    if (patterns.some((p) => allTechs.some((t) => t.includes(p)))) {
      return provider;
    }
  }

  return undefined;
}

/**
 * Check if the company is currently using Algolia
 */
export function usesAlgolia(techStack: BuiltWithTechStack): boolean {
  return detectSearchProvider(techStack) === 'Algolia';
}

/**
 * Check if the company uses a competitor search solution
 */
export function usesCompetitorSearch(techStack: BuiltWithTechStack): boolean {
  const provider = detectSearchProvider(techStack);
  return provider !== undefined && provider !== 'Algolia';
}

// ============================================================================
// Weak Search Platform Analysis
// ============================================================================

/**
 * Check if company uses a weak-search platform (good displacement target)
 */
export function hasWeakSearchPlatform(partnerTech: string[]): boolean {
  return partnerTech.some((p) => WEAK_SEARCH_PLATFORMS.includes(p));
}

/**
 * Get the weak search platforms detected
 */
export function getWeakSearchPlatforms(partnerTech: string[]): string[] {
  return partnerTech.filter((p) => WEAK_SEARCH_PLATFORMS.includes(p));
}

// ============================================================================
// Technology Complexity Analysis
// ============================================================================

/**
 * Calculate tech stack complexity score (0-100)
 * Higher complexity often indicates a more sophisticated buyer
 */
export function calculateTechComplexity(techStack: BuiltWithTechStack): number {
  let score = 0;

  // Number of technologies (max 30 points)
  score += Math.min(30, techStack.technologies.length * 2);

  // Diversity across categories (max 40 points)
  const categoriesWithTech = [
    techStack.cms.length > 0,
    techStack.ecommerce.length > 0,
    techStack.analytics.length > 0,
    techStack.search.length > 0,
    techStack.cdn.length > 0,
    techStack.payment.length > 0,
    techStack.marketing.length > 0,
    techStack.frameworks.length > 0,
    techStack.hosting.length > 0,
    techStack.security.length > 0,
  ].filter(Boolean).length;

  score += categoriesWithTech * 4;

  // Enterprise indicators (max 30 points)
  const enterpriseIndicators = [
    techStack.cms.some((c) =>
      /adobe|sitecore|contentful|amplience/i.test(c)
    ),
    techStack.ecommerce.some((e) =>
      /salesforce|sap|commercetools|oracle/i.test(e)
    ),
    techStack.analytics.some((a) =>
      /adobe analytics|mixpanel|amplitude/i.test(a)
    ),
    techStack.cdn.some((c) => /akamai|fastly/i.test(c)),
    techStack.marketing.some((m) =>
      /marketo|pardot|hubspot enterprise/i.test(m)
    ),
    techStack.search.length > 0, // Any dedicated search = enterprise
  ];

  score += enterpriseIndicators.filter(Boolean).length * 5;

  return Math.min(100, score);
}

/**
 * Classify tech stack sophistication level
 */
export function getTechSophisticationLevel(
  techStack: BuiltWithTechStack
): 'enterprise' | 'mid-market' | 'smb' {
  const complexity = calculateTechComplexity(techStack);
  if (complexity >= 70) return 'enterprise';
  if (complexity >= 40) return 'mid-market';
  return 'smb';
}

// ============================================================================
// Displacement Opportunity Analysis
// ============================================================================

/**
 * Calculate displacement opportunity score (0-100)
 * Higher score = easier/better displacement target
 */
export function calculateDisplacementOpportunity(
  techStackData: TechStackData
): number {
  let score = 50; // Base score

  // Has weak search platform (+20)
  if (hasWeakSearchPlatform(techStackData.partner_tech_detected)) {
    score += 20;
  }

  // No current search provider (+15)
  if (!techStackData.search_provider) {
    score += 15;
  }

  // Using a competitor (-10) - harder to displace, but still possible
  if (
    techStackData.search_provider &&
    techStackData.search_provider !== 'Algolia'
  ) {
    score -= 10;
  }

  // Already using Algolia (-100) - not a target
  if (techStackData.search_provider === 'Algolia') {
    return 0;
  }

  // Using partner tech (+15)
  if (techStackData.partner_tech_detected.length > 0) {
    score += 15;
  }

  // Has ecommerce platform (+10) - search is critical for commerce
  if (techStackData.ecommerce_platform) {
    score += 10;
  }

  // Has CMS (+5) - content search use case
  if (techStackData.cms) {
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Get displacement opportunity classification
 */
export function getDisplacementClassification(
  techStackData: TechStackData
): 'high' | 'medium' | 'low' | 'none' {
  const score = calculateDisplacementOpportunity(techStackData);
  if (score === 0) return 'none';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ============================================================================
// Technology Category Helpers
// ============================================================================

/**
 * Get technologies by category
 */
export function getTechByCategory(
  techStack: BuiltWithTechStack,
  category: keyof Omit<BuiltWithTechStack, 'domain' | 'technologies'>
): string[] {
  return techStack[category] || [];
}

/**
 * Check if tech stack includes specific technology
 */
export function hasTechnology(
  techStack: BuiltWithTechStack,
  techName: string
): boolean {
  const lowerName = techName.toLowerCase();
  return techStack.technologies.some(
    (t) =>
      t.name.toLowerCase().includes(lowerName) ||
      t.tag.toLowerCase().includes(lowerName)
  );
}

// ============================================================================
// Format Helpers
// ============================================================================

/**
 * Format tech stack for display (key technologies only)
 */
export function formatKeyTechnologies(techStack: BuiltWithTechStack): string[] {
  const key: string[] = [];

  if (techStack.cms[0]) key.push(`CMS: ${techStack.cms[0]}`);
  if (techStack.ecommerce[0]) key.push(`E-comm: ${techStack.ecommerce[0]}`);
  if (techStack.search[0]) key.push(`Search: ${techStack.search[0]}`);
  if (techStack.cdn[0]) key.push(`CDN: ${techStack.cdn[0]}`);

  return key;
}

/**
 * Get total technology count
 */
export function getTechCount(techStack: BuiltWithTechStack): number {
  return techStack.technologies.length;
}
