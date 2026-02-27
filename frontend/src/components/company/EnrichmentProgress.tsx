/**
 * EnrichmentProgress Component
 *
 * Displays step-by-step progress for the enrichment process.
 * Shows status for each API source: pending, running, complete, error.
 * Includes progress bar, estimated time, and cancellation support.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Paper,
  Text,
  Group,
  Stack,
  Progress,
  Button,
  Badge,
  ThemeIcon,
  List,
  Tooltip,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconCircle,
  IconPlayerPause,
  IconPlayerPlay,
  IconEye,
  IconConfetti,
  IconAlertTriangle,
  IconClock,
  IconWorld,
  IconCode,
  IconCurrencyDollar,
  IconUsers,
  IconBooks,
  IconBrain,
  IconDeviceFloppy,
} from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';

// =============================================================================
// Types
// =============================================================================

export interface FailedSource {
  source: string;
  reason: string;
}

export interface EnrichmentStepStatus {
  step: number;
  totalSteps: number;
  currentSource: string;
  completedSources: string[];
  failedSources: FailedSource[];
  isComplete: boolean;
  isCancelled: boolean;
  startedAt?: string;
  estimatedRemainingMs?: number;
}

export interface EnrichmentStep {
  id: string;
  name: string;
  description: string;
  estimatedMs: number;
  icon: React.ReactNode;
}

export interface EnrichmentProgressProps {
  domain: string;
  status: EnrichmentStepStatus;
  onCancel: () => void;
  onComplete: () => void;
  onResume?: () => void;
  onViewData?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

export const ENRICHMENT_STEPS: EnrichmentStep[] = [
  {
    id: 'similarweb',
    name: 'SimilarWeb Traffic',
    description: 'Fetching traffic, engagement, and audience data',
    estimatedMs: 3000,
    icon: <IconWorld size={16} />,
  },
  {
    id: 'builtwith',
    name: 'BuiltWith Tech Stack',
    description: 'Detecting technology stack and search providers',
    estimatedMs: 2500,
    icon: <IconCode size={16} />,
  },
  {
    id: 'yahoo',
    name: 'Yahoo Finance',
    description: 'Fetching financial data for public companies',
    estimatedMs: 2000,
    icon: <IconCurrencyDollar size={16} />,
  },
  {
    id: 'competitors',
    name: 'Competitor Analysis',
    description: 'Analyzing competitors and their search providers',
    estimatedMs: 4000,
    icon: <IconUsers size={16} />,
  },
  {
    id: 'casestudies',
    name: 'Case Study Matching',
    description: 'Finding relevant Algolia case studies',
    estimatedMs: 1500,
    icon: <IconBooks size={16} />,
  },
  {
    id: 'insights',
    name: 'Strategic Insights',
    description: 'Generating displacement angles and ICP score',
    estimatedMs: 1000,
    icon: <IconBrain size={16} />,
  },
  {
    id: 'save',
    name: 'Save to Database',
    description: 'Persisting enriched data to Supabase',
    estimatedMs: 500,
    icon: <IconDeviceFloppy size={16} />,
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

function getStepStatus(
  stepIndex: number,
  status: EnrichmentStepStatus
): 'pending' | 'running' | 'complete' | 'error' {
  const stepName = ENRICHMENT_STEPS[stepIndex].name;

  // Check if this step failed
  if (status.failedSources.some((f) => f.source === stepName)) {
    return 'error';
  }

  // Check if this step is complete
  if (status.completedSources.includes(stepName)) {
    return 'complete';
  }

  // Check if this is the current step
  if (status.currentSource === stepName && !status.isComplete && !status.isCancelled) {
    return 'running';
  }

  return 'pending';
}

function formatTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `${seconds} sec`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function getStatusIcon(stepStatus: 'pending' | 'running' | 'complete' | 'error') {
  switch (stepStatus) {
    case 'complete':
      return <IconCheck size={14} />;
    case 'running':
      return <IconLoader2 size={14} className="animate-spin" />;
    case 'error':
      return <IconX size={14} />;
    default:
      return <IconCircle size={14} />;
  }
}

function getStatusColor(stepStatus: 'pending' | 'running' | 'complete' | 'error'): string {
  switch (stepStatus) {
    case 'complete':
      return 'green';
    case 'running':
      return 'blue';
    case 'error':
      return 'red';
    default:
      return 'gray';
  }
}

// =============================================================================
// Component
// =============================================================================

export function EnrichmentProgress({
  domain,
  status,
  onCancel,
  onComplete,
  onResume,
  onViewData,
}: EnrichmentProgressProps) {
  const progressPercent = Math.round(
    (status.completedSources.length / status.totalSteps) * 100
  );

  const hasFailures = status.failedSources.length > 0;
  const isInProgress = !status.isComplete && !status.isCancelled;

  // Call onComplete when enrichment finishes
  useEffect(() => {
    if (status.isComplete) {
      onComplete();
    }
  }, [status.isComplete, onComplete]);

  return (
    <Paper
      p="lg"
      radius="md"
      className="border border-gray-200 bg-white"
    >
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <Text fw={600} size="lg" c={COLORS.ALGOLIA_SPACE_GRAY}>
              Enriching {domain}
            </Text>
            <Text size="sm" c="dimmed">
              {status.isComplete
                ? hasFailures
                  ? `Enrichment complete with ${status.failedSources.length} failed sources`
                  : 'Enrichment complete'
                : status.isCancelled
                ? 'Enrichment cancelled'
                : `Step ${status.step + 1} of ${status.totalSteps}`}
            </Text>
          </div>

          {/* Status Badge */}
          {status.isComplete && !hasFailures && (
            <Badge color="green" variant="light" size="lg" data-testid="enrichment-success">
              <Group gap={4}>
                <IconConfetti size={14} />
                Enrichment Complete
              </Group>
            </Badge>
          )}
          {status.isComplete && hasFailures && (
            <Badge color="orange" variant="light" size="lg">
              <Group gap={4}>
                <IconAlertTriangle size={14} />
                Partial Success
              </Group>
            </Badge>
          )}
          {status.isCancelled && (
            <Badge color="gray" variant="light" size="lg">
              Cancelled
            </Badge>
          )}
        </Group>

        {/* Progress Bar */}
        <div>
          <Progress
            value={progressPercent}
            size="lg"
            radius="xl"
            color={status.isComplete ? (hasFailures ? 'orange' : 'green') : 'blue'}
            animated={isInProgress}
            striped={isInProgress}
            aria-label={`Enrichment progress for ${domain}`}
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
          <Group justify="space-between" mt={4}>
            <Text size="xs" c="dimmed">
              {progressPercent}% complete
            </Text>
            {status.estimatedRemainingMs && isInProgress && (
              <Text size="xs" c="dimmed">
                <IconClock size={12} style={{ display: 'inline', marginRight: 4 }} />
                ~{formatTime(status.estimatedRemainingMs)} remaining
              </Text>
            )}
          </Group>
        </div>

        {/* Step List */}
        <List spacing="xs" size="sm" center>
          {ENRICHMENT_STEPS.map((step, index) => {
            const stepStatus = getStepStatus(index, status);
            const failedInfo = status.failedSources.find((f) => f.source === step.name);

            return (
              <List.Item
                key={step.id}
                data-testid={`enrichment-step-${index}`}
                data-status={stepStatus}
                icon={
                  <ThemeIcon
                    size={24}
                    radius="xl"
                    color={getStatusColor(stepStatus)}
                    variant={stepStatus === 'pending' ? 'light' : 'filled'}
                  >
                    {getStatusIcon(stepStatus)}
                  </ThemeIcon>
                }
              >
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <Group gap="xs">
                      <Text
                        size="sm"
                        fw={stepStatus === 'running' ? 600 : 400}
                        c={stepStatus === 'pending' ? 'dimmed' : undefined}
                      >
                        {step.name}
                      </Text>
                      {stepStatus === 'running' && (
                        <Badge size="xs" color="blue" variant="light">
                          In Progress
                        </Badge>
                      )}
                    </Group>
                    {failedInfo && (
                      <Text size="xs" c="red">
                        {failedInfo.reason}
                      </Text>
                    )}
                  </div>
                  <Tooltip label={step.description} position="left">
                    <Text size="xs" c="dimmed">
                      {step.icon}
                    </Text>
                  </Tooltip>
                </Group>
              </List.Item>
            );
          })}
        </List>

        {/* Failed Sources Summary */}
        {hasFailures && status.isComplete && (
          <Paper p="sm" radius="sm" className="bg-red-50 border border-red-200">
            <Group gap="xs" mb="xs">
              <IconAlertTriangle size={16} color="red" />
              <Text size="sm" fw={500} c="red">
                {status.failedSources.length} source{status.failedSources.length > 1 ? 's' : ''} failed
              </Text>
            </Group>
            <Stack gap={4}>
              {status.failedSources.map((failed) => (
                <Text key={failed.source} size="xs" c="dimmed">
                  <strong>{failed.source}:</strong> {failed.reason}
                </Text>
              ))}
            </Stack>
          </Paper>
        )}

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm">
          {isInProgress && (
            <>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconPlayerPause size={16} />}
              >
                Run in Background
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<IconX size={16} />}
                onClick={onCancel}
              >
                Cancel Remaining
              </Button>
            </>
          )}

          {status.isCancelled && onResume && (
            <Button
              variant="light"
              color="blue"
              leftSection={<IconPlayerPlay size={16} />}
              onClick={onResume}
            >
              Resume
            </Button>
          )}

          {status.isComplete && (
            <Button
              variant="filled"
              color="blue"
              leftSection={<IconEye size={16} />}
              onClick={onViewData}
            >
              View Enriched Data
            </Button>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

export default EnrichmentProgress;
