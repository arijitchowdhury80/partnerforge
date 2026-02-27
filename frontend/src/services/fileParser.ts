/**
 * File Parser Service
 *
 * Parses CSV and Excel files in the browser.
 * Files are processed in memory and never stored.
 *
 * Security:
 * - All parsing happens client-side
 * - Files never leave the browser until validated
 * - Original files are discarded after parsing
 */

import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

// =============================================================================
// Types
// =============================================================================

export interface ParsedRow {
  domain?: string;
  company_name?: string;
  partner_tech?: string;
  vertical?: string;
  country?: string;
  city?: string;
  state?: string;
  revenue?: number;
  traffic?: number;
  [key: string]: unknown;
}

export interface ParseResult {
  success: boolean;
  rows: ParsedRow[];
  headers: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ParseError[];
  warnings: string[];
}

export interface ParseError {
  row: number;
  field: string;
  message: string;
}

export interface ParseOptions {
  maxRows?: number;
  validateDomain?: boolean;
  requiredFields?: string[];
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_ROWS = 10000;

// Common domain column names (case-insensitive)
const DOMAIN_COLUMN_NAMES = [
  'domain',
  'website',
  'url',
  'site',
  'web',
  'company_domain',
  'company_website',
  'website_url',
  'domain_name',
];

// Common company name column names (case-insensitive)
const COMPANY_COLUMN_NAMES = [
  'company',
  'company_name',
  'companyname',
  'name',
  'account',
  'account_name',
  'accountname',
  'organization',
  'org',
];

// Common partner tech column names
const PARTNER_TECH_COLUMN_NAMES = [
  'partner',
  'partner_tech',
  'technology',
  'tech',
  'platform',
  'cms',
  'ecommerce_platform',
];

// =============================================================================
// Domain Validation
// =============================================================================

/**
 * Extract domain from a URL or domain string
 */
function extractDomain(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  let domain = input.trim().toLowerCase();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, '');

  // Remove www.
  domain = domain.replace(/^www\./, '');

  // Remove path and query string
  domain = domain.split('/')[0].split('?')[0].split('#')[0];

  // Basic domain validation
  if (!domain || !domain.includes('.')) return null;
  if (domain.length < 4) return null; // a.co minimum

  // Remove invalid characters
  if (!/^[a-z0-9.-]+$/.test(domain)) return null;

  return domain;
}

/**
 * Validate a domain string
 */
function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  const extracted = extractDomain(domain);
  return extracted !== null && extracted.length >= 4;
}

// =============================================================================
// Column Mapping
// =============================================================================

/**
 * Auto-detect column mapping from headers
 */
function autoDetectColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());

  // Find domain column
  for (const name of DOMAIN_COLUMN_NAMES) {
    const idx = lowerHeaders.indexOf(name);
    if (idx !== -1) {
      mapping.domain = headers[idx];
      break;
    }
  }

  // Find company name column
  for (const name of COMPANY_COLUMN_NAMES) {
    const idx = lowerHeaders.indexOf(name);
    if (idx !== -1) {
      mapping.company_name = headers[idx];
      break;
    }
  }

  // Find partner tech column
  for (const name of PARTNER_TECH_COLUMN_NAMES) {
    const idx = lowerHeaders.indexOf(name);
    if (idx !== -1) {
      mapping.partner_tech = headers[idx];
      break;
    }
  }

  return mapping;
}

// =============================================================================
// CSV Parsing
// =============================================================================

/**
 * Parse a CSV file
 */
async function parseCSV(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  return new Promise((resolve) => {
    const maxRows = options.maxRows || DEFAULT_MAX_ROWS;
    const errors: ParseError[] = [];
    const warnings: string[] = [];
    const rows: ParsedRow[] = [];
    let headers: string[] = [];
    let rowCount = 0;
    let validCount = 0;
    let invalidCount = 0;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      step: (result, parser) => {
        rowCount++;

        // Check row limit
        if (rowCount > maxRows) {
          warnings.push(`File has more than ${maxRows} rows. Only first ${maxRows} rows were processed.`);
          parser.abort();
          return;
        }

        // Get headers from first row
        if (headers.length === 0 && result.meta.fields) {
          headers = result.meta.fields;
        }

        const data = result.data as Record<string, unknown>;
        const mapping = autoDetectColumns(headers);

        // Extract domain
        let domain: string | undefined;
        if (mapping.domain) {
          const rawDomain = data[mapping.domain] as string;
          const extracted = extractDomain(rawDomain);
          if (extracted) {
            domain = extracted;
            validCount++;
          } else {
            invalidCount++;
            errors.push({
              row: rowCount,
              field: 'domain',
              message: `Invalid domain: "${rawDomain}"`,
            });
          }
        }

        // Build parsed row
        const parsedRow: ParsedRow = {
          domain,
          company_name: mapping.company_name
            ? (data[mapping.company_name] as string)?.trim()
            : undefined,
          partner_tech: mapping.partner_tech
            ? (data[mapping.partner_tech] as string)?.trim()
            : undefined,
        };

        // Copy all original columns
        for (const [key, value] of Object.entries(data)) {
          if (!(key in parsedRow)) {
            parsedRow[key] = typeof value === 'string' ? value.trim() : value;
          }
        }

        rows.push(parsedRow);
      },
      complete: () => {
        // Warn if no domain column found
        const mapping = autoDetectColumns(headers);
        if (!mapping.domain) {
          warnings.push(
            'No domain column detected. Please ensure your file has a column named "domain", "website", or "url".'
          );
        }

        resolve({
          success: errors.length === 0 || validCount > 0,
          rows,
          headers,
          totalRows: rowCount,
          validRows: validCount,
          invalidRows: invalidCount,
          errors,
          warnings,
        });
      },
      error: (error) => {
        resolve({
          success: false,
          rows: [],
          headers: [],
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          errors: [{ row: 0, field: 'file', message: error.message }],
          warnings: [],
        });
      },
    });
  });
}

// =============================================================================
// Excel Parsing
// =============================================================================

/**
 * Parse an Excel file (.xlsx or .xls)
 */
async function parseExcel(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  const maxRows = options.maxRows || DEFAULT_MAX_ROWS;
  const errors: ParseError[] = [];
  const warnings: string[] = [];
  const rows: ParsedRow[] = [];

  try {
    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return {
        success: false,
        rows: [],
        headers: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [{ row: 0, field: 'file', message: 'No sheets found in Excel file' }],
        warnings: [],
      };
    }

    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    // Get headers
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    const mapping = autoDetectColumns(headers);

    // Warn if no domain column found
    if (!mapping.domain) {
      warnings.push(
        'No domain column detected. Please ensure your file has a column named "domain", "website", or "url".'
      );
    }

    let validCount = 0;
    let invalidCount = 0;

    // Process rows
    for (let i = 0; i < jsonData.length; i++) {
      if (i >= maxRows) {
        warnings.push(`File has more than ${maxRows} rows. Only first ${maxRows} rows were processed.`);
        break;
      }

      const data = jsonData[i];

      // Extract domain
      let domain: string | undefined;
      if (mapping.domain) {
        const rawDomain = data[mapping.domain] as string;
        const extracted = extractDomain(rawDomain);
        if (extracted) {
          domain = extracted;
          validCount++;
        } else if (rawDomain && rawDomain.toString().trim()) {
          invalidCount++;
          errors.push({
            row: i + 2, // +2 for header row and 1-indexed
            field: 'domain',
            message: `Invalid domain: "${rawDomain}"`,
          });
        }
      }

      // Build parsed row
      const parsedRow: ParsedRow = {
        domain,
        company_name: mapping.company_name
          ? String(data[mapping.company_name] || '').trim()
          : undefined,
        partner_tech: mapping.partner_tech
          ? String(data[mapping.partner_tech] || '').trim()
          : undefined,
      };

      // Copy all original columns
      for (const [key, value] of Object.entries(data)) {
        if (!(key in parsedRow)) {
          parsedRow[key] = typeof value === 'string' ? value.trim() : value;
        }
      }

      rows.push(parsedRow);
    }

    return {
      success: errors.length === 0 || validCount > 0,
      rows,
      headers,
      totalRows: jsonData.length,
      validRows: validCount,
      invalidRows: invalidCount,
      errors,
      warnings,
    };
  } catch (error) {
    return {
      success: false,
      rows: [],
      headers: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: [
        {
          row: 0,
          field: 'file',
          message: error instanceof Error ? error.message : 'Failed to parse Excel file',
        },
      ],
      warnings: [],
    };
  }
}

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parse a file (CSV or Excel) and return structured data
 *
 * @param file - The file to parse (File object from input/dropzone)
 * @param options - Parsing options
 * @returns ParseResult with rows, errors, and metadata
 */
export async function parseFile(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return parseCSV(file, options);
    case 'xlsx':
    case 'xls':
      return parseExcel(file, options);
    default:
      return {
        success: false,
        rows: [],
        headers: [],
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: [
          {
            row: 0,
            field: 'file',
            message: `Unsupported file type: .${extension}. Please use CSV or Excel (.xlsx, .xls)`,
          },
        ],
        warnings: [],
      };
  }
}

/**
 * Get valid rows only (rows with a valid domain)
 */
export function getValidRows(result: ParseResult): ParsedRow[] {
  return result.rows.filter((row) => row.domain && isValidDomain(row.domain));
}

/**
 * Deduplicate rows by domain
 */
export function deduplicateByDomain(rows: ParsedRow[]): {
  unique: ParsedRow[];
  duplicates: number;
} {
  const seen = new Set<string>();
  const unique: ParsedRow[] = [];
  let duplicates = 0;

  for (const row of rows) {
    if (row.domain) {
      const domain = row.domain.toLowerCase();
      if (seen.has(domain)) {
        duplicates++;
      } else {
        seen.add(domain);
        unique.push(row);
      }
    }
  }

  return { unique, duplicates };
}
