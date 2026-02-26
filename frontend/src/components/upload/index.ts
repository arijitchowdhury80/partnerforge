/**
 * Upload Components Barrel Export
 *
 * Central export point for all CSV upload-related components.
 * These components work together to provide a premium upload experience
 * with glassmorphism styling and Framer Motion animations.
 *
 * Usage:
 * ```tsx
 * import {
 *   CSVUploader,
 *   ColumnMapper,
 *   UploadPreview,
 *   UploadProgress,
 *   UploadList,
 * } from '@/components/upload';
 * ```
 *
 * Upload Flow:
 * 1. CSVUploader - User uploads CSV file
 * 2. ColumnMapper - Auto-detect or manually map columns
 * 3. UploadPreview - Preview first 10 rows
 * 4. UploadProgress - Track enrichment progress
 * 5. UploadList - View history and manage uploads
 */

// =============================================================================
// Core Upload Components
// =============================================================================

/**
 * CSVUploader - Drag & drop CSV upload with glassmorphism styling
 *
 * Features:
 * - react-dropzone for drag & drop file handling
 * - Animated file preview with framer-motion
 * - Source selection (Salesforce, Demandbase, 6sense, Manual)
 * - Upload progress indicator with percentage
 * - Error handling with user-friendly messages
 */
export { CSVUploader } from './CSVUploader';

/**
 * ColumnMapper - Auto-detect and manually map CSV columns
 *
 * Features:
 * - Automatic column detection based on header names
 * - Required vs optional field separation
 * - Sample data preview for each mapped column
 * - Unmapped columns warning
 * - Re-detect button to reset mappings
 */
export { ColumnMapper } from './ColumnMapper';

/**
 * UploadPreview - Preview first 10 rows of uploaded CSV data
 *
 * Features:
 * - Glassmorphic table with sticky header
 * - Status badges (valid/invalid/enriched/pending)
 * - Validation error summary with counts
 * - Row-level click handling for details
 * - Responsive scrollable layout
 */
export { UploadPreview } from './UploadPreview';

/**
 * UploadProgress - Real-time enrichment progress tracking
 *
 * Features:
 * - Animated ring progress with glow effects
 * - TanStack Query polling for status updates
 * - Stats grid (total, processed, success, errors)
 * - Completion state with download button
 * - Failure state with retry option
 * - Estimated time remaining display
 */
export { UploadProgress } from './UploadProgress';

/**
 * UploadList - List all uploaded CSVs with status and actions
 *
 * Features:
 * - Upload history table with sorting
 * - Status badges and progress bars
 * - Actions menu (view, download, retry, delete)
 * - Empty state with upload CTA
 * - Auto-refresh for live status updates
 */
export { UploadList } from './UploadList';
