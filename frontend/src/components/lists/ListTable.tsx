/**
 * ListTable - Uploaded Lists Table
 *
 * Displays a table of uploaded CSV lists with their status and actions.
 */

import { Table, Badge, Group, Text, ActionIcon, Tooltip, Progress, Paper, Menu, Box } from '@mantine/core';
import {
  IconDots,
  IconEye,
  IconTrash,
  IconRefresh,
  IconDownload,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';

export interface UploadedListItem {
  id: string;
  name: string;
  rowCount: number;
  enrichedCount: number;
  partnerTech: string;
  createdAt: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  progress: number;
}

interface ListTableProps {
  lists: UploadedListItem[];
  onView?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  onStartEnrichment?: (id: string) => void;
  onExport?: (id: string) => void;
}

const statusColors: Record<string, string> = {
  pending: 'yellow',
  processing: 'blue',
  complete: 'green',
  error: 'red',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  processing: 'Processing',
  complete: 'Complete',
  error: 'Failed',
};

export function ListTable({
  lists,
  onView,
  onDelete,
  onRetry,
  onStartEnrichment,
  onExport,
}: ListTableProps) {
  if (lists.length === 0) {
    return (
      <Paper p="xl" withBorder>
        <Box ta="center" py="xl">
          <Text size="lg" fw={500} c="dimmed">
            No lists uploaded yet
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Upload a CSV file to get started with enrichment
          </Text>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper withBorder>
      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>List Name</Table.Th>
            <Table.Th>Partner Tech</Table.Th>
            <Table.Th ta="center">Companies</Table.Th>
            <Table.Th ta="center">Progress</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th ta="right">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lists.map((list) => (
            <Table.Tr key={list.id}>
              <Table.Td>
                <Text fw={500} size="sm">
                  {list.name}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="light" color="blue">
                  {list.partnerTech}
                </Badge>
              </Table.Td>
              <Table.Td ta="center">
                <Text size="sm">
                  {list.enrichedCount.toLocaleString()} / {list.rowCount.toLocaleString()}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Progress
                    value={list.progress}
                    size="sm"
                    color={list.status === 'error' ? 'red' : 'blue'}
                    style={{ flex: 1, minWidth: 80 }}
                    animated={list.status === 'processing'}
                  />
                  <Text size="xs" c="dimmed" w={35}>
                    {list.progress}%
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <Badge variant="filled" color={statusColors[list.status]}>
                  {statusLabels[list.status]}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {formatDistanceToNow(new Date(list.createdAt), { addSuffix: true })}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="flex-end">
                  {list.status === 'pending' && (
                    <Tooltip label="Start Enrichment">
                      <ActionIcon
                        variant="light"
                        color="green"
                        onClick={() => onStartEnrichment?.(list.id)}
                      >
                        <IconPlayerPlay size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                  <Tooltip label="View Details">
                    <ActionIcon variant="light" onClick={() => onView?.(list.id)}>
                      <IconEye size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Menu shadow="md" position="bottom-end">
                    <Menu.Target>
                      <ActionIcon variant="subtle">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconDownload size={14} />}
                        onClick={() => onExport?.(list.id)}
                      >
                        Export Results
                      </Menu.Item>
                      {list.status === 'error' && (
                        <Menu.Item
                          leftSection={<IconRefresh size={14} />}
                          onClick={() => onRetry?.(list.id)}
                        >
                          Retry Failed
                        </Menu.Item>
                      )}
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => onDelete?.(list.id)}
                      >
                        Delete List
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}
