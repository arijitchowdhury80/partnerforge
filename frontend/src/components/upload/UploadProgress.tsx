/**
 * UploadProgress Component
 *
 * Real-time progress tracking for CSV enrichment.
 * Uses polling to track enrichment status.
 */

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  RingProgress,
  Text,
  Group,
  Paper,
  Badge,
  Button,
  Stack,
  Tooltip,
  Progress,
} from '@mantine/core';
import {
  IconCheck,
  IconX,
  IconLoader2,
  IconPlayerPlay,
  IconPlayerPause,
  IconDownload,
  IconRefresh,
  IconClock,
  IconFileCheck,
  IconAlertTriangle,
  IconTrendingUp,
} from '@tabler/icons-react';
import type { ListStatusResponse } from '@/types';

interface UploadProgressProps {
  listId: string;
  onComplete?: (listId: string) => void;
  onDownload?: (listId: string) => void;
  onViewResults?: (listId: string) => void;
}

// Fetch list status
async function fetchListStatus(listId: string): Promise<ListStatusResponse> {
  const response = await fetch(`/api/v1/lists/${listId}/status`);
  if (!response.ok) {
    throw new Error('Failed to fetch status');
  }
  return response.json();
}

export function UploadProgress({
  listId,
  onComplete,
  onDownload,
  onViewResults,
}: UploadProgressProps) {
  const { data: status, isLoading, error, refetch } = useQuery({
    queryKey: ['list-status', listId],
    queryFn: () => fetchListStatus(listId),
    refetchInterval: (query) => {
      // Stop polling when complete or failed
      const data = query.state.data;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
    staleTime: 1000,
  });

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (!status) return 0;
    return status.progress_percent || 0;
  }, [status]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Get status color
  const getStatusColor = (statusValue: string): string => {
    switch (statusValue) {
      case 'completed':
        return 'green';
      case 'processing':
      case 'queued':
        return 'blue';
      case 'failed':
        return 'red';
      case 'validated':
        return 'cyan';
      default:
        return 'gray';
    }
  };

  // Get status icon
  const getStatusIcon = (statusValue: string) => {
    switch (statusValue) {
      case 'completed':
        return <IconCheck size={16} />;
      case 'processing':
        return <IconLoader2 size={16} className="animate-spin" />;
      case 'failed':
        return <IconX size={16} />;
      default:
        return <IconClock size={16} />;
    }
  };

  // Trigger onComplete when status changes to completed
  useEffect(() => {
    if (status?.status === 'completed' && onComplete) {
      onComplete(listId);
    }
  }, [status?.status, listId, onComplete]);

  if (isLoading && !status) {
    return (
      <div className="flex items-center justify-center p-12">
        <IconLoader2 size={40} className="animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center"
      >
        <IconAlertTriangle size={40} className="mx-auto mb-4 text-red-400" />
        <Text c="red.4" fw={500}>
          Failed to load progress
        </Text>
        <Button mt="md" variant="subtle" onClick={() => refetch()}>
          Retry
        </Button>
      </motion.div>
    );
  }

  if (!status) return null;

  const isComplete = status.status === 'completed';
  const isFailed = status.status === 'failed';
  const isProcessing = status.status === 'processing' || status.status === 'queued';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Main progress card */}
      <Paper
        p="xl"
        radius="lg"
        className="backdrop-blur-xl bg-white/5 border border-white/10"
      >
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Progress ring */}
          <div className="relative">
            <RingProgress
              size={160}
              thickness={12}
              roundCaps
              sections={[
                {
                  value: progressPercent,
                  color: isComplete ? 'green' : isFailed ? 'red' : 'blue',
                },
              ]}
              label={
                <div className="text-center">
                  <Text size="xl" fw={700} c="white">
                    {Math.round(progressPercent)}%
                  </Text>
                  <Text size="xs" c="dimmed">
                    Complete
                  </Text>
                </div>
              }
            />
            {isProcessing && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(84, 104, 255, 0.2) 0%, transparent 70%)',
                }}
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </div>

          {/* Status info */}
          <div className="flex-1 text-center md:text-left">
            <Group gap="sm" mb="xs" justify="center" className="md:justify-start">
              <Text size="xl" fw={600} c="white">
                {status.name}
              </Text>
              <Badge
                color={getStatusColor(status.status)}
                variant="light"
                size="lg"
                leftSection={getStatusIcon(status.status)}
              >
                {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
              </Badge>
            </Group>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <StatCard
                label="Total Rows"
                value={status.total_rows}
                icon={<IconFileCheck size={18} className="text-blue-400" />}
              />
              <StatCard
                label="Processed"
                value={status.processed_count}
                icon={<IconCheck size={18} className="text-green-400" />}
                highlight={isComplete}
              />
              <StatCard
                label="Success"
                value={status.success_count}
                icon={<IconTrendingUp size={18} className="text-green-400" />}
              />
              <StatCard
                label="Errors"
                value={status.error_count}
                icon={<IconX size={18} className="text-red-400" />}
                alert={status.error_count > 0}
              />
            </div>
          </div>
        </div>

        {/* Progress bar for detailed progress */}
        {isProcessing && (
          <div className="mt-6 space-y-2">
            <Progress
              value={progressPercent}
              size="lg"
              radius="xl"
              color="blue"
              animated
              striped
              classNames={{
                root: 'bg-white/10',
              }}
            />
            {status.estimated_remaining_seconds && (
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {status.processed_count} / {status.total_rows} items
                </Text>
                <Text size="xs" c="dimmed">
                  Est. remaining: {formatDuration(status.estimated_remaining_seconds)}
                </Text>
              </Group>
            )}
          </div>
        )}
      </Paper>

      {/* Action buttons */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Paper
              p="lg"
              radius="lg"
              className="backdrop-blur-xl bg-green-500/10 border border-green-500/30"
            >
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-full bg-green-500/20">
                    <IconCheck size={24} className="text-green-400" />
                  </div>
                  <div>
                    <Text fw={600} c="white">
                      Enrichment Complete!
                    </Text>
                    <Text size="sm" c="dimmed">
                      {status.success_count} accounts enriched successfully
                    </Text>
                  </div>
                </div>
                <div className="flex gap-3 ml-auto">
                  {onDownload && (
                    <Button
                      variant="light"
                      color="green"
                      leftSection={<IconDownload size={18} />}
                      onClick={() => onDownload(listId)}
                    >
                      Download CSV
                    </Button>
                  )}
                  {onViewResults && (
                    <Button
                      variant="filled"
                      color="green"
                      onClick={() => onViewResults(listId)}
                    >
                      View Results
                    </Button>
                  )}
                </div>
              </div>
            </Paper>
          </motion.div>
        )}

        {isFailed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Paper
              p="lg"
              radius="lg"
              className="backdrop-blur-xl bg-red-500/10 border border-red-500/30"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-red-500/20">
                  <IconX size={24} className="text-red-400" />
                </div>
                <div className="flex-1">
                  <Text fw={600} c="red.4">
                    Processing Failed
                  </Text>
                  <Text size="sm" c="dimmed">
                    {status.error_count} errors encountered. You can retry the failed items.
                  </Text>
                </div>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => refetch()}
                >
                  Retry Failed
                </Button>
              </div>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Stat card component
interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlight?: boolean;
  alert?: boolean;
}

function StatCard({ label, value, icon, highlight, alert }: StatCardProps) {
  return (
    <div
      className={`
        p-4 rounded-xl border transition-all duration-200
        ${highlight
          ? 'bg-green-500/10 border-green-500/30'
          : alert
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-white/5 border-white/10'
        }
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
          {label}
        </Text>
      </div>
      <Text size="xl" fw={700} c={highlight ? 'green.4' : alert ? 'red.4' : 'white'}>
        {value.toLocaleString()}
      </Text>
    </div>
  );
}
