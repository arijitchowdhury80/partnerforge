import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class MigrationRunner {
  private migrationsPath: string;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../../supabase/migrations');
  }

  async run(): Promise<void> {
    logger.info('Starting database migrations');

    try {
      // Check if migrations directory exists
      if (!fs.existsSync(this.migrationsPath)) {
        logger.warn(`Migrations directory not found: ${this.migrationsPath}`);
        return;
      }

      // Get all migration files (sorted)
      const files = fs
        .readdirSync(this.migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .filter(f => f.match(/^\d{17,}_.*\.sql$/)) // Only numbered migrations (20260307XXX format)
        .sort();

      logger.info(`Found ${files.length} migration files`);

      // Extract project ref from Supabase URL
      const projectRef = config.database.supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

      if (!projectRef) {
        throw new Error('Could not extract project ref from SUPABASE_URL');
      }

      // Build PostgreSQL connection string using service role
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY required for migrations');
      }

      // Supabase connection string format
      const connectionString = `postgresql://postgres.${projectRef}:${serviceRoleKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

      const client = new Client({ connectionString });

      await client.connect();
      logger.info('Connected to PostgreSQL');

      try {
        for (const file of files) {
          await this.runMigration(client, file);
        }
      } finally {
        await client.end();
        logger.info('PostgreSQL connection closed');
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed', error);
      throw error;
    }
  }

  private async runMigration(client: Client, filename: string): Promise<void> {
    try {
      const filePath = path.join(this.migrationsPath, filename);
      const sql = fs.readFileSync(filePath, 'utf-8');

      logger.info(`Running migration: ${filename}`);

      // Execute the entire SQL file
      await client.query(sql);

      logger.info(`Migration completed: ${filename}`);
    } catch (error: any) {
      logger.error(`Migration failed: ${filename}`, { error: error.message });
      throw error;
    }
  }
}

// CLI entry point
if (require.main === module) {
  const runner = new MigrationRunner();
  runner
    .run()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Migration script failed', error);
      process.exit(1);
    });
}
