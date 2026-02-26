/**
 * UploadPage Component
 *
 * Multi-step CSV upload flow with wizard-like navigation.
 * Includes upload, mapping, preview, and enrichment steps.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Container, Title, Text, Stepper, Group, Button, Paper } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconUpload,
  IconColumns,
  IconEye,
  IconPlayerPlay,
  IconCheck,
  IconArrowLeft,
} from '@tabler/icons-react';

import { CSVUploader } from '@/components/upload/CSVUploader';
import { ColumnMapper } from '@/components/upload/ColumnMapper';
import { UploadPreview } from '@/components/upload/UploadPreview';
import { UploadProgress } from '@/components/upload/UploadProgress';
import {
  useListStatus,
  useListItems,
  useValidateMutation,
  useStartEnrichmentMutation,
} from '@/hooks';
import type { ColumnMapping, UploadResponse, UploadedListItem } from '@/types';

type Step = 'upload' | 'mapping' | 'preview' | 'enrichment' | 'complete';

interface UploadState {
  listId: string | null;
  name: string;
  totalRows: number;
  columnMapping: ColumnMapping;
  detectedColumns: string[];
  requiresMapping: boolean;
}

export function UploadPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [uploadState, setUploadState] = useState<UploadState>({
    listId: null,
    name: '',
    totalRows: 0,
    columnMapping: {},
    detectedColumns: [],
    requiresMapping: false,
  });

  // Hooks
  const { data: listStatus } = useListStatus(uploadState.listId || undefined, {
    polling: currentStep === 'enrichment',
  });
  const { data: listItems } = useListItems(uploadState.listId || undefined, {
    pageSize: 10,
  });
  const validateMutation = useValidateMutation();
  const startEnrichmentMutation = useStartEnrichmentMutation();

  // Step mapping for Stepper
  const stepIndex = {
    upload: 0,
    mapping: 1,
    preview: 2,
    enrichment: 3,
    complete: 4,
  };

  // Handle upload complete
  const handleUploadComplete = useCallback(
    (listId: string, response: UploadResponse) => {
      setUploadState({
        listId,
        name: response.name,
        totalRows: response.total_rows,
        columnMapping: response.column_mapping,
        detectedColumns: response.detected_columns,
        requiresMapping: response.requires_mapping_confirmation,
      });

      // Skip mapping if domain was auto-detected
      if (response.requires_mapping_confirmation) {
        setCurrentStep('mapping');
      } else {
        setCurrentStep('preview');
        // Auto-validate
        validateMutation.mutate(listId);
      }
    },
    [validateMutation]
  );

  // Handle mapping confirmation
  const handleMappingConfirm = useCallback(
    (mapping: ColumnMapping) => {
      setUploadState((prev) => ({ ...prev, columnMapping: mapping }));
      setCurrentStep('preview');
      // Trigger validation
      if (uploadState.listId) {
        validateMutation.mutate(uploadState.listId);
      }
    },
    [uploadState.listId, validateMutation]
  );

  // Handle start enrichment
  const handleStartEnrichment = useCallback(() => {
    if (uploadState.listId) {
      startEnrichmentMutation.mutate({ id: uploadState.listId });
      setCurrentStep('enrichment');
    }
  }, [uploadState.listId, startEnrichmentMutation]);

  // Handle enrichment complete
  const handleEnrichmentComplete = useCallback(() => {
    setCurrentStep('complete');
  }, []);

  // Handle view results
  const handleViewResults = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  // Handle download
  const handleDownload = useCallback((listId: string) => {
    // Download logic handled by UploadProgress
    console.log('Download triggered for', listId);
  }, []);

  return (
    <Container size="lg" py="xl">
      {/* Header */}
      <div className="mb-8">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={2} c="white">
              Upload Target List
            </Title>
            <Text c="dimmed" size="sm" mt="xs">
              Upload a CSV file to enrich with partner intelligence
            </Text>
          </div>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </Group>
      </div>

      {/* Stepper */}
      <Paper
        p="lg"
        radius="lg"
        mb="xl"
        className="backdrop-blur-xl bg-white/5 border border-white/10"
      >
        <Stepper
          active={stepIndex[currentStep]}
          color="blue"
          size="sm"
          classNames={{
            step: 'data-[progress]:border-blue-500',
            stepIcon: 'bg-white/10 border-white/20 data-[progress]:bg-blue-500/20 data-[completed]:bg-green-500/20',
            stepLabel: 'text-white',
            stepDescription: 'text-white/60',
            separator: 'bg-white/20',
          }}
        >
          <Stepper.Step
            icon={<IconUpload size={16} />}
            label="Upload"
            description="Select CSV file"
          />
          <Stepper.Step
            icon={<IconColumns size={16} />}
            label="Map Columns"
            description="Confirm mappings"
          />
          <Stepper.Step
            icon={<IconEye size={16} />}
            label="Preview"
            description="Review data"
          />
          <Stepper.Step
            icon={<IconPlayerPlay size={16} />}
            label="Enrich"
            description="Process data"
          />
          <Stepper.Step
            icon={<IconCheck size={16} />}
            label="Complete"
            description="View results"
          />
        </Stepper>
      </Paper>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 'upload' && (
            <Paper
              p="xl"
              radius="lg"
              className="backdrop-blur-xl bg-white/5 border border-white/10"
            >
              <CSVUploader onUploadComplete={handleUploadComplete} />
            </Paper>
          )}

          {currentStep === 'mapping' && uploadState.listId && (
            <Paper
              p="xl"
              radius="lg"
              className="backdrop-blur-xl bg-white/5 border border-white/10"
            >
              <ColumnMapper
                listId={uploadState.listId}
                detectedMapping={uploadState.columnMapping}
                csvHeaders={uploadState.detectedColumns}
                onConfirm={handleMappingConfirm}
                onBack={() => setCurrentStep('upload')}
              />
            </Paper>
          )}

          {currentStep === 'preview' && uploadState.listId && (
            <div className="space-y-6">
              <Paper
                p="xl"
                radius="lg"
                className="backdrop-blur-xl bg-white/5 border border-white/10"
              >
                <UploadPreview
                  items={listItems?.data || []}
                  columnMapping={uploadState.columnMapping}
                  totalRows={uploadState.totalRows}
                />
              </Paper>

              <Group justify="space-between">
                <Button
                  variant="subtle"
                  leftSection={<IconArrowLeft size={16} />}
                  onClick={() =>
                    setCurrentStep(uploadState.requiresMapping ? 'mapping' : 'upload')
                  }
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  rightSection={<IconPlayerPlay size={18} />}
                  onClick={handleStartEnrichment}
                  loading={startEnrichmentMutation.isPending}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
                >
                  Start Enrichment
                </Button>
              </Group>
            </div>
          )}

          {currentStep === 'enrichment' && uploadState.listId && (
            <Paper
              p="xl"
              radius="lg"
              className="backdrop-blur-xl bg-white/5 border border-white/10"
            >
              <UploadProgress
                listId={uploadState.listId}
                onComplete={handleEnrichmentComplete}
                onDownload={handleDownload}
                onViewResults={() => navigate('/dashboard')}
              />
            </Paper>
          )}

          {currentStep === 'complete' && (
            <Paper
              p="xl"
              radius="lg"
              className="backdrop-blur-xl bg-green-500/5 border border-green-500/20 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
              >
                <IconCheck size={40} className="text-green-400" />
              </motion.div>
              <Title order={3} c="white" mb="xs">
                Enrichment Complete!
              </Title>
              <Text c="dimmed" mb="xl">
                Your targets have been enriched with partner intelligence.
              </Text>
              <Group justify="center" gap="md">
                <Button
                  variant="light"
                  color="green"
                  onClick={() => handleDownload(uploadState.listId!)}
                >
                  Download Results
                </Button>
                <Button
                  onClick={handleViewResults}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border-0"
                >
                  View in Dashboard
                </Button>
              </Group>
            </Paper>
          )}
        </motion.div>
      </AnimatePresence>
    </Container>
  );
}
