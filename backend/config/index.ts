import dotenv from 'dotenv';

dotenv.config();

interface Config {
  server: {
    port: number;
    nodeEnv: string;
    logLevel: string;
  };
  database: {
    supabaseUrl: string;
    supabaseKey: string;
    databaseUrl: string;
  };
  redis: {
    url: string;
    password?: string;
    cacheTTL: number;
  };
  rateLimit: {
    similarweb: number;
    builtwith: number;
    yahoo: number;
    apify: number;
    apollo: number;
  };
  costs: {
    similarweb: number;
    builtwith: number;
    yahoo: number;
    apify: number;
    apollo: number;
  };
  bullmq: {
    enrichmentConcurrency: number;
    auditConcurrency: number;
  };
}

function loadConfig(): Config {
  const required = [
    'PORT',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_URL'
  ];

  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    server: {
      port: parseInt(process.env.PORT || '3001', 10),
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info'
    },
    database: {
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      databaseUrl: process.env.DATABASE_URL || ''
    },
    redis: {
      url: process.env.REDIS_URL!,
      password: process.env.REDIS_PASSWORD,
      cacheTTL: parseInt(process.env.CACHE_TTL_DEFAULT || '604800', 10)
    },
    rateLimit: {
      similarweb: parseInt(process.env.RATE_LIMIT_SIMILARWEB || '2', 10),
      builtwith: parseInt(process.env.RATE_LIMIT_BUILTWITH || '5', 10),
      yahoo: parseInt(process.env.RATE_LIMIT_YAHOO || '10', 10),
      apify: parseInt(process.env.RATE_LIMIT_APIFY || '3', 10),
      apollo: parseInt(process.env.RATE_LIMIT_APOLLO || '5', 10)
    },
    costs: {
      similarweb: parseFloat(process.env.COST_SIMILARWEB_PER_CALL || '0.03'),
      builtwith: parseFloat(process.env.COST_BUILTWITH_PER_CALL || '0.02'),
      yahoo: parseFloat(process.env.COST_YAHOO_PER_CALL || '0.01'),
      apify: parseFloat(process.env.COST_APIFY_PER_CALL || '0.05'),
      apollo: parseFloat(process.env.COST_APOLLO_PER_CALL || '0.02')
    },
    bullmq: {
      enrichmentConcurrency: parseInt(process.env.BULLMQ_CONCURRENCY_ENRICHMENT || '5', 10),
      auditConcurrency: parseInt(process.env.BULLMQ_CONCURRENCY_AUDIT || '3', 10)
    }
  };
}

export const config = loadConfig();
