import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';
import { DatabaseError } from '../utils/errors';

/**
 * Strategic Analysis Engine
 *
 * Synthesizes ALL enrichment data into strategic insights for sales enablement.
 * Maps insights to Algolia value propositions and generates actionable sales intelligence.
 *
 * Architecture Pattern:
 * - Level 1: Module-level insights (populated during enrichment)
 * - Level 2: Company-level synthesis (this service)
 * - All linked via composite key (company_id, audit_id)
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type AlgoliaValueProp =
  | 'search_relevance'
  | 'scale_performance'
  | 'mobile_experience'
  | 'conversion_optimization'
  | 'personalization'
  | 'time_to_market'
  | 'operational_efficiency';

export interface ModuleInsight {
  module: string;
  insight: string | null;
  confidence_score: number | null;
  evidence_urls: string[];
}

export interface StrategicAnalysis {
  company_id: string;
  audit_id: string;
  primary_value_prop: AlgoliaValueProp;
  secondary_value_props: AlgoliaValueProp[];
  sales_pitch: string;
  business_impact: string;
  strategic_recommendations: string;
  trigger_events: string[];
  timing_signals: string[];
  caution_signals: string[];
  overall_confidence_score: number;
  insights_synthesized_from: string[];
  analysis_generated_at: Date;
}

interface ValuePropScore {
  prop: AlgoliaValueProp;
  score: number;
  supporting_insights: string[];
}

interface TrafficData {
  monthly_visits?: number;
  bounce_rate?: number;
  avg_visit_duration_seconds?: number;
  pages_per_visit?: number;
  mobile_traffic_share?: number;
}

interface FinancialData {
  revenue?: number;
  revenue_growth_yoy?: number;
  profit_margin?: number;
}

// ============================================================================
// Main Service
// ============================================================================

export class StrategicAnalysisEngine {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = new SupabaseClient();
  }

  /**
   * Main synthesis method
   * Gathers all module insights and generates company-level strategic analysis
   */
  async synthesize(companyId: string, auditId: string): Promise<StrategicAnalysis> {
    logger.info('Starting strategic analysis synthesis', { companyId, auditId });

    try {
      // Step 1: Gather ALL module insights
      const insights = await this.gatherModuleInsights(companyId, auditId);

      if (insights.length === 0) {
        throw new DatabaseError(
          'No enrichment data found for strategic analysis',
          'synthesize',
          'enrichment_tables',
          { companyId, auditId }
        );
      }

      logger.info(`Gathered ${insights.length} module insights`, { companyId, auditId });

      // Step 2: Identify primary and secondary value props
      const valuePropScores = await this.calculateValuePropScores(insights, companyId, auditId);
      const [primary, ...secondaries] = valuePropScores
        .sort((a, b) => b.score - a.score)
        .slice(0, 3); // Top 3

      // Step 3: Calculate business impact
      const businessImpact = await this.calculateBusinessImpact(companyId, auditId, primary);

      // Step 4: Generate sales pitch
      const salesPitch = this.generateSalesPitch(primary, secondaries, insights, businessImpact);

      // Step 5: Generate strategic recommendations
      const strategicRecommendations = this.generateStrategicRecommendations(primary, secondaries);

      // Step 6: Extract timing intelligence
      const timingIntelligence = await this.extractTimingIntelligence(companyId, auditId);

      // Step 7: Calculate overall confidence score
      const overallConfidence = this.calculateOverallConfidence(insights);

      // Step 8: Build analysis object
      const analysis: StrategicAnalysis = {
        company_id: companyId,
        audit_id: auditId,
        primary_value_prop: primary.prop,
        secondary_value_props: secondaries.map(s => s.prop),
        sales_pitch: salesPitch,
        business_impact: businessImpact,
        strategic_recommendations: strategicRecommendations,
        trigger_events: timingIntelligence.triggers,
        timing_signals: timingIntelligence.signals,
        caution_signals: timingIntelligence.cautions,
        overall_confidence_score: overallConfidence,
        insights_synthesized_from: insights.map(i => i.module),
        analysis_generated_at: new Date()
      };

      // Step 9: Save to database
      await this.saveAnalysis(analysis);

      logger.info('Strategic analysis synthesis complete', {
        companyId,
        auditId,
        primaryValueProp: primary.prop,
        confidence: overallConfidence
      });

      return analysis;

    } catch (error) {
      logger.error('Strategic analysis synthesis failed', {
        companyId,
        auditId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Gather insights from ALL enrichment tables
   */
  private async gatherModuleInsights(
    companyId: string,
    auditId: string
  ): Promise<ModuleInsight[]> {
    const insights: ModuleInsight[] = [];

    const modules = [
      'company_traffic',
      'company_financials',
      'company_technologies',
      'company_competitors',
      'company_executives',
      'executive_quotes',
      'company_social_profiles',
      'company_social_posts',
      'buying_committee',
      'intent_signals',
      'company_hiring',
      'search_audit_tests'
    ];

    // Query all modules in parallel
    const promises = modules.map(async (module) => {
      try {
        const rows = await this.supabase.query<any>(module, {
          company_id: companyId,
          audit_id: auditId
        });

        // Extract insights from rows
        rows.forEach(row => {
          if (row.insight && row.confidence_score >= 8.0) {
            insights.push({
              module,
              insight: row.insight,
              confidence_score: row.confidence_score,
              evidence_urls: row.evidence_urls || []
            });
          }
        });
      } catch (error) {
        logger.warn(`Failed to gather insights from ${module}`, {
          companyId,
          auditId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue with other modules
      }
    });

    await Promise.all(promises);

    return insights;
  }

  /**
   * Calculate value prop scores based on insights
   */
  private async calculateValuePropScores(
    insights: ModuleInsight[],
    companyId: string,
    auditId: string
  ): Promise<ValuePropScore[]> {
    const scores: Record<AlgoliaValueProp, ValuePropScore> = {
      search_relevance: { prop: 'search_relevance', score: 0, supporting_insights: [] },
      scale_performance: { prop: 'scale_performance', score: 0, supporting_insights: [] },
      mobile_experience: { prop: 'mobile_experience', score: 0, supporting_insights: [] },
      conversion_optimization: { prop: 'conversion_optimization', score: 0, supporting_insights: [] },
      personalization: { prop: 'personalization', score: 0, supporting_insights: [] },
      time_to_market: { prop: 'time_to_market', score: 0, supporting_insights: [] },
      operational_efficiency: { prop: 'operational_efficiency', score: 0, supporting_insights: [] }
    };

    // Map insights to value props based on keywords
    insights.forEach(insight => {
      if (!insight.insight || !insight.confidence_score) return;

      const text = insight.insight.toLowerCase();
      const weight = insight.confidence_score / 10.0; // Normalize to 0-1

      // Search Relevance
      if (text.match(/relevance|search quality|zero results|typo|synonym|query/i)) {
        scores.search_relevance.score += weight * 10;
        scores.search_relevance.supporting_insights.push(insight.insight);
      }

      // Scale & Performance
      if (text.match(/traffic|scale|performance|speed|latency|uptime/i)) {
        scores.scale_performance.score += weight * 10;
        scores.scale_performance.supporting_insights.push(insight.insight);
      }

      // Mobile Experience
      if (text.match(/mobile|app|tablet|responsive|ios|android/i)) {
        scores.mobile_experience.score += weight * 10;
        scores.mobile_experience.supporting_insights.push(insight.insight);
      }

      // Conversion Optimization
      if (text.match(/conversion|revenue|cart|checkout|abandon|bounce/i)) {
        scores.conversion_optimization.score += weight * 10;
        scores.conversion_optimization.supporting_insights.push(insight.insight);
      }

      // Personalization
      if (text.match(/personali[zs]ation|recommendation|behavioral|segment/i)) {
        scores.personalization.score += weight * 10;
        scores.personalization.supporting_insights.push(insight.insight);
      }

      // Time to Market
      if (text.match(/time to market|agility|deploy|release|developer/i)) {
        scores.time_to_market.score += weight * 10;
        scores.time_to_market.supporting_insights.push(insight.insight);
      }

      // Operational Efficiency
      if (text.match(/cost|efficiency|operation|maintain|infrastructure/i)) {
        scores.operational_efficiency.score += weight * 10;
        scores.operational_efficiency.supporting_insights.push(insight.insight);
      }
    });

    return Object.values(scores).filter(s => s.score > 0);
  }

  /**
   * Calculate quantified business impact
   */
  private async calculateBusinessImpact(
    companyId: string,
    auditId: string,
    primaryValueProp: ValuePropScore
  ): Promise<string> {
    try {
      // Get traffic data
      const traffic = await this.supabase.query<TrafficData>('company_traffic', {
        company_id: companyId,
        audit_id: auditId,
        limit: 1
      });

      // Get financial data
      const financials = await this.supabase.query<FinancialData>('company_financials', {
        company_id: companyId,
        audit_id: auditId,
        limit: 1
      });

      const trafficData = traffic[0];
      const financialData = financials[0];

      if (!trafficData || !financialData) {
        return 'Business impact quantification requires traffic and financial data';
      }

      // Calculate revenue at risk based on primary value prop
      let revenueAtRisk = 0;
      let impactDescription = '';

      switch (primaryValueProp.prop) {
        case 'search_relevance':
          // Poor search = higher bounce rate = lost conversions
          if (trafficData.bounce_rate && trafficData.monthly_visits && financialData.revenue) {
            const excessBounce = Math.max(0, trafficData.bounce_rate - 0.35); // 35% is good
            const impactedVisits = trafficData.monthly_visits * excessBounce;
            const avgOrderValue = financialData.revenue / 12 / (trafficData.monthly_visits * 0.02); // 2% conv
            revenueAtRisk = impactedVisits * 0.02 * avgOrderValue;
            impactDescription = `${(excessBounce * 100).toFixed(1)}% excess bounce rate`;
          }
          break;

        case 'conversion_optimization':
          // Suboptimal search UX impacts conversion
          if (trafficData.monthly_visits && financialData.revenue) {
            const currentConv = 0.02; // Assume 2% baseline
            const potentialConv = 0.035; // 3.5% with Algolia
            const convUplift = potentialConv - currentConv;
            const avgOrderValue = financialData.revenue / 12 / (trafficData.monthly_visits * currentConv);
            revenueAtRisk = trafficData.monthly_visits * convUplift * avgOrderValue;
            impactDescription = `${(convUplift * 100).toFixed(1)}% conversion rate improvement potential`;
          }
          break;

        case 'mobile_experience':
          // Poor mobile search loses mobile conversions
          if (trafficData.mobile_traffic_share && trafficData.monthly_visits && financialData.revenue) {
            const mobileVisits = trafficData.monthly_visits * trafficData.mobile_traffic_share;
            const avgOrderValue = financialData.revenue / 12 / (trafficData.monthly_visits * 0.02);
            revenueAtRisk = mobileVisits * 0.015 * avgOrderValue; // 1.5% mobile conv impact
            impactDescription = `${(trafficData.mobile_traffic_share * 100).toFixed(0)}% of traffic is mobile`;
          }
          break;

        default:
          // Generic revenue at risk calculation
          if (financialData.revenue) {
            revenueAtRisk = financialData.revenue / 12 * 0.05; // 5% monthly revenue at risk
            impactDescription = 'search optimization opportunity';
          }
      }

      if (revenueAtRisk > 0) {
        const monthlyImpact = (revenueAtRisk / 1_000_000).toFixed(1);
        const annualImpact = (revenueAtRisk * 12 / 1_000_000).toFixed(1);
        return `$${monthlyImpact}M monthly revenue at risk from ${impactDescription} ($${annualImpact}M annual)`;
      }

      return 'Significant revenue optimization opportunity through improved search experience';

    } catch (error) {
      logger.warn('Failed to calculate business impact', {
        companyId,
        auditId,
        error: error instanceof Error ? error.message : String(error)
      });
      return 'Business impact quantification pending complete data enrichment';
    }
  }

  /**
   * Generate synthesized sales pitch
   */
  private generateSalesPitch(
    primary: ValuePropScore,
    secondaries: ValuePropScore[],
    insights: ModuleInsight[],
    businessImpact: string
  ): string {
    const sections: string[] = [];

    // Opening: Primary value prop
    sections.push(
      `Based on comprehensive analysis of ${insights.length} data points across enrichment modules, ` +
      `the primary opportunity for Algolia is ${this.valuePropToLabel(primary.prop)}.`
    );

    // Business impact
    sections.push(businessImpact);

    // Key supporting insights (top 3 from primary value prop)
    if (primary.supporting_insights.length > 0) {
      sections.push(
        'Key findings supporting this opportunity:\n' +
        primary.supporting_insights
          .slice(0, 3)
          .map((insight, i) => `${i + 1}. ${insight}`)
          .join('\n')
      );
    }

    // Secondary value props
    if (secondaries.length > 0) {
      sections.push(
        'Additional value opportunities: ' +
        secondaries.map(s => this.valuePropToLabel(s.prop)).join(', ') + '.'
      );
    }

    return sections.join('\n\n');
  }

  /**
   * Generate strategic recommendations
   */
  private generateStrategicRecommendations(
    primary: ValuePropScore,
    secondaries: ValuePropScore[]
  ): string {
    const recommendations: string[] = ['## How Algolia Can Help\n'];

    // Primary recommendation
    recommendations.push(`**${this.valuePropToLabel(primary.prop)}**`);
    recommendations.push(this.getValuePropSolution(primary.prop));
    recommendations.push('');

    // Secondary recommendations
    if (secondaries.length > 0) {
      secondaries.forEach(secondary => {
        recommendations.push(`**${this.valuePropToLabel(secondary.prop)}**`);
        recommendations.push(this.getValuePropSolution(secondary.prop));
        recommendations.push('');
      });
    }

    return recommendations.join('\n');
  }

  /**
   * Extract timing intelligence (triggers, signals, cautions)
   */
  private async extractTimingIntelligence(
    companyId: string,
    auditId: string
  ): Promise<{ triggers: string[]; signals: string[]; cautions: string[] }> {
    const triggers: string[] = [];
    const signals: string[] = [];
    const cautions: string[] = [];

    try {
      // Get executive quotes (earnings calls, etc.)
      const quotes = await this.supabase.query<any>('executive_quotes', {
        company_id: companyId,
        audit_id: auditId
      });

      quotes.forEach(quote => {
        if (quote.quote_text?.match(/digital transformation|innovation|search|customer experience/i)) {
          triggers.push(`${quote.source_date}: ${quote.executive_name} - "${quote.quote_text.substring(0, 100)}..."`);
        }
      });

      // Get hiring signals
      const hiring = await this.supabase.query<any>('company_hiring', {
        company_id: companyId,
        audit_id: auditId
      });

      const searchEngineers = hiring.filter(h =>
        h.job_title?.match(/search|engineer|developer|architect/i)
      );

      if (searchEngineers.length >= 3) {
        signals.push(`Hiring ${searchEngineers.length} search/engineering roles - build vs buy decision point`);
      }

      // Check for layoff signals
      const layoffRoles = hiring.filter(h =>
        h.job_title?.match(/layoff|reduction|downsize/i)
      );

      if (layoffRoles.length > 0) {
        cautions.push('Recent workforce reductions may impact budget availability');
      }

      // Get financial trends
      const financials = await this.supabase.query<any>('company_financials', {
        company_id: companyId,
        audit_id: auditId
      });

      const recentFinancial = financials[0];
      if (recentFinancial?.revenue_growth_yoy && recentFinancial.revenue_growth_yoy < -0.05) {
        signals.push(`Revenue declining ${Math.abs(recentFinancial.revenue_growth_yoy * 100).toFixed(1)}% YoY - digital optimization critical`);
      } else if (recentFinancial?.revenue_growth_yoy && recentFinancial.revenue_growth_yoy > 0.15) {
        signals.push(`Strong revenue growth ${(recentFinancial.revenue_growth_yoy * 100).toFixed(1)}% YoY - budget availability likely`);
      }

      // Get competitor intelligence
      const competitors = await this.supabase.query<any>('company_competitors', {
        company_id: companyId,
        audit_id: auditId
      });

      const algoliaCompetitors = competitors.filter(c =>
        c.insight?.match(/algolia/i)
      );

      if (algoliaCompetitors.length > 0) {
        signals.push(`${algoliaCompetitors.length} competitors using Algolia - competitive pressure`);
      }

    } catch (error) {
      logger.warn('Failed to extract timing intelligence', {
        companyId,
        auditId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return { triggers, signals, cautions };
  }

  /**
   * Calculate overall confidence score (weighted average)
   */
  private calculateOverallConfidence(insights: ModuleInsight[]): number {
    if (insights.length === 0) return 8.0;

    const validInsights = insights.filter(i => i.confidence_score !== null);
    if (validInsights.length === 0) return 8.0;

    const sum = validInsights.reduce((acc, i) => acc + (i.confidence_score || 0), 0);
    const avg = sum / validInsights.length;

    // Floor at 8.0, cap at 10.0
    return Math.max(8.0, Math.min(10.0, avg));
  }

  /**
   * Save strategic analysis to database
   */
  private async saveAnalysis(analysis: StrategicAnalysis): Promise<void> {
    try {
      await this.supabase.insert('company_strategic_analysis', analysis);
      logger.info('Strategic analysis saved to database', {
        companyId: analysis.company_id,
        auditId: analysis.audit_id
      });
    } catch (error) {
      logger.error('Failed to save strategic analysis', {
        companyId: analysis.company_id,
        auditId: analysis.audit_id,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new DatabaseError(
        'Failed to save strategic analysis',
        'insert',
        'company_strategic_analysis',
        error
      );
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private valuePropToLabel(prop: AlgoliaValueProp): string {
    const labels: Record<AlgoliaValueProp, string> = {
      search_relevance: 'Search Relevance & Quality',
      scale_performance: 'Scale & Performance',
      mobile_experience: 'Mobile Experience',
      conversion_optimization: 'Conversion Optimization',
      personalization: 'Personalization & Recommendations',
      time_to_market: 'Time to Market',
      operational_efficiency: 'Operational Efficiency'
    };
    return labels[prop];
  }

  private getValuePropSolution(prop: AlgoliaValueProp): string {
    const solutions: Record<AlgoliaValueProp, string> = {
      search_relevance:
        'Algolia\'s AI-powered search delivers industry-leading relevance with typo tolerance, ' +
        'synonym detection, and semantic understanding out of the box.',
      scale_performance:
        'Algolia scales effortlessly to billions of records with sub-50ms query response times, ' +
        'backed by 99.99% uptime SLA and global CDN infrastructure.',
      mobile_experience:
        'Algolia\'s mobile-first architecture delivers lightning-fast search on any device with ' +
        'offline support and optimized for 3G/4G networks.',
      conversion_optimization:
        'Algolia increases conversions by 40%+ through instant search results, federated search, ' +
        'and merchandising controls that guide users to purchase.',
      personalization:
        'Algolia Recommend provides AI-powered personalization and product recommendations that ' +
        'increase average order value by 25%+.',
      time_to_market:
        'Deploy production-ready search in days, not months. Algolia\'s no-code dashboard and ' +
        'API-first design accelerates time to market by 10x.',
      operational_efficiency:
        'Reduce total cost of ownership by 60% vs. self-hosted Elasticsearch. No infrastructure ' +
        'management, no DevOps overhead, predictable pricing.'
    };
    return solutions[prop];
  }
}
