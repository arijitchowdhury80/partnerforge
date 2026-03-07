/**
 * BuiltWith API Client - Usage Examples
 *
 * This file demonstrates how to use the BuiltWith client for various
 * technology detection and analysis scenarios.
 */

import { builtWithClient } from '../builtwith';

// ============================================================================
// Example 1: Get Complete Technology Stack
// ============================================================================

async function getTechnologyStack() {
  console.log('Example 1: Get Technology Stack for Costco.com\n');

  try {
    const result = await builtWithClient.getDomainTechnologies('costco.com');

    console.log('✓ API Response Meta:', {
      source: result.meta.source,
      cached: result.meta.cached,
      latency: `${result.meta.latency_ms}ms`
    });

    const technologies = result.data.Results[0]?.Result.Paths[0]?.Technologies || [];

    console.log(`\nDetected ${technologies.length} technologies:\n`);

    // Group by category
    const byCategory: Record<string, string[]> = {};
    technologies.forEach(tech => {
      if (!byCategory[tech.Tag]) {
        byCategory[tech.Tag] = [];
      }
      byCategory[tech.Tag].push(tech.Name);
    });

    // Display by category
    Object.entries(byCategory).forEach(([category, techs]) => {
      console.log(`${category}:`);
      techs.forEach(tech => console.log(`  - ${tech}`));
      console.log();
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 2: Analyze Technology Relationships
// ============================================================================

async function analyzeTechRelationships() {
  console.log('Example 2: Technology Relationships for Shopify\n');

  try {
    const result = await builtWithClient.getRelationships('shopify.com');

    console.log('Top Technology Combinations:\n');

    const topRelationships = result.data.Relationships
      .sort((a, b) => b.Count - a.Count)
      .slice(0, 10);

    topRelationships.forEach(rel => {
      console.log(`${rel.TechA} + ${rel.TechB}: ${rel.Count.toLocaleString()} sites`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 3: Get Company Financial Estimates
// ============================================================================

async function getCompanyFinancials() {
  console.log('Example 3: Financial Estimates for Target.com\n');

  try {
    const result = await builtWithClient.getFinancials('target.com');

    const { Estimates } = result.data;

    console.log('Company Profile:');
    console.log(`  Name: ${result.data.Company}`);
    console.log(`  Domain: ${result.data.Domain}`);
    console.log(`  Size: ${Estimates.CompanySize}`);
    console.log();

    console.log('Revenue Estimate:');
    console.log(`  Range: $${(Estimates.Revenue.Min / 1000000).toFixed(1)}M - $${(Estimates.Revenue.Max / 1000000).toFixed(1)}M`);
    console.log();

    console.log('Employee Estimate:');
    console.log(`  Range: ${Estimates.Employees.Min.toLocaleString()} - ${Estimates.Employees.Max.toLocaleString()}`);
    console.log();

    console.log(`Last Updated: ${Estimates.LastUpdated}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 4: Social Media Analysis
// ============================================================================

async function analyzeSocialPresence() {
  console.log('Example 4: Social Media Profiles for Nike.com\n');

  try {
    const result = await builtWithClient.getSocialProfiles('nike.com');

    console.log(`Found ${result.data.Profiles.length} social profiles:\n`);

    result.data.Profiles.forEach(profile => {
      console.log(`${profile.Platform}:`);
      console.log(`  URL: ${profile.Url}`);
      if (profile.Handle) console.log(`  Handle: @${profile.Handle}`);
      if (profile.Followers) console.log(`  Followers: ${profile.Followers.toLocaleString()}`);
      if (profile.Verified) console.log(`  ✓ Verified`);
      console.log();
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 5: Security & Trust Analysis
// ============================================================================

async function analyzeTrustSignals() {
  console.log('Example 5: Trust & Security for Amazon.com\n');

  try {
    const result = await builtWithClient.getTrustIndicators('amazon.com');

    const { Security, TrustSignals, Compliance } = result.data;

    console.log('Security Status:');
    console.log(`  SSL: ${Security.HasSSL ? '✓' : '✗'} ${Security.SSLProvider || ''}`);
    console.log(`  HSTS: ${Security.HasHSTS ? '✓' : '✗'}`);
    if (Security.SSLExpiry) {
      console.log(`  SSL Expiry: ${Security.SSLExpiry}`);
    }
    console.log();

    console.log('Trust Signals:');
    console.log(`  Privacy Policy: ${TrustSignals.HasPrivacyPolicy ? '✓' : '✗'}`);
    console.log(`  Terms of Service: ${TrustSignals.HasTermsOfService ? '✓' : '✗'}`);
    console.log(`  Cookie Consent: ${TrustSignals.HasCookieConsent ? '✓' : '✗'}`);
    if (TrustSignals.TrustBadges.length > 0) {
      console.log(`  Trust Badges: ${TrustSignals.TrustBadges.join(', ')}`);
    }
    console.log();

    console.log('Compliance:');
    if (Compliance.GDPR !== undefined) console.log(`  GDPR: ${Compliance.GDPR ? '✓' : '✗'}`);
    if (Compliance.CCPA !== undefined) console.log(`  CCPA: ${Compliance.CCPA ? '✓' : '✗'}`);
    if (Compliance.PCI !== undefined) console.log(`  PCI: ${Compliance.PCI ? '✓' : '✗'}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 6: SEO Keyword Analysis
// ============================================================================

async function analyzeKeywords() {
  console.log('Example 6: SEO Keywords for BestBuy.com\n');

  try {
    const result = await builtWithClient.getKeywords('bestbuy.com');

    console.log(`Organic Visibility Score: ${result.data.OrganicVisibility}/100\n`);

    console.log('Top Ranking Keywords:\n');

    const topKeywords = result.data.Keywords
      .sort((a, b) => b.Volume - a.Volume)
      .slice(0, 10);

    topKeywords.forEach((kw, index) => {
      console.log(`${index + 1}. "${kw.Keyword}"`);
      console.log(`   Rank: #${kw.Rank} | Volume: ${kw.Volume.toLocaleString()}/mo | Competition: ${kw.Competition}`);
      if (kw.CPC) console.log(`   CPC: $${kw.CPC.toFixed(2)}`);
      console.log();
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 7: Competitor Batch Analysis
// ============================================================================

async function batchCompetitorAnalysis() {
  console.log('Example 7: Batch Analysis of Competitor Tech Stacks\n');

  const competitors = [
    'walmart.com',
    'target.com',
    'kroger.com',
    'costco.com',
    'albertsons.com'
  ];

  try {
    const result = await builtWithClient.batchLookup(competitors);

    console.log(`Analyzed ${result.data.Results.length} competitors\n`);

    // Aggregate technology usage
    const techUsage: Record<string, number> = {};

    result.data.Results.forEach(({ Domain, Result }) => {
      const technologies = Result.Paths[0]?.Technologies || [];
      technologies.forEach(tech => {
        techUsage[tech.Name] = (techUsage[tech.Name] || 0) + 1;
      });
    });

    // Find commonly used technologies
    const commonTechs = Object.entries(techUsage)
      .filter(([_, count]) => count >= 3) // Used by 3+ competitors
      .sort((a, b) => b[1] - a[1]);

    console.log('Technologies used by 3+ competitors:\n');
    commonTechs.forEach(([tech, count]) => {
      console.log(`  ${tech}: ${count}/${competitors.length}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 8: Technology Recommendations
// ============================================================================

async function getTechRecommendations() {
  console.log('Example 8: Technology Recommendations for Startup.com\n');

  try {
    const result = await builtWithClient.getRecommendations('startup.com');

    console.log('Recommended Technologies:\n');

    // Group by priority
    const byPriority = {
      high: result.data.Recommendations.filter(r => r.Priority === 'high'),
      medium: result.data.Recommendations.filter(r => r.Priority === 'medium'),
      low: result.data.Recommendations.filter(r => r.Priority === 'low')
    };

    Object.entries(byPriority).forEach(([priority, recs]) => {
      if (recs.length === 0) return;

      console.log(`${priority.toUpperCase()} PRIORITY:`);
      recs.forEach(rec => {
        console.log(`  ${rec.Technology} (${rec.Category})`);
        console.log(`    Reason: ${rec.Reason}`);
        console.log(`    Adoption: ${(rec.AdoptionRate * 100).toFixed(1)}% of similar sites`);
        console.log();
      });
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 9: Monitor API Usage
// ============================================================================

async function monitorAPIUsage() {
  console.log('Example 9: Monitor API Usage\n');

  try {
    const result = await builtWithClient.getUsageStats();

    const { CurrentUsage, Limits, RemainingQuota } = result.data;

    console.log('Current Usage:');
    console.log(`  This Month: ${CurrentUsage.CallsThisMonth.toLocaleString()} calls`);
    console.log(`  Today: ${CurrentUsage.CallsToday.toLocaleString()} calls`);
    console.log(`  Last Call: ${CurrentUsage.LastCallTimestamp}`);
    console.log();

    console.log('Rate Limits:');
    console.log(`  Monthly: ${Limits.MonthlyLimit.toLocaleString()} calls`);
    console.log(`  Daily: ${Limits.DailyLimit.toLocaleString()} calls`);
    console.log(`  Per Second: ${Limits.RateLimitPerSecond} req/s`);
    console.log();

    console.log('Remaining Quota:');
    console.log(`  Monthly: ${RemainingQuota.Monthly.toLocaleString()} calls (${((RemainingQuota.Monthly / Limits.MonthlyLimit) * 100).toFixed(1)}%)`);
    console.log(`  Daily: ${RemainingQuota.Daily.toLocaleString()} calls (${((RemainingQuota.Daily / Limits.DailyLimit) * 100).toFixed(1)}%)`);

    // Cost estimate
    const costPerCall = 0.02;
    const monthlySpend = CurrentUsage.CallsThisMonth * costPerCall;
    const projectedMonthlySpend = Limits.MonthlyLimit * costPerCall;

    console.log();
    console.log('Cost Tracking:');
    console.log(`  Spent This Month: $${monthlySpend.toFixed(2)}`);
    console.log(`  Max Monthly Cost: $${projectedMonthlySpend.toFixed(2)}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

// ============================================================================
// Example 10: Complete Company Analysis Workflow
// ============================================================================

async function completeCompanyAnalysis(domain: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETE COMPANY ANALYSIS: ${domain.toUpperCase()}`);
  console.log('='.repeat(80) + '\n');

  try {
    // 1. Technology Stack
    console.log('1. TECHNOLOGY STACK');
    console.log('-'.repeat(80));
    const techStack = await builtWithClient.getDomainTechnologies(domain);
    const technologies = techStack.data.Results[0]?.Result.Paths[0]?.Technologies || [];
    console.log(`Detected ${technologies.length} technologies`);
    console.log(`Source: ${techStack.meta.cached ? 'Cache' : 'API'} (${techStack.meta.latency_ms}ms)`);
    console.log();

    // 2. Financial Profile
    console.log('2. FINANCIAL PROFILE');
    console.log('-'.repeat(80));
    const financials = await builtWithClient.getFinancials(domain);
    const { Estimates } = financials.data;
    console.log(`Company Size: ${Estimates.CompanySize}`);
    console.log(`Revenue: $${(Estimates.Revenue.Min / 1000000).toFixed(1)}M - $${(Estimates.Revenue.Max / 1000000).toFixed(1)}M`);
    console.log(`Employees: ${Estimates.Employees.Min} - ${Estimates.Employees.Max}`);
    console.log();

    // 3. Social Presence
    console.log('3. SOCIAL PRESENCE');
    console.log('-'.repeat(80));
    const social = await builtWithClient.getSocialProfiles(domain);
    console.log(`Active Profiles: ${social.data.Profiles.length}`);
    social.data.Profiles.forEach(p => {
      console.log(`  - ${p.Platform}: ${p.Followers?.toLocaleString() || 'N/A'} followers`);
    });
    console.log();

    // 4. Trust & Security
    console.log('4. TRUST & SECURITY');
    console.log('-'.repeat(80));
    const trust = await builtWithClient.getTrustIndicators(domain);
    console.log(`SSL: ${trust.data.Security.HasSSL ? '✓' : '✗'}`);
    console.log(`Trust Badges: ${trust.data.TrustSignals.TrustBadges.length}`);
    console.log();

    // 5. SEO Performance
    console.log('5. SEO PERFORMANCE');
    console.log('-'.repeat(80));
    const keywords = await builtWithClient.getKeywords(domain);
    console.log(`Organic Visibility: ${keywords.data.OrganicVisibility}/100`);
    console.log(`Top Keywords: ${keywords.data.Keywords.length}`);
    console.log();

    console.log('='.repeat(80));
    console.log('ANALYSIS COMPLETE\n');

  } catch (error) {
    console.error('Error during analysis:', error);
  }
}

// ============================================================================
// Run Examples
// ============================================================================

async function main() {
  // Uncomment the examples you want to run:

  // await getTechnologyStack();
  // await analyzeTechRelationships();
  // await getCompanyFinancials();
  // await analyzeSocialPresence();
  // await analyzeTrustSignals();
  // await analyzeKeywords();
  // await batchCompetitorAnalysis();
  // await getTechRecommendations();
  // await monitorAPIUsage();

  // Complete workflow
  await completeCompanyAnalysis('costco.com');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  getTechnologyStack,
  analyzeTechRelationships,
  getCompanyFinancials,
  analyzeSocialPresence,
  analyzeTrustSignals,
  analyzeKeywords,
  batchCompetitorAnalysis,
  getTechRecommendations,
  monitorAPIUsage,
  completeCompanyAnalysis
};
