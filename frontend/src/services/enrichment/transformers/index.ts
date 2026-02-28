/**
 * Enrichment Data Transformers
 *
 * Transforms raw API data from SimilarWeb and BuiltWith into
 * the normalized types used throughout Arian.
 *
 * @module transformers
 */

// Traffic transformers
export {
  // Main transformer
  transformTrafficData,
  // Traffic sources
  transformTrafficSources,
  getDominantTrafficSource,
  getOrganicVsPaidRatio,
  // Geography
  transformGeography,
  getPrimaryCountry,
  isUSCentric,
  getRegionalBreakdown,
  // Device distribution
  estimateDeviceDistribution,
  // Traffic trends
  calculateTrafficTrend,
  classifyTrafficTrend,
  // Traffic tiers
  getTrafficTier,
  getTrafficTierScore,
  getTrafficDescription,
  // Engagement
  calculateEngagementScore,
  getEngagementLevel,
  // Search analysis
  estimateSearchQueryVolume,
  classifySearchOpportunity,
  // Format helpers
  formatMonthlyVisits,
  formatDuration,
  formatPercentage,
  // Types
  type TrafficTier,
} from './traffic';

// TechStack transformers
export {
  // Main transformers
  transformTechStackData,
  transformTechStackFromBuiltWith,
  // Technology transformation
  transformTechnologies,
  extractTagManagers,
  // Partner tech detection
  detectPartnerTech,
  hasPartnerTech,
  PARTNER_TECH_PATTERNS,
  // Search provider detection
  detectSearchProvider,
  usesAlgolia,
  usesCompetitorSearch,
  SEARCH_PROVIDERS,
  // Weak search platform analysis
  hasWeakSearchPlatform,
  getWeakSearchPlatforms,
  WEAK_SEARCH_PLATFORMS,
  // Tech complexity
  calculateTechComplexity,
  getTechSophisticationLevel,
  // Displacement analysis
  calculateDisplacementOpportunity,
  getDisplacementClassification,
  // Category helpers
  getTechByCategory,
  hasTechnology,
  // Format helpers
  formatKeyTechnologies,
  getTechCount,
} from './techstack';

// Competitors transformers
export {
  // Main transformer
  transformCompetitorData,
  transformCompetitor,
  // Search provider detection
  detectSearchProviderFromTechStack,
  // Company name
  extractCompanyName,
  // Market position
  determineMarketPosition,
  getMarketCompetitivenessScore,
  // Competitive landscape
  generateCompetitiveLandscape,
  countSearchProviders,
  // Algolia analysis
  countAlgoliaCompetitors,
  getAlgoliaCompetitors,
  getAlgoliaAdoptionRate,
  getCompetitivePressure,
  // Domain utilities
  getCompetitorDomainsForEnrichment,
  filterByMinSimilarity,
  getTopCompetitors,
  // Displacement scoring
  calculateDisplacementUrgency,
  generateDisplacementNarrative,
  // Format helpers
  formatCompetitor,
  formatCompetitorList,
  getSearchProviderBreakdown,
} from './competitors';

// Financial transformers
export {
  // Main transformer
  transformFinancialData,
  // Revenue metrics
  transformRevenueMetrics,
  transformNetIncomeMetrics,
  transformEbitdaMetrics,
  // Margin calculations
  calculateEbitdaMargin,
  determineMarginZone,
  // E-commerce estimation
  estimateEcommercePercentage,
  estimateEcommerceRevenue,
  // ROI estimation
  calculateRoiEstimate,
  // Financial health
  getFinancialHealthScore,
  getFinancialHealthLevel,
  // Revenue trends
  calculateRevenueCAGR,
  getRevenueTrend,
  // Format helpers
  formatFinancialNumber,
  formatGrowthPercentage,
  formatRoiEstimate,
  // Extended transformers
  transformStockInfo,
  transformIncomeStatement,
  transformBalanceSheet,
  transformHistoricalFinancials,
  transformAnalystRatings,
  calculateGrowthRates,
  calculateMargins,
  transformFullFinancialData,
  // Private company estimation
  estimatePrivateCompanyFinancials,
  getPrivateCompanyEstimateConfidence,
  // Types
  type ExtendedFinancialData,
} from './financials';

// Hiring transformers
export {
  // Main transformer
  transformHiringData,
  transformJob,
  // Hiring signal scoring
  getHiringSignalScore,
  getHiringSignalLevel,
  // Search-related detection
  isHiringForSearch,
  isHiringForDiscovery,
  getSearchRelatedJobs,
  // Leadership analysis
  getExecutiveHires,
  getDirectorHires,
  isBuildingTeam,
  // Department analysis
  getDepartmentBreakdown,
  getPrimaryHiringDepartment,
  // Tech stack inference
  inferTechStackFromHiring,
  // Format helpers
  formatHiringSignal,
  formatTierBreakdown,
  getHiringSummary,
  // Extended transformers
  transformHiringJobToKeyRole,
  calculateEnrichedTierBreakdown,
  extractTechSignals,
  determineGrowthIndicators,
  transformToEnrichedHiringData,
  getHiringInsights,
  // Types
  type EnrichedHiringData,
} from './hiring';

// Executive transformers
export {
  // Main transformer
  transformExecutiveData,
  transformQuote,
  transformTheme,
  // Quote relevance
  calculateQuoteRelevance,
  // Executive signal scoring
  getExecutiveSignalScore,
  getExecutiveSignalLevel,
  // Strategic priorities
  extractStrategicPriorities,
  mapTextToAlgoliaValue,
  // C-Level analysis
  getCLevelQuotes,
  hasCEOQuotes,
  getMostSeniorSpeaker,
  // Theme analysis
  getMostFrequentTheme,
  getSearchRelatedThemes,
  getCXRelatedThemes,
  // Quote categorization
  categorizeQuotes,
  getQuotesByValue,
  // Format helpers
  formatQuoteForDisplay,
  getExecutiveSummary,
  getBestQuote,
  // Extended transformers
  scoreQuoteRelevanceLevel,
  mapQuoteToAlgoliaValueProp,
  extractSpeakingPhrases,
  generateAlgoliaAngle,
  transformToExecutiveInsights,
  getExecutiveActionableInsights,
  // Constants
  ALGOLIA_VALUE_PROPS,
  // Types
  type ExecutiveInsights,
} from './executive';

// Investor transformers
export {
  // Main transformer
  transformInvestorData,
  transformSecFiling,
  transformEarningsHighlight,
  transformRiskFactor,
  // Helpers
  parseQuarterToDate,
  // Investor signal scoring
  getInvestorSignalScore,
  getInvestorSignalLevel,
  // Risk factor analysis
  extractRelevantRiskFactors,
  getRiskFactorsByRelevance,
  categorizeRiskFactors,
  hasTechnologyRisks,
  // SEC filing analysis
  getMostRecent10K,
  getMostRecent10Q,
  getFilingsByType,
  hasRecentFilings,
  // Earnings analysis
  getMostRecentEarnings,
  getEarningsWithTopic,
  getAllEarningsKeyPoints,
  earningsMentionDigitalTransformation,
  // Format helpers
  formatSecFiling,
  formatRiskFactor,
  getInvestorSummary,
  getMostActionableInsight,
  // Extended transformers
  transformSecFilingEnhanced,
  transformRiskFactorEnhanced,
  extractDigitalMentions,
  extractSearchMentions,
  determineDigitalTransformationStage,
  extractGrowthDrivers,
  extractHeadwinds,
  transformToInvestorIntelligence,
  getInvestorActionableInsights,
  // Constants
  RISK_MITIGATIONS,
  // Types
  type InvestorIntelligence,
} from './investor';
