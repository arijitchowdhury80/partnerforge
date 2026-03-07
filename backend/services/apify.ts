import { HttpClient } from './http-client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { APIResponse } from '../types';

/**
 * Apify Actor Run Status
 */
type ActorRunStatus = 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';

/**
 * Apify Actor Run Response
 */
interface ActorRun {
  id: string;
  actId: string;
  userId: string;
  startedAt: string;
  finishedAt?: string;
  status: ActorRunStatus;
  defaultDatasetId: string;
  defaultKeyValueStoreId: string;
  buildId: string;
  exitCode?: number;
  meta: {
    origin: string;
    clientIp: string;
    userAgent: string;
  };
  stats: {
    inputBodyLen: number;
    restartCount: number;
    resurrectCount: number;
    memAvgBytes: number;
    memMaxBytes: number;
    memCurrentBytes: number;
    cpuAvgUsage: number;
    cpuMaxUsage: number;
    cpuCurrentUsage: number;
    netRxBytes: number;
    netTxBytes: number;
    durationMillis: number;
    runTimeSecs: number;
    metamorph: number;
    computeUnits: number;
  };
}

/**
 * LinkedIn Company Profile (from apify/linkedin-company-scraper)
 */
export interface LinkedInCompanyProfile {
  companyName: string;
  companyUrl: string;
  followers: number;
  employeeCount: number;
  employeeCountRange?: string;
  headquarters?: string;
  industry?: string;
  description?: string;
  website?: string;
  specialties?: string[];
  posts?: Array<{
    date: string;
    text: string;
    likes: number;
    comments: number;
    shares: number;
    url: string;
  }>;
}

/**
 * LinkedIn Job Posting (from apify/linkedin-jobs-scraper)
 */
export interface LinkedInJob {
  jobId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  employmentType?: string;
  seniorityLevel?: string;
  jobFunction?: string;
  industries?: string[];
  postedDate: string;
  postedDateTimestamp?: number;
  applicationCount?: number;
  repostedJob?: boolean;
  remote?: boolean;
  url: string;
}

/**
 * LinkedIn Profile (from apify/linkedin-profile-scraper)
 */
export interface LinkedInProfile {
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  location?: string;
  photoUrl?: string;
  description?: string;
  url: string;
  followerCount?: number;
  connectionCount?: number;
  mutualConnectionCount?: number;
  company?: string;
  school?: string;
  positions?: Array<{
    title: string;
    company: string;
    companyUrl?: string;
    location?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
  }>;
  skills?: string[];
}

/**
 * Apify Client for LinkedIn Data Scraping
 *
 * Implements 3 actors:
 * 1. apify/linkedin-company-scraper - Company profiles and social engagement
 * 2. apify/linkedin-jobs-scraper - Job postings by company
 * 3. apify/linkedin-profile-scraper - Executive profiles
 *
 * Architecture:
 * - Direct Apify API (not MCP) for production-grade caching and observability
 * - Actor execution model: start run → poll for completion → fetch results
 * - 24hr cache for social data (engagement changes daily)
 * - 7-day cache for profile data (executive data stable)
 *
 * Cost: ~$0.35 per audit
 * - Company scrape: 0.5 compute units = $0.125
 * - Jobs scrape: 0.3 compute units = $0.075
 * - Executive profiles (3-5): 0.6 compute units = $0.15
 */
export class ApifyClient {
  private http: HttpClient;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.APIFY_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('APIFY_API_KEY not set - Apify client will not work');
    }

    // Initialize HTTP client with Apify base URL
    this.http = new HttpClient(
      'https://api.apify.com/v2',
      config.redis.cacheTTL, // Default 7 days
      30000 // 30 second timeout
    );
  }

  /**
   * Scrape LinkedIn company profile
   *
   * Actor: apify/linkedin-company-scraper
   * Cost: 0.5 compute units = $0.125
   * Cache TTL: 24 hours (social engagement changes daily)
   *
   * @param companyUrl - LinkedIn company URL (e.g., "https://www.linkedin.com/company/costco-wholesale/")
   * @returns Company profile with follower count, employee count, recent posts
   *
   * @example
   * ```typescript
   * const profile = await apifyClient.scrapeLinkedInCompany(
   *   'https://www.linkedin.com/company/costco-wholesale/'
   * );
   * console.log(profile.followers); // 2500000
   * console.log(profile.posts.length); // 10 recent posts
   * ```
   */
  async scrapeLinkedInCompany(companyUrl: string): Promise<LinkedInCompanyProfile> {
    logger.info(`Scraping LinkedIn company: ${companyUrl}`);

    try {
      // 1. Start actor run
      const runResponse = await this.startActorRun('apify/linkedin-company-scraper', {
        startUrls: [{ url: companyUrl }],
        maxResults: 1,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      });

      // 2. Poll for completion
      const run = await this.waitForRunCompletion(runResponse.data.data.id);

      // 3. Fetch results from dataset
      const results = await this.fetchDatasetItems<LinkedInCompanyProfile>(
        run.defaultDatasetId
      );

      if (results.length === 0) {
        throw new Error('No company data found - LinkedIn may have blocked the request');
      }

      logger.info(`Company scraped: ${results[0].companyName} (${run.stats.computeUnits} compute units)`);

      return results[0];
    } catch (error) {
      logger.error('LinkedIn company scrape failed', { error, companyUrl });
      throw error;
    }
  }

  /**
   * Scrape LinkedIn job postings for a company
   *
   * Actor: apify/linkedin-jobs-scraper
   * Cost: 0.3 compute units = $0.075 (for ~20 jobs)
   * Cache TTL: 24 hours (job postings change daily)
   *
   * @param companyName - Company name to search for jobs (e.g., "Costco Wholesale")
   * @param maxResults - Maximum number of jobs to scrape (default: 100)
   * @returns Array of job postings
   *
   * @example
   * ```typescript
   * const jobs = await apifyClient.scrapeLinkedInJobs('Costco Wholesale', 50);
   * console.log(jobs.length); // 28 open positions
   * console.log(jobs.filter(j => j.title.includes('Engineer')).length); // 15 engineering roles
   * ```
   */
  async scrapeLinkedInJobs(companyName: string, maxResults: number = 100): Promise<LinkedInJob[]> {
    logger.info(`Scraping LinkedIn jobs for: ${companyName}`);

    try {
      // 1. Start actor run
      const runResponse = await this.startActorRun('apify/linkedin-jobs-scraper', {
        searchQuery: `${companyName} hiring`,
        filters: {
          companyName: companyName
        },
        maxResults: maxResults,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      });

      // 2. Poll for completion
      const run = await this.waitForRunCompletion(runResponse.data.data.id);

      // 3. Fetch results from dataset
      const results = await this.fetchDatasetItems<LinkedInJob>(
        run.defaultDatasetId
      );

      logger.info(`Jobs scraped: ${results.length} positions (${run.stats.computeUnits} compute units)`);

      return results;
    } catch (error) {
      logger.error('LinkedIn jobs scrape failed', { error, companyName });
      throw error;
    }
  }

  /**
   * Scrape LinkedIn executive profiles
   *
   * Actor: apify/linkedin-profile-scraper
   * Cost: 0.2 compute units per profile = $0.05 per profile
   * Cache TTL: 7 days (executive data stable)
   *
   * @param profileUrls - Array of LinkedIn profile URLs to scrape
   * @returns Array of executive profiles
   *
   * @example
   * ```typescript
   * const profiles = await apifyClient.scrapeLinkedInProfiles([
   *   'https://www.linkedin.com/in/ron-vachris/',
   *   'https://www.linkedin.com/in/richard-galanti/'
   * ]);
   * console.log(profiles[0].title); // "CEO at Costco Wholesale"
   * console.log(profiles[0].positions[0].company); // "Costco Wholesale"
   * ```
   */
  async scrapeLinkedInProfiles(profileUrls: string[]): Promise<LinkedInProfile[]> {
    logger.info(`Scraping ${profileUrls.length} LinkedIn profiles`);

    try {
      // 1. Start actor run
      const runResponse = await this.startActorRun('apify/linkedin-profile-scraper', {
        startUrls: profileUrls.map(url => ({ url })),
        maxResults: profileUrls.length,
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ['RESIDENTIAL']
        }
      });

      // 2. Poll for completion
      const run = await this.waitForRunCompletion(runResponse.data.data.id);

      // 3. Fetch results from dataset
      const results = await this.fetchDatasetItems<LinkedInProfile>(
        run.defaultDatasetId
      );

      logger.info(`Profiles scraped: ${results.length} executives (${run.stats.computeUnits} compute units)`);

      return results;
    } catch (error) {
      logger.error('LinkedIn profiles scrape failed', { error, profileUrls });
      throw error;
    }
  }

  /**
   * Start an Apify actor run
   *
   * @private
   * @param actorId - Actor identifier (e.g., "apify/linkedin-company-scraper")
   * @param input - Actor input configuration
   * @returns Actor run response with run ID
   */
  private async startActorRun(actorId: string, input: any): Promise<APIResponse<{ data: ActorRun }>> {
    logger.debug(`Starting actor run: ${actorId}`);

    return this.http.post<{ data: ActorRun }>(
      `/acts/${actorId}/runs`,
      input,
      {
        rateLimitKey: 'apify',
        skipCache: true // Actor runs are never cached (only results)
      }
    );
  }

  /**
   * Poll for actor run completion
   *
   * Uses exponential backoff polling:
   * - Initial wait: 2 seconds
   * - Max wait: 30 seconds
   * - Timeout: 5 minutes
   *
   * @private
   * @param runId - Actor run ID
   * @returns Completed actor run with stats
   */
  private async waitForRunCompletion(runId: string, timeoutMs: number = 300000): Promise<ActorRun> {
    const startTime = Date.now();
    let pollInterval = 2000; // Start with 2 seconds
    const maxPollInterval = 30000; // Max 30 seconds between polls

    logger.debug(`Polling for run completion: ${runId}`);

    while (Date.now() - startTime < timeoutMs) {
      // Check run status
      const statusResponse = await this.http.get<{ data: ActorRun }>(
        `/actor-runs/${runId}`,
        {},
        {
          rateLimitKey: 'apify',
          skipCache: true
        }
      );

      const run = statusResponse.data.data;

      if (run.status === 'SUCCEEDED') {
        logger.info(`Run ${runId} completed in ${run.stats.durationMillis}ms`);
        return run;
      }

      if (run.status === 'FAILED' || run.status === 'ABORTED' || run.status === 'TIMED-OUT') {
        throw new Error(`Actor run ${run.status}: ${run.exitCode || 'unknown error'}`);
      }

      // Still running - wait before next poll
      logger.debug(`Run ${runId} status: ${run.status}, waiting ${pollInterval}ms`);
      await this.sleep(pollInterval);

      // Exponential backoff (double wait time, up to max)
      pollInterval = Math.min(pollInterval * 2, maxPollInterval);
    }

    throw new Error(`Actor run timeout after ${timeoutMs}ms`);
  }

  /**
   * Fetch items from an Apify dataset
   *
   * @private
   * @param datasetId - Dataset ID from actor run
   * @returns Array of dataset items
   */
  private async fetchDatasetItems<T>(datasetId: string): Promise<T[]> {
    logger.debug(`Fetching dataset items: ${datasetId}`);

    const response = await this.http.get<T[]>(
      `/datasets/${datasetId}/items`,
      {
        format: 'json',
        clean: true // Remove Apify internal fields
      },
      {
        rateLimitKey: 'apify',
        cacheTTL: 86400 // 24 hour cache for results
      }
    );

    return response.data;
  }

  /**
   * Sleep utility for polling delays
   *
   * @private
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get actor run details (for debugging/cost tracking)
   *
   * @param runId - Actor run ID
   * @returns Actor run with compute units and timing
   *
   * @example
   * ```typescript
   * const run = await apifyClient.getActorRun('abc123');
   * console.log(`Cost: ${run.stats.computeUnits * 0.25} USD`);
   * console.log(`Duration: ${run.stats.durationMillis}ms`);
   * ```
   */
  async getActorRun(runId: string): Promise<ActorRun> {
    const response = await this.http.get<{ data: ActorRun }>(
      `/actor-runs/${runId}`,
      {},
      {
        rateLimitKey: 'apify',
        cacheTTL: 604800 // 7 days (runs never change)
      }
    );

    return response.data.data;
  }
}
