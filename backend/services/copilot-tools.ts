import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';

export class CopilotTools {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = new SupabaseClient();
  }

  getToolDefinitions() {
    return [
      {
        name: 'getCompany',
        description: 'Get company details by domain (profile, ICP score, status, technologies)',
        input_schema: {
          type: 'object' as const,
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
          type: 'object' as const,
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
          type: 'object' as const,
          properties: {
            technology: {
              type: 'string',
              description: 'Filter by technology (e.g., Adobe AEM, Elastic)',
            },
            icpScore: {
              type: 'object' as const,
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
          type: 'object' as const,
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
          type: 'object' as const,
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
          type: 'object' as const,
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
    try {
      const company = await this.supabase.getCompany(domain);

      if (!company) {
        return { error: 'Company not found', domain };
      }

      return company;
    } catch (error) {
      logger.error('Failed to get company', { domain, error });
      return { error: 'Failed to fetch company data', domain };
    }
  }

  private async getLatestAudit(companyId: string) {
    try {
      const audits = await this.supabase.query('audits', {
        company_id: companyId,
        limit: 1,
        order: 'created_at'
      });

      if (!audits || audits.length === 0) {
        return { error: 'No audits found', companyId };
      }

      return audits[0];
    } catch (error) {
      logger.error('Failed to get latest audit', { companyId, error });
      return { error: 'Failed to fetch audit data', companyId };
    }
  }

  private async searchCompanies(filters: any) {
    try {
      const queryFilters: any = {};

      if (filters.status) {
        queryFilters.status = filters.status;
      }

      if (filters.limit) {
        queryFilters.limit = filters.limit;
      } else {
        queryFilters.limit = 10;
      }

      // For more complex filters like technology and ICP score ranges,
      // we'll fetch all and filter in memory (temporary solution until RPC functions are ready)
      const companies = await this.supabase.query('companies', queryFilters);

      let filtered = companies;

      // Filter by ICP score
      if (filters.icpScore) {
        filtered = filtered.filter((c: any) => {
          const score = c.icp_score || 0;
          if (filters.icpScore.min && score < filters.icpScore.min) return false;
          if (filters.icpScore.max && score > filters.icpScore.max) return false;
          return true;
        });
      }

      // Filter by technology (contains check)
      if (filters.technology) {
        filtered = filtered.filter((c: any) => {
          const techs = c.technologies || [];
          return techs.some((t: string) =>
            t.toLowerCase().includes(filters.technology.toLowerCase())
          );
        });
      }

      return {
        count: filtered.length,
        companies: filtered.slice(0, filters.limit || 10)
      };
    } catch (error) {
      logger.error('Failed to search companies', { filters, error });
      return { error: 'Failed to search companies', filters };
    }
  }

  private async getTechnologies(companyId: string) {
    try {
      const companies = await this.supabase.query<{ technologies?: any[] }>('companies', {
        id: companyId
      });

      if (!companies || companies.length === 0) {
        return { error: 'Company not found', companyId };
      }

      return {
        companyId,
        technologies: companies[0].technologies || []
      };
    } catch (error) {
      logger.error('Failed to get technologies', { companyId, error });
      return { error: 'Failed to fetch technologies', companyId };
    }
  }

  private async getFinancials(companyId: string) {
    try {
      const financials = await this.supabase.query('company_financials', {
        company_id: companyId
      });

      if (!financials || financials.length === 0) {
        return { error: 'No financial data found', companyId };
      }

      return {
        companyId,
        financials: financials.slice(0, 3) // Last 3 years
      };
    } catch (error) {
      logger.error('Failed to get financials', { companyId, error });
      return { error: 'Failed to fetch financial data', companyId };
    }
  }

  private async getCompetitors(companyId: string) {
    try {
      const competitors = await this.supabase.query('company_competitors', {
        company_id: companyId
      });

      if (!competitors || competitors.length === 0) {
        return { error: 'No competitor data found', companyId };
      }

      return {
        companyId,
        competitors
      };
    } catch (error) {
      logger.error('Failed to get competitors', { companyId, error });
      return { error: 'Failed to fetch competitor data', companyId };
    }
  }
}
