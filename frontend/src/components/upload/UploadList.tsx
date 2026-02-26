/**
 * UploadList Component
 *
 * List all uploads with status, progress, and actions.
 * Premium glassmorphism styling with animations.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  Text,
  Badge,
  Button,
  Group,
  Paper,
  ActionIcon,
  Menu,
  Tooltip,
  Progress,
  ScrollArea,
  Skeleton,
  Avatar,
} from '@mantine/core';
import {
  IconDotsVertical,
  IconEye,
  IconDownload,
  IconTrash,
  IconRefresh,
  IconFileUpload,
  IconClock,
  IconCheck,
  IconX,
  IconLoader2,
  IconPlayerPlay,
  IconDatabase,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import type { UploadedList, UploadStatus } from '@/types';

interface UploadListProps {
  onSelect: (list: UploadedList) => void;
  onNewUpload: () => void;
  onDelete?: (listId: string) => void;
  onDownload?: (listId: string) => void;
  onRetry?: (listId: string) => void;
}

// Fetch uploads list
async function fetchUploads(): Promise<UploadedList[]> {
  const response = await fetch('/api/v1/lists');
  if (!response.ok) {
    throw new Error('Failed to fetch uploads');
  }
  const data = await response.json();
  return data.lists || [];
}

export function UploadList({
  onSelect,
  onNewUpload,
  onDelete,
  onDownload,
  onRetry,
}: UploadListProps) {
  const { data: uploads, isLoading, error, refetch } = useQuery({
    queryKey: ['uploads'],
    queryFn: fetchUploads,
    refetchInterval: 5000, // Refresh every 5 seconds for live updates
  });

  // Sort uploads by created_at desc
  const sortedUploads = useMemo(() => {
    if (!uploads) return [];
    return [...uploads].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [uploads]);

  // Get status badge
  const getStatusBadge = (status: UploadStatus, progress?: number) => {
    const configs: Record<UploadStatus, { color: string; icon: React.ReactNode; label: string }> = {
      uploaded: { color: 'gray', icon: <IconFileUpload size={12} />, label: 'Uploaded' },
      parsing: { color: 'blue', icon: <IconLoader2 size={12} className="animate-spin" />, label: 'Parsing' },
      parsed: { color: 'cyan', icon: <IconCheck size={12} />, label: 'Parsed' },
      validating: { color: 'blue', icon: <IconLoader2 size={12} className="animate-spin" />, label: 'Validating' },
      validated: { color: 'cyan', icon: <IconCheck size={12} />, label: 'Validated' },
      queued: { color: 'yellow', icon: <IconClock size={12} />, label: 'Queued' },
      processing: { color: 'blue', icon: <IconLoader2 size={12} className="animate-spin" />, label: 'Processing' },
      completed: { color: 'green', icon: <IconCheck size={12} />, label: 'Completed' },
      failed: { color: 'red', icon: <IconX size={12} />, label: 'Failed' },
    };

    const config = configs[status] || configs.uploaded;

    return (
      <Badge color={config.color} variant="light" size="sm" leftSection={config.icon}>
        {config.label}
        {status === 'processing' && progress !== undefined && ` (${progress}%)`}
      </Badge>
    );
  };

  // Get source badge
  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      salesforce: 'blue',
      demandbase: 'purple',
      '6sense': 'green',
      manual: 'gray',
    };

    return (
      <Badge color={colors[source] || 'gray'} variant="outline" size="xs">
        {source.charAt(0).toUpperCase() + source.slice(1)}
      </Badge>
    );
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Loading skeleton
  if (isLoading && !uploads) {
    return (
      <Paper
        p="lg"
        radius="lg"
        className="backdrop-blur-xl bg-white/5 border border-white/10"
      >
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton height={40} width={40} circle />
              <div className="flex-1 space-y-2">
                <Skeleton height={16} width="60%" />
                <Skeleton height={12} width="40%" />
              </div>
              <Skeleton height={24} width={80} radius="xl" />
            </div>
          ))}
        </div>
      </Paper>
    );
  }

  // Error state
  if (error) {
    return (
      <Paper
        p="xl"
        radius="lg"
        className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 text-center"
      >
        <IconX size={40} className="mx-auto mb-4 text-red-400" />
        <Text c="red.4" fw={500}>
          Failed to load uploads
        </Text>
        <Button mt="md" variant="subtle" onClick={() => refetch()}>
          Retry
        </Button>
      </Paper>
    );
  }

  // Empty state
  if (!uploads || uploads.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Paper
          p="xl"
          radius="lg"
          className="backdrop-blur-xl bg-white/5 border border-white/10 text-center"
        >
          <IconDatabase size={48} className="mx-auto mb-4 text-white/30" />
          <Text size="lg" fw={500} c="white" mb="xs">
            No Uploads Yet
          </Text>
          <Text size="sm" c="dimmed" mb="lg">
            Upload a CSV file to get started with enrichment
          </Text>
          <Button
            onClick={onNewUpload}
            leftSection={<IconFileUpload size={18} />}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
          >
            Upload CSV
          </Button>
        </Paper>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text size="lg" fw={600} c="white">
            Upload History
          </Text>
          <Text size="sm" c="dimmed">
            {uploads.length} list{uploads.length !== 1 ? 's' : ''} uploaded
          </Text>
        </div>
        <Group gap="sm">
          <Tooltip label="Refresh list">
            <ActionIcon variant="subtle" onClick={() => refetch()}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            onClick={onNewUpload}
            leftSection={<IconFileUpload size={18} />}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 border-0"
          >
            New Upload
          </Button>
        </Group>
      </div>

      {/* Table */}
      <Paper
        p={0}
        radius="lg"
        className="backdrop-blur-xl bg-white/5 border border-white/10 overflow-hidden"
      >
        <ScrollArea>
          <Table
            highlightOnHover
            styles={{
              thead: {
                backgroundColor: 'rgba(26, 26, 35, 0.8)',
              },
              th: {
                color: 'rgba(255, 255, 255, 0.6)',
                fontWeight: 500,
                fontSize: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              },
              td: {
                padding: '16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              },
              tr: {
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  backgroundColor: 'rgba(84, 104, 255, 0.05)',
                },
              },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th>List Name</Table.Th>
                <Table.Th>Source</Table.Th>
                <Table.Th>Rows</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Progress</Table.Th>
                <Table.Th>Created</Table.Th>
                <Table.Th style={{ width: 50 }}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <AnimatePresence>
                {sortedUploads.map((upload, index) => (
                  <motion.tr
                    key={upload.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onSelect(upload)}
                  >
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar
                          size={36}
                          radius="md"
                          className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10"
                        >
                          <IconFileUpload size={18} className="text-blue-400" />
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500} c="white">
                            {upload.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {upload.original_filename}
                          </Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>{getSourceBadge(upload.source)}</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="white">
                        {upload.total_rows.toLocaleString()}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatFileSize(upload.file_size_bytes)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {getStatusBadge(
                        upload.status,
                        upload.status === 'processing'
                          ? Math.round((upload.processed_count / upload.total_rows) * 100)
                          : undefined
                      )}
                    </Table.Td>
                    <Table.Td style={{ width: 150 }}>
                      {upload.status === 'processing' ? (
                        <Progress
                          value={(upload.processed_count / upload.total_rows) * 100}
                          size="sm"
                          radius="xl"
                          color="blue"
                          animated
                          classNames={{ root: 'bg-white/10' }}
                        />
                      ) : upload.status === 'completed' ? (
                        <Group gap="xs">
                          <IconCheck size={16} className="text-green-400" />
                          <Text size="xs" c="green.4">
                            {upload.success_count} enriched
                          </Text>
                        </Group>
                      ) : upload.status === 'failed' ? (
                        <Group gap="xs">
                          <IconX size={16} className="text-red-400" />
                          <Text size="xs" c="red.4">
                            {upload.error_count} errors
                          </Text>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label={new Date(upload.created_at).toLocaleString()}>
                        <Text size="sm" c="dimmed">
                          {formatDistanceToNow(new Date(upload.created_at), { addSuffix: true })}
                        </Text>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Menu position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon
                            variant="subtle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconEye size={16} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelect(upload);
                            }}
                          >
                            View Details
                          </Menu.Item>
                          {upload.status === 'completed' && onDownload && (
                            <Menu.Item
                              leftSection={<IconDownload size={16} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDownload(upload.id);
                              }}
                            >
                              Download Results
                            </Menu.Item>
                          )}
                          {upload.status === 'failed' && onRetry && (
                            <Menu.Item
                              leftSection={<IconRefresh size={16} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRetry(upload.id);
                              }}
                            >
                              Retry Failed
                            </Menu.Item>
                          )}
                          <Menu.Divider />
                          {onDelete && (
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={16} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(upload.id);
                              }}
                            >
                              Delete
                            </Menu.Item>
                          )}
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
    </motion.div>
  );
}
