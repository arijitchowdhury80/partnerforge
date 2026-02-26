/**
 * UploadPreview Component
 *
 * Preview first 10 rows of uploaded CSV data.
 * Shows mapped columns with glassmorphism styling.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Table, Text, Badge, ScrollArea, Group, Paper, Tooltip } from '@mantine/core';
import { IconCheck, IconX, IconAlertTriangle } from '@tabler/icons-react';
import type { ColumnMapping, UploadedListItem, ValidationError } from '@/types';

interface UploadPreviewProps {
  items: UploadedListItem[];
  columnMapping: ColumnMapping;
  totalRows: number;
  onRowClick?: (item: UploadedListItem) => void;
}

export function UploadPreview({
  items,
  columnMapping,
  totalRows,
  onRowClick,
}: UploadPreviewProps) {
  // Get columns to display
  const displayColumns = useMemo(() => {
    const mapped = Object.entries(columnMapping)
      .filter(([_, value]) => value)
      .map(([key, value]) => ({
        key,
        header: value as string,
        label: formatFieldLabel(key),
      }));

    // Always include domain first
    const domainCol = mapped.find((c) => c.key === 'domain');
    const otherCols = mapped.filter((c) => c.key !== 'domain');

    return domainCol ? [domainCol, ...otherCols] : mapped;
  }, [columnMapping]);

  // Get status badge
  const getStatusBadge = (item: UploadedListItem) => {
    switch (item.status) {
      case 'valid':
        return (
          <Badge color="green" variant="light" size="sm" leftSection={<IconCheck size={12} />}>
            Valid
          </Badge>
        );
      case 'invalid':
        return (
          <Tooltip
            label={item.validation_errors?.map((e) => e.error).join(', ') || 'Validation error'}
            multiline
            w={300}
          >
            <Badge color="red" variant="light" size="sm" leftSection={<IconX size={12} />}>
              Invalid
            </Badge>
          </Tooltip>
        );
      case 'enriched':
        return (
          <Badge color="blue" variant="light" size="sm">
            Enriched
          </Badge>
        );
      case 'enriching':
        return (
          <Badge color="cyan" variant="light" size="sm">
            Processing
          </Badge>
        );
      default:
        return (
          <Badge color="gray" variant="light" size="sm">
            Pending
          </Badge>
        );
    }
  };

  // Get cell value from item
  const getCellValue = (item: UploadedListItem, columnKey: string): string => {
    // Check direct properties first
    if (columnKey === 'domain') return item.domain || '';
    if (columnKey === 'company_name') return item.company_name || '';
    if (columnKey === 'salesforce_id') return item.salesforce_id || '';
    if (columnKey === 'demandbase_id') return item.demandbase_id || '';

    // Check csv_data
    const csvValue = item.csv_data?.[columnMapping[columnKey as keyof ColumnMapping] || ''];
    if (csvValue === null || csvValue === undefined) return '';
    return String(csvValue);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text size="lg" fw={600} c="white">
            Data Preview
          </Text>
          <Text size="sm" c="dimmed">
            Showing {items.length} of {totalRows.toLocaleString()} rows
          </Text>
        </div>
        <Group gap="xs">
          <Badge color="green" variant="dot" size="sm">
            {items.filter((i) => i.status === 'valid').length} valid
          </Badge>
          <Badge color="red" variant="dot" size="sm">
            {items.filter((i) => i.status === 'invalid').length} invalid
          </Badge>
        </Group>
      </div>

      {/* Table */}
      <Paper
        p={0}
        radius="lg"
        className="backdrop-blur-xl bg-white/5 border border-white/10 overflow-hidden"
      >
        <ScrollArea h={400} type="auto">
          <Table
            striped
            highlightOnHover
            withColumnBorders={false}
            className="min-w-full"
            styles={{
              table: {
                borderCollapse: 'separate',
                borderSpacing: 0,
              },
              thead: {
                position: 'sticky',
                top: 0,
                zIndex: 10,
                backgroundColor: 'rgba(26, 26, 35, 0.95)',
                backdropFilter: 'blur(20px)',
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
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '14px',
              },
              tr: {
                cursor: onRowClick ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
                '&:hover': {
                  backgroundColor: 'rgba(84, 104, 255, 0.05)',
                },
              },
            }}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 50 }}>#</Table.Th>
                <Table.Th style={{ width: 100 }}>Status</Table.Th>
                {displayColumns.map((col) => (
                  <Table.Th key={col.key}>{col.label}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => onRowClick?.(item)}
                  style={{
                    backgroundColor:
                      item.status === 'invalid'
                        ? 'rgba(239, 68, 68, 0.05)'
                        : 'transparent',
                  }}
                >
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {item.row_number}
                    </Text>
                  </Table.Td>
                  <Table.Td>{getStatusBadge(item)}</Table.Td>
                  {displayColumns.map((col) => (
                    <Table.Td key={col.key}>
                      <Text
                        size="sm"
                        truncate
                        maw={200}
                        c={col.key === 'domain' ? 'white' : 'dimmed'}
                        fw={col.key === 'domain' ? 500 : 400}
                      >
                        {getCellValue(item, col.key) || '-'}
                      </Text>
                    </Table.Td>
                  ))}
                </motion.tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>

        {/* Footer with pagination hint */}
        {totalRows > items.length && (
          <div className="px-4 py-3 border-t border-white/10 bg-white/5">
            <Text size="xs" c="dimmed" ta="center">
              Preview limited to first {items.length} rows.{' '}
              {totalRows - items.length} more rows will be processed.
            </Text>
          </div>
        )}
      </Paper>

      {/* Validation errors summary */}
      {items.some((i) => i.status === 'invalid') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
        >
          <div className="flex items-start gap-3">
            <IconAlertTriangle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <Text size="sm" fw={500} c="red.4" mb="xs">
                Validation Errors Found
              </Text>
              <div className="space-y-1">
                {getUniqueErrors(items).map((error, idx) => (
                  <Text key={idx} size="xs" c="dimmed">
                    - {error.count}x {error.error}
                  </Text>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Helper to format field labels
function formatFieldLabel(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to get unique errors with counts
function getUniqueErrors(
  items: UploadedListItem[]
): Array<{ error: string; count: number }> {
  const errorCounts: Record<string, number> = {};

  items.forEach((item) => {
    item.validation_errors?.forEach((err) => {
      const key = `${err.field}: ${err.error}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
  });

  return Object.entries(errorCounts)
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count);
}
