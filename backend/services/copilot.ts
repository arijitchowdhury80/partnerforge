import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { CopilotTools } from './copilot-tools';
import { CopilotContext } from './copilot-context';
import { CopilotRAG } from './copilot-rag';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface CopilotResponse {
  message: string;
  actions?: Action[];
  navigation?: string; // URL to navigate to
  citations?: string[];
}

export interface Action {
  type: 'button' | 'link';
  label: string;
  action: string;
  data?: any;
}

export class CopilotService {
  private anthropic: Anthropic;
  private tools: CopilotTools;
  private contextService: CopilotContext;
  private ragService: CopilotRAG;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    this.tools = new CopilotTools();
    this.contextService = new CopilotContext();
    this.ragService = new CopilotRAG();
  }

  async chat(
    userId: string,
    message: string,
    conversationHistory: Message[],
    userContext?: any
  ): Promise<CopilotResponse> {
    logger.info('Copilot chat request', { userId, message });

    // Get user's current page context
    const pageContext = userContext || await this.contextService.getContext(userId);

    // Get relevant documentation (RAG)
    const docContext = await this.ragService.search(message);

    // Build system prompt with context
    const systemPrompt = this.buildSystemPrompt(pageContext, docContext);

    // Call Anthropic Agent SDK
    const response = await this.anthropic.messages.create({
      model: process.env.COPILOT_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: parseInt(process.env.COPILOT_MAX_TOKENS || '2048'),
      system: systemPrompt,
      messages: [
        ...conversationHistory.map(m => ({
          role: m.role,
          content: m.content
        })),
        { role: 'user', content: message }
      ],
      tools: this.tools.getToolDefinitions(),
    });

    // Handle tool use
    if (response.stop_reason === 'tool_use') {
      const toolResults = await this.executeTools(response);

      // Continue conversation with tool results
      const finalResponse = await this.anthropic.messages.create({
        model: process.env.COPILOT_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [
          ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
          { role: 'assistant', content: response.content },
          { role: 'user', content: toolResults }
        ],
      });

      return this.formatResponse(finalResponse, pageContext);
    }

    return this.formatResponse(response, pageContext);
  }

  private buildSystemPrompt(pageContext: any, docContext: string): string {
    return `You are the Algolia Arian Copilot, an AI assistant embedded throughout the Partner Intelligence platform.

CRITICAL RULES:
1. ONLY answer questions about data in the database (companies, audits, technologies, enrichment data)
2. ALWAYS call the appropriate tool BEFORE answering data questions - never guess or make up data
3. NEVER invent statistics, scores, or metrics that don't exist in the database
4. If you don't have the data, say "I don't have that information in the database"
5. ALWAYS cite sources with (Company ID, Audit ID, Date) format
6. Provide navigation buttons like [View Company →] when relevant

USER CONTEXT:
- Current Page: ${pageContext.page || 'unknown'}
- Viewing Company: ${pageContext.companyName || 'none'}
- Company ID: ${pageContext.companyId || 'none'}
- Current Tab: ${pageContext.tab || 'none'}

AVAILABLE TOOLS:
- getCompany(domain): Get company profile, ICP score, status, technologies
- getLatestAudit(companyId): Get most recent audit with findings, scores, screenshots
- searchCompanies(filters): Filter companies by technology, ICP score, status, traffic
- getTechnologies(companyId): Get full tech stack from BuiltWith
- getFinancials(companyId): Get revenue, growth, margins
- getCompetitors(companyId): Get competitor analysis

RELEVANT DOCUMENTATION:
${docContext}

RESPONSE STYLE:
- Concise and actionable (2-3 sentences max)
- Include navigation buttons when helpful
- Use markdown for formatting
- Cite sources for all data points

EXAMPLES:

User: "What's Costco's search provider?"
You: "According to the audit from March 1, 2026 (Audit ID: aud_123), Costco uses **Elastic Enterprise Search** v8.1. [View Tech Stack →]"

User: "Show me hot leads using Adobe AEM"
You: "I found 47 companies using Adobe AEM with ICP score ≥80 (Hot status). Top 5:
1. Hallmark (Score: 92) - Retail, $4.2B revenue
2. Herman Miller (Score: 88) - Furniture, $2.8B revenue
...
[View All 47 →]"

User: "Why is their search score low?"
You: "Costco scored 4.4/10 on search experience. Main gaps:
• **No NLP** - Complex queries return irrelevant results
• **Zero recommendations** - No "You might also like"
• **Poor typo handling** - Misspellings return no results
[View Full Scorecard →]"

FORBIDDEN:
- General web search or external knowledge
- Making recommendations without data
- Executing actions without user approval
- Answering questions about other products/companies not in the database`;
  }

  private async executeTools(response: any): Promise<any[]> {
    const toolCalls = response.content.filter((c: any) => c.type === 'tool_use');

    const toolResults = await Promise.all(
      toolCalls.map(async (toolCall: any) => {
        const result = await this.tools.executeTool(toolCall.name, toolCall.input);

        return {
          type: 'tool_result',
          tool_use_id: toolCall.id,
          content: JSON.stringify(result),
        };
      })
    );

    return toolResults;
  }

  private formatResponse(response: any, pageContext: any): CopilotResponse {
    const messageContent = response.content.find((c: any) => c.type === 'text');
    const message = messageContent?.text || '';

    // Extract navigation buttons from markdown links
    const navigationRegex = /\[([^\]]+)\s*→\]/g;
    const actions: Action[] = [];
    let match;

    while ((match = navigationRegex.exec(message)) !== null) {
      actions.push({
        type: 'button',
        label: match[1],
        action: 'navigate',
        data: this.inferNavigationPath(match[1], pageContext),
      });
    }

    return {
      message,
      actions: actions.length > 0 ? actions : undefined,
    };
  }

  private inferNavigationPath(label: string, pageContext: any): string {
    const lowerLabel = label.toLowerCase();

    if (lowerLabel.includes('tech stack')) {
      return `/companies/${pageContext.companyId}/tech-stack`;
    } else if (lowerLabel.includes('scorecard')) {
      return `/audits/${pageContext.auditId}/scorecard`;
    } else if (lowerLabel.includes('findings')) {
      return `/audits/${pageContext.auditId}/findings`;
    } else if (lowerLabel.includes('company')) {
      return `/companies/${pageContext.companyId}`;
    }

    return '/';
  }
}
