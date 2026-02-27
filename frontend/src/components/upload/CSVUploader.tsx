/**
 * CSVUploader Component
 *
 * Premium drag & drop CSV/Excel upload with glassmorphism design.
 * Uses react-dropzone for file handling.
 *
 * Security:
 * - Files are parsed in memory and discarded (never stored)
 * - Max file size: 10MB
 * - Allowed types: CSV (.csv), Excel (.xlsx, .xls)
 * - Max rows: 10,000
 */

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconUpload,
  IconFileCheck,
  IconAlertCircle,
  IconX,
  IconCloudUpload,
  IconFileSpreadsheet,
  IconCheck,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { TextInput, Select, Button, Progress, Text, Group, Badge, Stack, Alert } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { uploadFile, previewFile, type UploadProgress, type UploadResult } from '@/services/uploadService';
import type { UploadResponse } from '@/types';

interface CSVUploaderProps {
  onUploadComplete: (listId: string, response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

// Security: 10MB max to prevent system overload (~50,000 rows max)
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_ROWS = 10000;

// Allowed MIME types
const ACCEPTED_FILE_TYPES = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

// Partner tech options
const PARTNER_TECH_OPTIONS = [
  { value: '', label: 'Auto-detect from file' },
  { value: 'Adobe Experience Manager', label: 'Adobe Experience Manager' },
  { value: 'Adobe Commerce', label: 'Adobe Commerce (Magento)' },
  { value: 'Amplience', label: 'Amplience' },
  { value: 'Spryker', label: 'Spryker' },
  { value: 'Shopify', label: 'Shopify' },
  { value: 'commercetools', label: 'commercetools' },
  { value: 'BigCommerce', label: 'BigCommerce' },
  { value: 'Salesforce Commerce Cloud', label: 'Salesforce Commerce Cloud' },
  { value: 'Lucidworks', label: 'Lucidworks' },
  { value: 'Other', label: 'Other' },
];

// Helper to get file extension
const getFileExtension = (filename: string): string => {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

// Helper to check if file type is valid
const isValidFileType = (file: File): boolean => {
  const ext = getFileExtension(file.name);
  return ['csv', 'xls', 'xlsx'].includes(ext);
};

export function CSVUploader({ onUploadComplete, onError }: CSVUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [listName, setListName] = useState('');
  const [partnerTech, setPartnerTech] = useState('');
  const [source, setSource] = useState<string>('manual');
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    validCount: number;
    duplicateCount: number;
    totalRows: number;
  } | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    setResult(null);
    setPreviewData(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB (~${MAX_ROWS.toLocaleString()} rows).`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls).');
      } else {
        setError('File rejected. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];

      // Additional validation for file type
      if (!isValidFileType(selectedFile)) {
        setError('Invalid file type. Please upload a CSV or Excel file (.csv, .xlsx, .xls).');
        return;
      }

      setFile(selectedFile);
      const nameWithoutExt = selectedFile.name.replace(/\.(csv|xlsx|xls)$/i, '');
      setListName(nameWithoutExt);

      // Preview the file
      setIsPreviewing(true);
      try {
        const preview = await previewFile(selectedFile);
        setPreviewData({
          validCount: preview.validCount,
          duplicateCount: preview.duplicateCount,
          totalRows: preview.parseResult.totalRows,
        });

        if (preview.parseResult.warnings.length > 0) {
          notifications.show({
            title: 'File Preview',
            message: preview.parseResult.warnings[0],
            color: 'yellow',
          });
        }
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        setIsPreviewing(false);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } =
    useDropzone({
      onDrop,
      accept: ACCEPTED_FILE_TYPES,
      maxFiles: 1,
      maxSize: MAX_FILE_SIZE_BYTES,
    });

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(null);
    setError(null);
    setResult(null);

    try {
      const uploadResult = await uploadFile(file, {
        partnerTech,
        listName,
        source: source as 'salesforce' | 'demandbase' | '6sense' | 'manual',
        onProgress: setProgress,
      });

      setResult(uploadResult);

      if (uploadResult.success) {
        notifications.show({
          title: 'Upload Successful',
          message: `${uploadResult.insertedRows} companies added to database`,
          color: 'green',
        });

        // Create a response compatible with the existing interface
        const response: UploadResponse = {
          id: uploadResult.listId,
          name: listName,
          total_rows: uploadResult.totalRows,
          column_mapping: {},
          detected_columns: [],
          status: 'completed',
          requires_mapping_confirmation: false,
        };

        onUploadComplete(uploadResult.listId, response);
      } else {
        setError(`Upload failed: ${uploadResult.errors[0]?.message || 'Unknown error'}`);
        onError?.(new Error(uploadResult.errors[0]?.message || 'Upload failed'));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setListName('');
    setError(null);
    setProgress(null);
    setResult(null);
    setPreviewData(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getProgressPercent = (): number => {
    if (!progress) return 0;
    if (progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div
          {...getRootProps()}
          className={`
            relative overflow-hidden rounded-2xl border-2 border-dashed p-12
            text-center cursor-pointer transition-all duration-300
            backdrop-blur-xl
            ${isDragActive && isDragAccept
              ? 'border-green-500 bg-green-500/10 scale-[1.02]'
              : isDragReject
              ? 'border-red-500 bg-red-500/10'
              : file
              ? 'border-blue-500/50 bg-blue-500/5'
              : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'}
          `}
        >
          <input {...getInputProps()} />

          {/* Animated background gradient */}
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: isDragActive
                ? 'radial-gradient(circle at center, rgba(84, 104, 255, 0.2) 0%, transparent 70%)'
                : 'none',
            }}
          />

          <AnimatePresence mode="wait">
            {!file ? (
              <motion.div
                key="dropzone"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative z-10"
              >
                <motion.div
                  animate={{
                    y: isDragActive ? -5 : 0,
                    scale: isDragActive ? 1.1 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <IconCloudUpload
                    size={64}
                    className={`mx-auto mb-4 ${
                      isDragActive ? 'text-blue-400' : 'text-white/40'
                    }`}
                    stroke={1.5}
                  />
                </motion.div>

                {isDragActive ? (
                  <Text size="lg" fw={500} c="white">
                    Drop your file here...
                  </Text>
                ) : (
                  <>
                    <Text size="lg" fw={500} c="white" mb="xs">
                      Drag & drop your CSV or Excel file here
                    </Text>
                    <Text size="sm" c="dimmed">
                      or click to browse (max {MAX_FILE_SIZE_MB}MB, {MAX_ROWS.toLocaleString()} rows)
                    </Text>
                    <Text size="xs" c="dimmed" mt="md">
                      Supported formats: .csv, .xlsx, .xls
                    </Text>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="file-preview"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative z-10"
              >
                <div className="flex items-center justify-center gap-4">
                  <div className="p-3 rounded-xl bg-green-500/20 border border-green-500/30">
                    {getFileExtension(file.name) === 'csv' ? (
                      <IconFileCheck size={32} className="text-green-400" />
                    ) : (
                      <IconFileSpreadsheet size={32} className="text-green-400" />
                    )}
                  </div>
                  <div className="text-left">
                    <Text fw={500} c="white" size="lg">
                      {file.name}
                    </Text>
                    <Group gap="xs">
                      <Text size="sm" c="dimmed">
                        {formatFileSize(file.size)}
                      </Text>
                      {previewData && (
                        <>
                          <Text size="sm" c="dimmed">•</Text>
                          <Text size="sm" c="dimmed">
                            {previewData.validCount.toLocaleString()} valid rows
                          </Text>
                          {previewData.duplicateCount > 0 && (
                            <>
                              <Text size="sm" c="dimmed">•</Text>
                              <Badge size="xs" color="yellow" variant="light">
                                {previewData.duplicateCount} duplicates
                              </Badge>
                            </>
                          )}
                        </>
                      )}
                      {isPreviewing && (
                        <Text size="sm" c="blue">Analyzing...</Text>
                      )}
                    </Group>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <IconX size={20} className="text-white/60" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* File options */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextInput
                label="List Name"
                placeholder="Enter a name for this list"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                classNames={{
                  input: 'bg-white/5 border-white/20 text-white',
                  label: 'text-white/70',
                }}
              />
              <Select
                label="Partner Technology"
                placeholder="Select partner"
                value={partnerTech}
                onChange={(value) => setPartnerTech(value || '')}
                data={PARTNER_TECH_OPTIONS}
                classNames={{
                  input: 'bg-white/5 border-white/20 text-white',
                  label: 'text-white/70',
                }}
              />
              <Select
                label="Data Source"
                placeholder="Select source"
                value={source}
                onChange={(value) => setSource(value || 'manual')}
                data={[
                  { value: 'salesforce', label: 'Salesforce' },
                  { value: 'demandbase', label: 'Demandbase' },
                  { value: '6sense', label: '6sense' },
                  { value: 'manual', label: 'Manual / Excel' },
                ]}
                classNames={{
                  input: 'bg-white/5 border-white/20 text-white',
                  label: 'text-white/70',
                }}
              />
            </div>

            {/* Upload progress */}
            {isUploading && progress && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {progress.message}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {getProgressPercent()}%
                  </Text>
                </Group>
                <Progress
                  value={getProgressPercent()}
                  size="md"
                  radius="xl"
                  color={progress.stage === 'error' ? 'red' : 'blue'}
                  animated={progress.stage !== 'complete' && progress.stage !== 'error'}
                  classNames={{
                    root: 'bg-white/10',
                  }}
                />
              </motion.div>
            )}

            {/* Upload result */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {result.success ? (
                  <Alert
                    icon={<IconCheck size={20} />}
                    title="Upload Complete"
                    color="green"
                    variant="light"
                  >
                    <Stack gap="xs">
                      <Text size="sm">
                        Successfully inserted <strong>{result.insertedRows.toLocaleString()}</strong> companies
                      </Text>
                      {result.skippedRows > 0 && (
                        <Text size="sm" c="dimmed">
                          Skipped {result.skippedRows} existing domains
                        </Text>
                      )}
                      {result.duplicateRows > 0 && (
                        <Text size="sm" c="dimmed">
                          Removed {result.duplicateRows} duplicates from file
                        </Text>
                      )}
                      {result.warnings.length > 0 && (
                        <Text size="xs" c="yellow">
                          {result.warnings[0]}
                        </Text>
                      )}
                    </Stack>
                  </Alert>
                ) : (
                  <Alert
                    icon={<IconAlertTriangle size={20} />}
                    title="Upload Failed"
                    color="red"
                    variant="light"
                  >
                    <Text size="sm">{result.errors[0]?.message || 'Unknown error'}</Text>
                  </Alert>
                )}
              </motion.div>
            )}

            {/* Upload button */}
            {!result?.success && (
              <Button
                onClick={handleUpload}
                disabled={isUploading || !listName.trim() || isPreviewing}
                loading={isUploading}
                fullWidth
                size="lg"
                leftSection={<IconUpload size={20} />}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
              >
                {isUploading ? progress?.message || 'Uploading...' : 'Upload & Import'}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <IconAlertCircle size={24} className="text-red-400 flex-shrink-0" />
            <Text c="red.4" size="sm">
              {error}
            </Text>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
