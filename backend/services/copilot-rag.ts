/**
 * Copilot RAG Service - Semantic search over platform documentation
 */

import { SupabaseClient } from '../database/supabase';
import { logger } from '../utils/logger';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = new SupabaseClient();
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = 0.78;
const MAX_RESULTS = 3;

interface DocumentChunk {
  id: string;
  content: string;
  metadata: { source: string; title: string; section?: string };
  similarity: number;
}

export class CopilotRAG {
  async search(query: string): Promise<string> {
    try {
      const embedding = await this.generateEmbedding(query);
      const docs = await this.searchVectors(embedding);
      if (docs.length === 0) return 'No relevant documentation found.';
      return docs.map((doc, i) => `[Doc ${i + 1}] ${doc.metadata.title}\n${doc.content}\nSource: ${doc.metadata.source}`).join('\n\n---\n\n');
    } catch (error) {
      logger.error('RAG search failed', { error, query });
      return 'Documentation search unavailable.';
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    const response = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
    return response.data[0].embedding;
  }

  private async searchVectors(embedding: number[]): Promise<DocumentChunk[]> {
    // TODO: Implement pgvector search via Supabase RPC when available
    // For now, return empty array
    logger.warn('RAG vector search not yet implemented - needs pgvector RPC function');
    return [];
  }

  async indexDocument(content: string, metadata: { source: string; title: string; section?: string }): Promise<void> {
    try {
      const embedding = await this.generateEmbedding(content);
      // TODO: Implement document indexing via Supabase when copilot_documentation table exists
      logger.info('Document indexing not yet implemented', { title: metadata.title });
    } catch (error) {
      logger.error('Failed to index document', { error, metadata });
      throw error;
    }
  }

  async indexDocuments(docs: Array<{ content: string; metadata: { source: string; title: string; section?: string } }>): Promise<void> {
    logger.info('Indexing documents', { count: docs.length });
    for (const doc of docs) await this.indexDocument(doc.content, doc.metadata);
    logger.info('Finished indexing documents', { count: docs.length });
  }
}
