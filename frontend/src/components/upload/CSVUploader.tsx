/**
 * CSVUploader Component
 *
 * Premium drag & drop CSV upload with glassmorphism design.
 * Uses react-dropzone for file handling.
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
} from '@tabler/icons-react';
import { TextInput, Select, Button, Progress, Text, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface CSVUploaderProps {
  onUploadComplete: (listId: string, response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

interface UploadResponse {
  id: string;
  name: string;
  total_rows: number;
  column_mapping: Record<string, string>;
  detected_columns: string[];
  status: string;
  requires_mapping_confirmation: boolean;
}

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function CSVUploader({ onUploadComplete, onError }: CSVUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [listName, setListName] = useState('');
  const [source, setSource] = useState<string>('salesforce');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);

    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Please upload a CSV file.');
      } else {
        setError('File rejected. Please try again.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      setListName(selectedFile.name.replace('.csv', ''));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragAccept, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        'text/csv': ['.csv'],
        'application/vnd.ms-excel': ['.csv'],
      },
      maxFiles: 1,
      maxSize: MAX_FILE_SIZE_BYTES,
    });

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', listName);
      formData.append('source', source);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/v1/lists/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      setUploadProgress(100);
      const data: UploadResponse = await response.json();

      notifications.show({
        title: 'Upload Successful',
        message: `${data.total_rows} rows detected`,
        color: 'green',
      });

      onUploadComplete(data.id, data);
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
    setUploadProgress(0);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                    Drop your CSV file here...
                  </Text>
                ) : (
                  <>
                    <Text size="lg" fw={500} c="white" mb="xs">
                      Drag & drop your CSV file here
                    </Text>
                    <Text size="sm" c="dimmed">
                      or click to browse (max {MAX_FILE_SIZE_MB}MB, 10,000 rows)
                    </Text>
                    <Text size="xs" c="dimmed" mt="md">
                      Supported: Salesforce, Demandbase, 6sense exports
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
                    <IconFileCheck size={32} className="text-green-400" />
                  </div>
                  <div className="text-left">
                    <Text fw={500} c="white" size="lg">
                      {file.name}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {formatFileSize(file.size)}
                    </Text>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                label="Data Source"
                placeholder="Select source"
                value={source}
                onChange={(value) => setSource(value || 'salesforce')}
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
            {isUploading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-2"
              >
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Uploading...
                  </Text>
                  <Text size="sm" c="dimmed">
                    {uploadProgress}%
                  </Text>
                </Group>
                <Progress
                  value={uploadProgress}
                  size="md"
                  radius="xl"
                  color="blue"
                  animated
                  classNames={{
                    root: 'bg-white/10',
                  }}
                />
              </motion.div>
            )}

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={isUploading || !listName.trim()}
              loading={isUploading}
              fullWidth
              size="lg"
              leftSection={<IconUpload size={20} />}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
            >
              {isUploading ? 'Uploading...' : 'Upload & Continue'}
            </Button>
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
