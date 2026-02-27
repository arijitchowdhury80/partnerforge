/**
 * Export Service Tests
 *
 * TDD: These tests are written FIRST, before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportToCSV,
  exportToJSON,
  generateFilename,
  downloadExport,
  EXPORT_PRESETS,
  EXPORT_COLUMNS,
  type ExportOptions,
  type ExportColumn,
} from '../exportService';
import { createMockCompany } from '@/test/utils';
import type { Company } from '@/types';

// =============================================================================
// exportToCSV Tests
// =============================================================================

describe('exportToCSV', () => {
  const mockCompanies: Company[] = [
    createMockCompany({
      domain: 'walmart.com',
      company_name: 'Walmart',
      icp_score: 95,
      revenue: 648000000000,
      industry: 'Retail',
    }),
    createMockCompany({
      domain: 'target.com',
      company_name: 'Target',
      icp_score: 91,
      revenue: 109000000000,
      industry: 'Retail',
    }),
  ];

  it('generates valid CSV string with header row', () => {
    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'domain', 'icp_score'],
    };

    const csv = exportToCSV(mockCompanies, options);
    const lines = csv.split('\n');

    // First line should be headers
    expect(lines[0]).toBe('Company Name,Domain,ICP Score');
    // Should have data rows
    expect(lines.length).toBe(3); // header + 2 data rows
  });

  it('handles special characters - commas in values', () => {
    const companiesWithCommas = [
      createMockCompany({
        domain: 'example.com',
        company_name: 'Acme, Inc.',
        icp_score: 85,
      }),
    ];

    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'domain'],
    };

    const csv = exportToCSV(companiesWithCommas, options);
    const lines = csv.split('\n');

    // Value with comma should be quoted
    expect(lines[1]).toContain('"Acme, Inc."');
  });

  it('handles special characters - quotes in values', () => {
    const companiesWithQuotes = [
      createMockCompany({
        domain: 'example.com',
        company_name: 'The "Best" Company',
        icp_score: 85,
      }),
    ];

    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'domain'],
    };

    const csv = exportToCSV(companiesWithQuotes, options);
    const lines = csv.split('\n');

    // Quotes should be escaped by doubling
    expect(lines[1]).toContain('"The ""Best"" Company"');
  });

  it('handles special characters - newlines in values', () => {
    const companiesWithNewlines = [
      createMockCompany({
        domain: 'example.com',
        company_name: 'Multi\nLine\nName',
        icp_score: 85,
      }),
    ];

    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'domain'],
    };

    const csv = exportToCSV(companiesWithNewlines, options);

    // Value with newline should be quoted
    expect(csv).toContain('"Multi\nLine\nName"');
  });

  it('respects column selection - only includes specified columns', () => {
    const options: ExportOptions = {
      format: 'csv',
      columns: ['domain', 'icp_score'],
    };

    const csv = exportToCSV(mockCompanies, options);
    const lines = csv.split('\n');

    // Header should only have selected columns
    expect(lines[0]).toBe('Domain,ICP Score');
    // Should not contain company_name
    expect(lines[0]).not.toContain('Company Name');
  });

  it('handles empty data gracefully', () => {
    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'domain'],
    };

    const csv = exportToCSV([], options);
    const lines = csv.split('\n').filter((line) => line.length > 0);

    // Should only have header row
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('Company Name,Domain');
  });

  it('handles null/undefined values gracefully', () => {
    const companiesWithNulls = [
      createMockCompany({
        domain: 'example.com',
        company_name: 'Test Company',
        revenue: undefined,
        ticker: null,
      }),
    ];

    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'revenue', 'ticker'],
    };

    const csv = exportToCSV(companiesWithNulls, options);
    const lines = csv.split('\n');

    // Null/undefined values should be empty strings
    expect(lines[1]).toBe('Test Company,,');
  });

  it('applies custom formatters when provided', () => {
    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'revenue'],
    };

    const csv = exportToCSV(mockCompanies, options);
    const lines = csv.split('\n');

    // Revenue should be formatted as currency (from EXPORT_COLUMNS formatter)
    expect(lines[1]).toContain('$648B');
  });

  it('preserves column order from options', () => {
    const options: ExportOptions = {
      format: 'csv',
      columns: ['icp_score', 'domain', 'company_name'],
    };

    const csv = exportToCSV(mockCompanies, options);
    const lines = csv.split('\n');
    const headers = lines[0].split(',');

    expect(headers[0]).toBe('ICP Score');
    expect(headers[1]).toBe('Domain');
    expect(headers[2]).toBe('Company Name');
  });
});

// =============================================================================
// exportToJSON Tests
// =============================================================================

describe('exportToJSON', () => {
  const mockCompanies: Company[] = [
    createMockCompany({
      domain: 'walmart.com',
      company_name: 'Walmart',
      icp_score: 95,
    }),
  ];

  it('generates valid JSON string', () => {
    const options: ExportOptions = {
      format: 'json',
      columns: ['company_name', 'domain', 'icp_score'],
    };

    const json = exportToJSON(mockCompanies, options);
    const parsed = JSON.parse(json);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
  });

  it('respects column selection', () => {
    const options: ExportOptions = {
      format: 'json',
      columns: ['company_name', 'domain'],
    };

    const json = exportToJSON(mockCompanies, options);
    const parsed = JSON.parse(json);

    expect(parsed[0]).toHaveProperty('company_name');
    expect(parsed[0]).toHaveProperty('domain');
    expect(parsed[0]).not.toHaveProperty('icp_score');
  });

  it('handles empty data gracefully', () => {
    const options: ExportOptions = {
      format: 'json',
      columns: ['company_name'],
    };

    const json = exportToJSON([], options);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual([]);
  });
});

// =============================================================================
// EXPORT_PRESETS Tests
// =============================================================================

describe('EXPORT_PRESETS', () => {
  it('salesOutreach preset contains core sales columns', () => {
    expect(EXPORT_PRESETS.salesOutreach).toContain('company_name');
    expect(EXPORT_PRESETS.salesOutreach).toContain('domain');
    expect(EXPORT_PRESETS.salesOutreach).toContain('status');
    expect(EXPORT_PRESETS.salesOutreach).toContain('icp_score');
    expect(EXPORT_PRESETS.salesOutreach).toContain('revenue');
    expect(EXPORT_PRESETS.salesOutreach).toContain('industry');
    expect(EXPORT_PRESETS.salesOutreach).toContain('partner_tech');
  });

  it('fullIntel preset contains all available columns', () => {
    // Full Intel should have the most columns
    expect(EXPORT_PRESETS.fullIntel.length).toBeGreaterThan(
      EXPORT_PRESETS.salesOutreach.length
    );
    // Should include technical details
    expect(EXPORT_PRESETS.fullIntel).toContain('current_search');
    expect(EXPORT_PRESETS.fullIntel).toContain('sw_monthly_visits');
  });

  it('crmImport preset contains CRM-friendly columns', () => {
    expect(EXPORT_PRESETS.crmImport).toContain('company_name');
    expect(EXPORT_PRESETS.crmImport).toContain('domain');
    expect(EXPORT_PRESETS.crmImport).toContain('industry');
    expect(EXPORT_PRESETS.crmImport).toContain('revenue');
    expect(EXPORT_PRESETS.crmImport).toContain('employee_count');
    expect(EXPORT_PRESETS.crmImport).toContain('headquarters');
  });
});

// =============================================================================
// EXPORT_COLUMNS Tests
// =============================================================================

describe('EXPORT_COLUMNS', () => {
  it('has all expected column definitions', () => {
    const expectedKeys = [
      'company_name',
      'domain',
      'status',
      'icp_score',
      'revenue',
      'industry',
      'partner_tech',
      'headquarters',
    ];

    expectedKeys.forEach((key) => {
      const column = EXPORT_COLUMNS.find((c) => c.key === key);
      expect(column).toBeDefined();
      expect(column?.label).toBeDefined();
    });
  });

  it('each column has a key and label', () => {
    EXPORT_COLUMNS.forEach((column) => {
      expect(column.key).toBeDefined();
      expect(typeof column.key).toBe('string');
      expect(column.label).toBeDefined();
      expect(typeof column.label).toBe('string');
    });
  });
});

// =============================================================================
// generateFilename Tests
// =============================================================================

describe('generateFilename', () => {
  beforeEach(() => {
    // Mock Date to get consistent filename
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-26T10:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates valid filename with date', () => {
    const filename = generateFilename('csv');

    expect(filename).toContain('partnerforge-export');
    expect(filename).toContain('2026-02-26');
    expect(filename).toMatch(/\.csv$/);
  });

  it('uses correct extension for each format', () => {
    expect(generateFilename('csv')).toMatch(/\.csv$/);
    expect(generateFilename('json')).toMatch(/\.json$/);
    expect(generateFilename('excel')).toMatch(/\.xlsx$/);
  });

  it('accepts custom prefix', () => {
    const filename = generateFilename('csv', 'hot-leads');

    expect(filename).toContain('hot-leads');
    expect(filename).not.toContain('partnerforge-export');
  });

  it('sanitizes prefix to be filename-safe', () => {
    const filename = generateFilename('csv', 'My Export/Test');

    // Should not contain invalid characters
    expect(filename).not.toContain('/');
    expect(filename).toContain('my-export-test');
  });
});

// =============================================================================
// downloadExport Tests
// =============================================================================

describe('downloadExport', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;
  let appendChildMock: ReturnType<typeof vi.fn>;
  let removeChildMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn(() => 'blob:test-url');
    revokeObjectURLMock = vi.fn();
    clickMock = vi.fn();
    appendChildMock = vi.fn();
    removeChildMock = vi.fn();

    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickMock,
      style: {},
    } as unknown as HTMLAnchorElement);

    vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock);
    vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates blob with correct MIME type for CSV', () => {
    downloadExport('test,data', 'test.csv', 'text/csv');

    expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8;');
  });

  it('creates blob with correct MIME type for JSON', () => {
    downloadExport('{"test": true}', 'test.json', 'application/json');

    expect(createObjectURLMock).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json;charset=utf-8;');
  });

  it('triggers download by clicking anchor element', () => {
    downloadExport('test,data', 'test.csv', 'text/csv');

    expect(appendChildMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
  });

  it('cleans up after download', () => {
    downloadExport('test,data', 'test.csv', 'text/csv');

    expect(removeChildMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:test-url');
  });

  it('sets correct filename on anchor element', () => {
    const mockAnchor = {
      href: '',
      download: '',
      click: clickMock,
      style: {},
    } as unknown as HTMLAnchorElement;

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor);

    downloadExport('test,data', 'my-export.csv', 'text/csv');

    expect(mockAnchor.download).toBe('my-export.csv');
  });
});

// =============================================================================
// Large Export Performance Tests
// =============================================================================

describe('exportToCSV performance', () => {
  it('handles large exports (1000 companies) efficiently', () => {
    const largeCompanyList = Array.from({ length: 1000 }, (_, i) =>
      createMockCompany({
        domain: `company${i}.com`,
        company_name: `Company ${i}`,
        icp_score: Math.floor(Math.random() * 100),
      })
    );

    const options: ExportOptions = {
      format: 'csv',
      columns: ['company_name', 'domain', 'icp_score', 'revenue', 'industry'],
    };

    const start = performance.now();
    const csv = exportToCSV(largeCompanyList, options);
    const duration = performance.now() - start;

    // Should complete in under 1 second
    expect(duration).toBeLessThan(1000);
    // Should have all rows
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines.length).toBe(1001); // header + 1000 rows
  });
});
