/**
 * CSV Upload Type Definitions
 *
 * Types for the CSV upload flow including:
 * - Uploaded lists and items
 * - Column mapping
 * - Upload status tracking
 * - Validation results
 * - Enrichment job management
 */

// =============================================================================
// Status Types
// =============================================================================

/**
 * Status of an uploaded list.
 * Follows the upload → parse → validate → queue → process → complete lifecycle.
 */
export type UploadStatus =
  | 'uploaded'     // File uploaded, not yet parsed
  | 'parsing'      // CSV is being parsed
  | 'parsed'       // CSV parsed successfully
  | 'validating'   // Rows are being validated
  | 'validated'    // Validation complete
  | 'queued'       // Queued for enrichment
  | 'processing'   // Enrichment in progress
  | 'completed'    // Enrichment complete
  | 'failed';      // Processing failed

/**
 * Status of an individual list item (row).
 */
export type ListItemStatus =
  | 'pending'      // Not yet processed
  | 'validating'   // Being validated
  | 'valid'        // Validation passed
  | 'invalid'      // Validation failed
  | 'queued'       // Queued for enrichment
  | 'enriching'    // Enrichment in progress
  | 'enriched'     // Enrichment complete
  | 'failed';      // Enrichment failed

// =============================================================================
// Column Mapping Types
// =============================================================================

/**
 * Mapping of PartnerForge fields to CSV column headers.
 * Each field maps to the original CSV column name.
 */
export interface ColumnMapping {
  /** Website domain (REQUIRED) - primary key for enrichment */
  domain?: string;
  /** Company display name */
  company_name?: string;
  /** Salesforce 18-digit Account ID for CRM sync */
  salesforce_id?: string;
  /** Demandbase/ABM platform ID */
  demandbase_id?: string;
  /** Pre-existing annual revenue data */
  revenue?: string;
  /** Pre-existing monthly traffic data */
  traffic?: string;
  /** Industry or vertical */
  industry?: string;
  /** Account owner / sales rep name */
  owner?: string;
  /** Sales region / territory */
  region?: string;
  /** ABM journey stage (Awareness, Engagement, etc.) */
  journey_stage?: string;
  /** Pre-existing engagement/intent score */
  engagement_score?: string;
}

/**
 * Field configuration for the column mapper UI.
 */
export interface FieldConfig {
  key: keyof ColumnMapping;
  label: string;
  description: string;
  required: boolean;
  icon: string;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation error for a specific field.
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Human-readable error message */
  error: string;
}

/**
 * Result of validating an uploaded list.
 */
export interface ValidationResult {
  list_id: string;
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  status: 'validated' | 'validating';
}

// =============================================================================
// List Types
// =============================================================================

/**
 * Uploaded list metadata.
 * Represents a CSV file that has been uploaded for processing.
 */
export interface UploadedList {
  id: string;
  user_id?: string;
  team_id?: string;
  name: string;
  description?: string;
  source: 'salesforce' | 'demandbase' | '6sense' | 'manual';
  original_filename: string;
  file_size_bytes: number;

  // Row counts
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;

  // Column mapping
  column_mapping: ColumnMapping;

  // Status
  status: UploadStatus;

  // Progress tracking
  processed_count: number;
  success_count: number;
  error_count: number;

  // Timestamps
  created_at: string;
  parsing_started_at?: string;
  parsing_completed_at?: string;
  enrichment_started_at?: string;
  enrichment_completed_at?: string;

  // Error handling
  error_message?: string;
}

/**
 * Individual row from an uploaded CSV.
 */
export interface UploadedListItem {
  id: string;
  list_id: string;
  row_number: number;

  // Core data (parsed from CSV)
  domain: string;
  company_name?: string;

  // External IDs (for CRM sync)
  salesforce_id?: string;
  demandbase_id?: string;

  // Original CSV data (all columns preserved)
  csv_data: Record<string, unknown>;

  // Status
  status: ListItemStatus;

  // Validation
  validation_errors?: ValidationError[];

  // Enrichment
  enrichment_job_id?: string;
  displacement_target_id?: number;

  // Timestamps
  created_at: string;
  validated_at?: string;
  enrichment_started_at?: string;
  enrichment_completed_at?: string;

  // Error handling
  error_message?: string;
  retry_count: number;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Response from uploading a CSV file.
 */
export interface UploadResponse {
  id: string;
  name: string;
  total_rows: number;
  column_mapping: ColumnMapping;
  detected_columns: string[];
  status: UploadStatus;
  requires_mapping_confirmation: boolean;
}

/**
 * Response from starting enrichment.
 */
export interface EnrichmentJobResponse {
  job_id: string;
  list_id: string;
  total_items: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  estimated_time_seconds: number;
}

/**
 * Status response for a list (used for polling).
 */
export interface ListStatusResponse {
  id: string;
  name: string;
  status: UploadStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  processed_count: number;
  success_count: number;
  error_count: number;
  progress_percent: number;
  created_at: string;
  enrichment_started_at?: string;
  enrichment_completed_at?: string;
  estimated_remaining_seconds?: number;
}

// =============================================================================
// Upload Component Props Types
// =============================================================================

/**
 * Props for CSVUploader component.
 */
export interface CSVUploaderProps {
  onUploadComplete: (listId: string, response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Props for ColumnMapper component.
 */
export interface ColumnMapperProps {
  listId: string;
  detectedMapping: ColumnMapping;
  csvHeaders: string[];
  sampleData?: Record<string, unknown>[];
  onConfirm: (mapping: ColumnMapping) => void;
  onBack?: () => void;
}

/**
 * Props for UploadPreview component.
 */
export interface UploadPreviewProps {
  items: UploadedListItem[];
  columnMapping: ColumnMapping;
  totalRows: number;
  onRowClick?: (item: UploadedListItem) => void;
}

/**
 * Props for UploadProgress component.
 */
export interface UploadProgressProps {
  listId: string;
  onComplete?: (listId: string) => void;
  onDownload?: (listId: string) => void;
  onViewResults?: (listId: string) => void;
}

/**
 * Props for UploadList component.
 */
export interface UploadListProps {
  onSelect: (list: UploadedList) => void;
  onNewUpload: () => void;
  onDelete?: (listId: string) => void;
  onDownload?: (listId: string) => void;
  onRetry?: (listId: string) => void;
}

// =============================================================================
// Upload State Types
// =============================================================================

/**
 * State for the multi-step upload wizard.
 */
export interface UploadWizardState {
  listId: string | null;
  name: string;
  totalRows: number;
  columnMapping: ColumnMapping;
  detectedColumns: string[];
  requiresMapping: boolean;
}

/**
 * Steps in the upload wizard.
 */
export type UploadStep =
  | 'upload'
  | 'mapping'
  | 'preview'
  | 'enrichment'
  | 'complete';
