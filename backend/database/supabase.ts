import { createClient, SupabaseClient as SupaClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { DatabaseError } from '../utils/errors';
import { Company, Audit, APICallMetadata } from '../types';

export class SupabaseClient {
  private client: SupaClient;

  constructor() {
    this.client = createClient(
      config.database.supabaseUrl,
      config.database.supabaseKey
    );
    logger.info('Supabase client initialized');
  }

  async query<T>(
    table: string,
    filters?: Record<string, any>
  ): Promise<T[]> {
    try {
      let query = this.client.from(table).select('*');

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (key === 'limit') {
            query = query.limit(value);
          } else if (key === 'order') {
            query = query.order(value);
          } else {
            query = query.eq(key, value);
          }
        });
      }

      const { data, error } = await query;

      if (error) {
        throw new DatabaseError(`Query failed: ${error.message}`, 'query', table, error);
      }

      return data as T[];
    } catch (error) {
      logger.error(`Database query error: ${table}`, error);
      throw error;
    }
  }

  async insert<T>(table: string, data: Partial<T>): Promise<T> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Insert failed: ${error.message}`, 'insert', table, error);
      }

      return result as T;
    } catch (error) {
      logger.error(`Database insert error: ${table}`, error);
      throw error;
    }
  }

  async upsert<T>(table: string, data: Partial<T>): Promise<T> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .upsert(data)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Upsert failed: ${error.message}`, 'upsert', table, error);
      }

      return result as T;
    } catch (error) {
      logger.error(`Database upsert error: ${table}`, error);
      throw error;
    }
  }

  async update<T>(
    table: string,
    id: string,
    data: Partial<T>
  ): Promise<T> {
    try {
      const { data: result, error } = await this.client
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new DatabaseError(`Update failed: ${error.message}`, 'update', table, error);
      }

      return result as T;
    } catch (error) {
      logger.error(`Database update error: ${table}`, error);
      throw error;
    }
  }

  async delete(table: string, id: string): Promise<void> {
    try {
      const { error } = await this.client
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        throw new DatabaseError(`Delete failed: ${error.message}`, 'delete', table, error);
      }
    } catch (error) {
      logger.error(`Database delete error: ${table}`, error);
      throw error;
    }
  }

  async saveAPICall(metadata: APICallMetadata): Promise<void> {
    try {
      await this.insert('api_calls', metadata);
      logger.debug(`API call saved: ${metadata.service}/${metadata.endpoint}`);
    } catch (error) {
      logger.error('Failed to save API call metadata', error);
      // Don't throw - API call tracking is non-critical
    }
  }

  async getCompany(domain: string): Promise<Company | null> {
    try {
      const { data, error } = await this.client
        .from('companies')
        .select('*')
        .eq('domain', domain)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return data as Company | null;
    } catch (error) {
      logger.error(`Failed to get company: ${domain}`, error);
      return null;
    }
  }

  async createAudit(companyId: string, type: 'partner_intel' | 'search_audit'): Promise<Audit> {
    return this.insert<Audit>('audits', {
      company_id: companyId,
      audit_type: type,
      status: 'pending',
      data: {}
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await this.client.from('companies').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Supabase client doesn't require explicit cleanup
    logger.info('Supabase client disconnected');
  }
}
