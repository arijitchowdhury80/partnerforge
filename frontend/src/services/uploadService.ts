/**
 * Upload Service
 *
 * Handles the complete upload flow:
 * 1. Parse CSV/Excel file in browser
 * 2. Validate and deduplicate rows
 * 3. Insert to Supabase database
 * 4. Return upload results
 *
 * Security:
 * - Files are parsed in memory and never stored
 * - All parsing happens client-side
 * - Data is validated before insertion
 */

import {
  parseFile,
  getValidRows,
  deduplicateByDomain,
  type ParseResult,
  type ParsedRow,
} from './fileParser';

// =============================================================================
// Types
// =============================================================================

export interface UploadProgress {
  stage: 'parsing' | 'validating' | 'inserting' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

export interface UploadResult {
  success: boolean;
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  duplicateRows: number;
  errorRows: number;
  errors: Array<{ row: number; message: string }>;
  warnings: string[];
  listId: string;
}

export interface UploadOptions {
  partnerTech: string;
  listName: string;
  source: 'salesforce' | 'demandbase' | '6sense' | 'manual';
  onProgress?: (progress: UploadProgress) => void;
  skipDuplicates?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// Insert in batches to avoid timeouts
const BATCH_SIZE = 100;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique list ID
 */
function generateListId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `list_${timestamp}_${random}`;
}

/**
 * Check if a domain already exists in the database
 */
async function checkExistingDomains(domains: string[]): Promise<Set<string>> {
  if (domains.length === 0) return new Set();

  // Query in batches to avoid URL length limits
  const existing = new Set<string>();
  const batchSize = 50;

  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    const domainFilter = batch.map((d) => `"${d}"`).join(',');

    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/displacement_targets?domain=in.(${domainFilter})&select=domain`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        for (const row of data) {
          existing.add(row.domain.toLowerCase());
        }
      }
    } catch (err) {
      console.error('Error checking existing domains:', err);
    }
  }

  return existing;
}

/**
 * Insert rows to Supabase in batches
 */
async function insertBatch(
  rows: Array<Record<string, unknown>>,
  onProgress?: (inserted: number) => void
): Promise<{ inserted: number; errors: Array<{ row: number; message: string }> }> {
  const errors: Array<{ row: number; message: string }> = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/displacement_targets`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal,resolution=merge-duplicates',
        },
        body: JSON.stringify(batch),
      });

      if (response.ok) {
        inserted += batch.length;
        onProgress?.(inserted);
      } else {
        const errorText = await response.text();
        console.error('Insert batch error:', errorText);

        // Try inserting one by one to identify problematic rows
        for (let j = 0; j < batch.length; j++) {
          try {
            const singleResponse = await fetch(
              `${SUPABASE_URL}/rest/v1/displacement_targets`,
              {
                method: 'POST',
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json',
                  Prefer: 'return=minimal,resolution=merge-duplicates',
                },
                body: JSON.stringify(batch[j]),
              }
            );

            if (singleResponse.ok) {
              inserted++;
              onProgress?.(inserted);
            } else {
              errors.push({
                row: i + j + 1,
                message: await singleResponse.text(),
              });
            }
          } catch (err) {
            errors.push({
              row: i + j + 1,
              message: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      }
    } catch (err) {
      console.error('Insert batch exception:', err);
      for (let j = 0; j < batch.length; j++) {
        errors.push({
          row: i + j + 1,
          message: err instanceof Error ? err.message : 'Network error',
        });
      }
    }
  }

  return { inserted, errors };
}

// =============================================================================
// Main Upload Function
// =============================================================================

/**
 * Upload a file to PartnerForge
 *
 * @param file - The file to upload (CSV or Excel)
 * @param options - Upload options including partner tech and callbacks
 * @returns Upload result with counts and any errors
 */
export async function uploadFile(
  file: File,
  options: UploadOptions
): Promise<UploadResult> {
  const { partnerTech, listName, source, onProgress, skipDuplicates = true } = options;
  const listId = generateListId();
  const warnings: string[] = [];

  // Stage 1: Parse file
  onProgress?.({
    stage: 'parsing',
    current: 0,
    total: 100,
    message: 'Parsing file...',
  });

  const parseResult: ParseResult = await parseFile(file);

  if (!parseResult.success && parseResult.errors.length > 0) {
    return {
      success: false,
      totalRows: 0,
      insertedRows: 0,
      skippedRows: 0,
      duplicateRows: 0,
      errorRows: parseResult.errors.length,
      errors: parseResult.errors.map((e) => ({ row: e.row, message: e.message })),
      warnings: parseResult.warnings,
      listId,
    };
  }

  onProgress?.({
    stage: 'parsing',
    current: 100,
    total: 100,
    message: `Parsed ${parseResult.totalRows} rows`,
  });

  // Add parse warnings
  warnings.push(...parseResult.warnings);

  // Stage 2: Validate and filter
  onProgress?.({
    stage: 'validating',
    current: 0,
    total: 100,
    message: 'Validating data...',
  });

  // Get valid rows (with valid domains)
  const validRows = getValidRows(parseResult);

  // Deduplicate within the file
  const { unique: dedupedRows, duplicates: inFileDuplicates } =
    deduplicateByDomain(validRows);

  if (inFileDuplicates > 0) {
    warnings.push(
      `${inFileDuplicates} duplicate domain${inFileDuplicates > 1 ? 's' : ''} found within file and removed.`
    );
  }

  onProgress?.({
    stage: 'validating',
    current: 50,
    total: 100,
    message: 'Checking for existing records...',
  });

  // Check for existing domains in database
  let existingDomains = new Set<string>();
  let skippedDuplicates = 0;

  if (skipDuplicates) {
    const domains = dedupedRows
      .map((r) => r.domain)
      .filter((d): d is string => !!d);
    existingDomains = await checkExistingDomains(domains);
    skippedDuplicates = existingDomains.size;

    if (skippedDuplicates > 0) {
      warnings.push(
        `${skippedDuplicates} domain${skippedDuplicates > 1 ? 's' : ''} already exist${skippedDuplicates === 1 ? 's' : ''} in database and will be skipped.`
      );
    }
  }

  onProgress?.({
    stage: 'validating',
    current: 100,
    total: 100,
    message: `${dedupedRows.length - skippedDuplicates} rows ready to insert`,
  });

  // Stage 3: Insert to database
  const rowsToInsert = dedupedRows.filter(
    (r) => r.domain && !existingDomains.has(r.domain.toLowerCase())
  );

  if (rowsToInsert.length === 0) {
    return {
      success: true,
      totalRows: parseResult.totalRows,
      insertedRows: 0,
      skippedRows: skippedDuplicates,
      duplicateRows: inFileDuplicates,
      errorRows: parseResult.invalidRows,
      errors: [],
      warnings,
      listId,
    };
  }

  onProgress?.({
    stage: 'inserting',
    current: 0,
    total: rowsToInsert.length,
    message: `Inserting ${rowsToInsert.length} rows...`,
  });

  // Prepare rows for insertion
  const preparedRows = rowsToInsert.map((row) => ({
    domain: row.domain,
    company_name: row.company_name || null,
    partner_tech: partnerTech || row.partner_tech || null,
    vertical: row.vertical || null,
    country: row.country || null,
    city: row.city || null,
    state: row.state || null,
    icp_score: 50, // Default score for new uploads (warm)
    enrichment_level: 'basic',
    // Store original data as metadata
    upload_source: source,
    upload_list_id: listId,
    upload_list_name: listName,
  }));

  // Insert in batches
  const insertResult = await insertBatch(preparedRows, (inserted) => {
    onProgress?.({
      stage: 'inserting',
      current: inserted,
      total: rowsToInsert.length,
      message: `Inserted ${inserted} of ${rowsToInsert.length} rows`,
    });
  });

  // Stage 4: Complete
  onProgress?.({
    stage: 'complete',
    current: insertResult.inserted,
    total: rowsToInsert.length,
    message: `Upload complete: ${insertResult.inserted} rows inserted`,
  });

  return {
    success: insertResult.inserted > 0,
    totalRows: parseResult.totalRows,
    insertedRows: insertResult.inserted,
    skippedRows: skippedDuplicates,
    duplicateRows: inFileDuplicates,
    errorRows: parseResult.invalidRows + insertResult.errors.length,
    errors: [
      ...parseResult.errors.map((e) => ({ row: e.row, message: e.message })),
      ...insertResult.errors,
    ],
    warnings,
    listId,
  };
}

/**
 * Preview file contents without inserting
 */
export async function previewFile(file: File): Promise<{
  success: boolean;
  parseResult: ParseResult;
  validCount: number;
  duplicateCount: number;
  sampleRows: ParsedRow[];
}> {
  const parseResult = await parseFile(file);
  const validRows = getValidRows(parseResult);
  const { unique, duplicates } = deduplicateByDomain(validRows);

  return {
    success: parseResult.success,
    parseResult,
    validCount: unique.length,
    duplicateCount: duplicates,
    sampleRows: unique.slice(0, 10), // First 10 rows as preview
  };
}
