/**
 * Export Service
 *
 * Handles exporting company data to CSV, JSON, and Excel formats.
 * Supports column selection, custom formatters, and presets.
 */

import type { Company } from '@/types';
import { getStatusFromScore } from '@/lib/constants';

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = 'csv' | 'json' | 'excel';

export interface ExportOptions {
  format: ExportFormat;
  columns: string[];
  filename?: string;
}

export interface ExportColumn {
  key: string;
  label: string;
  formatter?: (value: unknown, company: Company) => string;
}

// =============================================================================
// Column Definitions
// =============================================================================

/**
 * All available export columns with labels and formatters
 */
export const EXPORT_COLUMNS: ExportColumn[] = [
  {
    key: 'company_name',
    label: 'Company Name',
  },
  {
    key: 'domain',
    label: 'Domain',
  },
  {
    key: 'status',
    label: 'Status',
    formatter: (_, company) => {
      const score = company.icp_score ?? 0;
      return getStatusFromScore(score).toUpperCase();
    },
  },
  {
    key: 'icp_score',
    label: 'ICP Score',
    formatter: (value) => String(value ?? ''),
  },
  {
    key: 'revenue',
    label: 'Revenue',
    formatter: (value) => formatCurrency(value as number | undefined),
  },
  {
    key: 'industry',
    label: 'Industry',
  },
  {
    key: 'vertical',
    label: 'Vertical',
  },
  {
    key: 'partner_tech',
    label: 'Partner Technology',
    formatter: (value) => {
      if (Array.isArray(value)) return value.join('; ');
      return String(value ?? '');
    },
  },
  {
    key: 'current_search',
    label: 'Current Search Provider',
  },
  {
    key: 'sw_monthly_visits',
    label: 'Monthly Visits',
    formatter: (value) => formatNumber(value as number | undefined),
  },
  {
    key: 'employee_count',
    label: 'Employee Count',
    formatter: (value) => formatNumber(value as number | undefined),
  },
  {
    key: 'headquarters',
    label: 'Headquarters',
    formatter: (value) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      const hq = value as { city?: string; state?: string; country?: string };
      const parts = [hq.city, hq.state, hq.country].filter(Boolean);
      return parts.join(', ');
    },
  },
  {
    key: 'ticker',
    label: 'Ticker',
  },
  {
    key: 'exchange',
    label: 'Exchange',
  },
  {
    key: 'is_public',
    label: 'Public Company',
    formatter: (value) => (value ? 'Yes' : 'No'),
  },
  {
    key: 'founded_year',
    label: 'Founded Year',
    formatter: (value) => String(value ?? ''),
  },
  {
    key: 'store_count',
    label: 'Store Count',
    formatter: (value) => formatNumber(value as number | undefined),
  },
  {
    key: 'signal_score',
    label: 'Signal Score',
    formatter: (value) => String(value ?? ''),
  },
  {
    key: 'priority_score',
    label: 'Priority Score',
    formatter: (value) => String(value ?? ''),
  },
  {
    key: 'last_enriched',
    label: 'Last Enriched',
    formatter: (value) => {
      if (!value) return '';
      return new Date(value as string).toLocaleDateString();
    },
  },
  {
    key: 'enrichment_level',
    label: 'Enrichment Level',
  },
];

// Create lookup map for quick access
const COLUMN_MAP = new Map(EXPORT_COLUMNS.map((col) => [col.key, col]));

// =============================================================================
// Export Presets
// =============================================================================

/**
 * Pre-defined column sets for common export scenarios
 */
export const EXPORT_PRESETS = {
  salesOutreach: [
    'company_name',
    'domain',
    'status',
    'icp_score',
    'revenue',
    'industry',
    'partner_tech',
  ],
  fullIntel: [
    'company_name',
    'domain',
    'status',
    'icp_score',
    'signal_score',
    'priority_score',
    'revenue',
    'industry',
    'vertical',
    'partner_tech',
    'current_search',
    'sw_monthly_visits',
    'employee_count',
    'headquarters',
    'ticker',
    'exchange',
    'is_public',
    'founded_year',
    'store_count',
    'enrichment_level',
    'last_enriched',
  ],
  crmImport: [
    'company_name',
    'domain',
    'industry',
    'vertical',
    'revenue',
    'employee_count',
    'headquarters',
    'is_public',
    'ticker',
  ],
} as const;

export type ExportPresetKey = keyof typeof EXPORT_PRESETS;

// =============================================================================
// Formatters
// =============================================================================

/**
 * Format a number with thousands separators
 */
function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format currency with abbreviations (K, M, B)
 */
function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return '';

  const absValue = Math.abs(value);
  let formatted: string;

  if (absValue >= 1_000_000_000_000) {
    formatted = `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  } else if (absValue >= 1_000_000_000) {
    formatted = `$${(value / 1_000_000_000).toFixed(0)}B`;
  } else if (absValue >= 1_000_000) {
    formatted = `$${(value / 1_000_000).toFixed(0)}M`;
  } else if (absValue >= 1_000) {
    formatted = `$${(value / 1_000).toFixed(0)}K`;
  } else {
    formatted = `$${value.toFixed(0)}`;
  }

  return formatted;
}

// =============================================================================
// CSV Export
// =============================================================================

/**
 * Escape a value for CSV
 * - Protects against CSV injection (formula injection)
 * - Wraps in quotes if contains comma, quote, or newline
 * - Doubles internal quotes
 *
 * SECURITY: Prevents formula injection (MEDIUM-9)
 * When CSV files are opened in Excel/Sheets, cells starting with
 * =, +, -, @, \t, \r can execute formulas.
 * We prepend a single quote to neutralize these.
 */
function escapeCSVValue(value: string): string {
  if (value === '') return '';

  // SECURITY: CSV injection protection (MEDIUM-9)
  // Dangerous prefixes that Excel/Sheets interpret as formulas
  const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
  let escaped = value;

  // If starts with dangerous character, prepend single quote
  if (DANGEROUS_PREFIXES.some(prefix => escaped.startsWith(prefix))) {
    escaped = "'" + escaped;
  }

  const needsQuoting = /[",\n\r]/.test(escaped);

  if (needsQuoting) {
    // Escape quotes by doubling them
    escaped = escaped.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  return escaped;
}

/**
 * Get the value from a company for a given column key
 */
function getColumnValue(company: Company, columnKey: string): string {
  const column = COLUMN_MAP.get(columnKey);
  if (!column) return '';

  const rawValue = (company as unknown as Record<string, unknown>)[columnKey];

  // Use formatter if available
  if (column.formatter) {
    return column.formatter(rawValue, company);
  }

  // Handle null/undefined
  if (rawValue === null || rawValue === undefined) {
    return '';
  }

  // Handle objects (like headquarters)
  if (typeof rawValue === 'object') {
    return JSON.stringify(rawValue);
  }

  return String(rawValue);
}

/**
 * Export companies to CSV format
 */
export function exportToCSV(companies: Company[], options: ExportOptions): string {
  const { columns } = options;

  // Build header row using column labels
  const headers = columns.map((colKey) => {
    const column = COLUMN_MAP.get(colKey);
    return column?.label ?? colKey;
  });

  const headerRow = headers.join(',');

  // Build data rows
  const dataRows = companies.map((company) => {
    const values = columns.map((colKey) => {
      const value = getColumnValue(company, colKey);
      return escapeCSVValue(value);
    });
    return values.join(',');
  });

  // Combine header and data
  return [headerRow, ...dataRows].join('\n');
}

// =============================================================================
// JSON Export
// =============================================================================

/**
 * Export companies to JSON format
 */
export function exportToJSON(companies: Company[], options: ExportOptions): string {
  const { columns } = options;

  const data = companies.map((company) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((colKey) => {
      const value = getColumnValue(company, colKey);
      obj[colKey] = value;
    });
    return obj;
  });

  return JSON.stringify(data, null, 2);
}

// =============================================================================
// File Generation
// =============================================================================

/**
 * Generate a filename with date stamp
 */
export function generateFilename(
  format: ExportFormat,
  prefix = 'arian-export'
): string {
  // Sanitize prefix - replace invalid characters with dashes, lowercase
  const sanitizedPrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const date = new Date().toISOString().split('T')[0];

  const extension = format === 'excel' ? 'xlsx' : format;

  return `${sanitizedPrefix}-${date}.${extension}`;
}

/**
 * Get MIME type for export format
 */
function getMimeType(format: ExportFormat): string {
  switch (format) {
    case 'csv':
      return 'text/csv';
    case 'json':
      return 'application/json';
    case 'excel':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'text/plain';
  }
}

/**
 * Trigger a file download in the browser
 */
export function downloadExport(
  data: string,
  filename: string,
  mimeType: string
): void {
  // Create blob with BOM for Excel compatibility
  const blob = new Blob([data], { type: `${mimeType};charset=utf-8;` });

  // Create object URL
  const url = URL.createObjectURL(blob);

  // Create hidden anchor element
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  // Trigger download
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// Main Export Function
// =============================================================================

/**
 * Export companies with the given options
 * Returns the generated data string
 */
export function exportCompanies(
  companies: Company[],
  options: ExportOptions
): string {
  switch (options.format) {
    case 'csv':
      return exportToCSV(companies, options);
    case 'json':
      return exportToJSON(companies, options);
    case 'excel':
      // For now, Excel uses CSV format (can be opened in Excel)
      // A full Excel implementation would use a library like xlsx
      return exportToCSV(companies, options);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}

/**
 * Export and download companies
 */
export async function exportAndDownload(
  companies: Company[],
  options: ExportOptions
): Promise<void> {
  const data = exportCompanies(companies, options);
  const filename = options.filename ?? generateFilename(options.format);
  const mimeType = getMimeType(options.format);

  downloadExport(data, filename, mimeType);
}
