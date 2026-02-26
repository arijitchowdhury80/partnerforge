/**
 * ListUpload - CSV Upload Component
 *
 * Drag and drop zone for uploading CSV files containing company lists.
 * Features file validation, column mapping preview, and progress tracking.
 */

import { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Text,
  Group,
  Stack,
  Button,
  Progress,
  Badge,
  Table,
  Alert,
  Transition,
  rem,
  useMantineTheme,
} from '@mantine/core';
import { Dropzone, MIME_TYPES, FileWithPath } from '@mantine/dropzone';
import {
  IconUpload,
  IconFile,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconTable,
  IconArrowRight,
  IconRefresh,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface ColumnMapping {
  csvColumn: string;
  mappedTo: string | null;
  sampleValue: string;
}

interface UploadedList {
  id: string;
  fileName: string;
  rowCount: number;
  columns: ColumnMapping[];
  status: 'preview' | 'processing' | 'complete' | 'error';
  progress: number;
  errorMessage?: string;
}

const EXPECTED_COLUMNS = [
  { key: 'domain', label: 'Domain', required: true },
  { key: 'company_name', label: 'Company Name', required: false },
  { key: 'partner_tech', label: 'Partner Technology', required: false },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'vertical', label: 'Vertical', required: false },
];

export function ListUpload() {
  const theme = useMantineTheme();
  const [uploadedList, setUploadedList] = useState<UploadedList | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const parseCSV = useCallback((content: string) => {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
    const firstRow = lines[1]?.split(',').map((v) => v.trim().replace(/^"|"$/g, '')) || [];

    const columns: ColumnMapping[] = headers.map((header, index) => {
      // Try to auto-map columns
      let mappedTo: string | null = null;
      const headerLower = header.toLowerCase();

      if (headerLower.includes('domain') || headerLower.includes('website') || headerLower.includes('url')) {
        mappedTo = 'domain';
      } else if (headerLower.includes('company') || headerLower.includes('name')) {
        mappedTo = 'company_name';
      } else if (headerLower.includes('partner') || headerLower.includes('tech')) {
        mappedTo = 'partner_tech';
      } else if (headerLower.includes('industry')) {
        mappedTo = 'industry';
      } else if (headerLower.includes('vertical')) {
        mappedTo = 'vertical';
      }

      return {
        csvColumn: header,
        mappedTo,
        sampleValue: firstRow[index] || '',
      };
    });

    return {
      headers,
      rowCount: lines.length - 1,
      columns,
    };
  }, []);

  const handleDrop = useCallback(
    (files: FileWithPath[]) => {
      const file = files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const parsed = parseCSV(content);

        setUploadedList({
          id: `list-${Date.now()}`,
          fileName: file.name,
          rowCount: parsed.rowCount,
          columns: parsed.columns,
          status: 'preview',
          progress: 0,
        });

        notifications.show({
          title: 'File Uploaded',
          message: `${file.name} loaded with ${parsed.rowCount} rows`,
          color: 'blue',
        });
      };
      reader.readAsText(file);
    },
    [parseCSV]
  );

  const handleProcess = useCallback(async () => {
    if (!uploadedList) return;

    const hasDomainColumn = uploadedList.columns.some((c) => c.mappedTo === 'domain');
    if (!hasDomainColumn) {
      notifications.show({
        title: 'Domain column required',
        message: 'Please map a column to the Domain field',
        color: 'red',
      });
      return;
    }

    setIsProcessing(true);
    setUploadedList((prev) => (prev ? { ...prev, status: 'processing' } : null));

    // Simulate processing with progress updates
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      setUploadedList((prev) =>
        prev ? { ...prev, progress: i } : null
      );
    }

    setUploadedList((prev) =>
      prev ? { ...prev, status: 'complete', progress: 100 } : null
    );
    setIsProcessing(false);

    notifications.show({
      title: 'Upload Complete',
      message: `${uploadedList.rowCount} companies added to the queue`,
      color: 'green',
      icon: <IconCheck size={16} />,
    });
  }, [uploadedList]);

  const handleReset = useCallback(() => {
    setUploadedList(null);
    setIsProcessing(false);
  }, []);

  const hasDomainMapping = uploadedList?.columns.some((c) => c.mappedTo === 'domain');

  return (
    <Stack gap="lg">
      {/* Dropzone */}
      <Transition mounted={!uploadedList} transition="fade" duration={300}>
        {(styles) => (
          <Paper
            p="xl"
            withBorder
            style={{
              ...styles,
              background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.05), rgba(84, 104, 255, 0.02))',
              borderStyle: 'dashed',
              borderColor: 'rgba(0, 61, 255, 0.3)',
            }}
          >
            <Dropzone
              onDrop={handleDrop}
              accept={[MIME_TYPES.csv, 'text/csv', 'application/vnd.ms-excel']}
              maxSize={10 * 1024 * 1024} // 10MB
              multiple={false}
              styles={{
                root: {
                  border: 'none',
                  background: 'transparent',
                  '&:hover': {
                    background: 'rgba(0, 61, 255, 0.05)',
                  },
                },
              }}
            >
              <Group
                justify="center"
                gap="xl"
                mih={220}
                style={{ pointerEvents: 'none' }}
              >
                <Dropzone.Accept>
                  <IconUpload
                    style={{
                      width: rem(52),
                      height: rem(52),
                      color: theme.colors.blue[6],
                    }}
                    stroke={1.5}
                  />
                </Dropzone.Accept>
                <Dropzone.Reject>
                  <IconX
                    style={{
                      width: rem(52),
                      height: rem(52),
                      color: theme.colors.red[6],
                    }}
                    stroke={1.5}
                  />
                </Dropzone.Reject>
                <Dropzone.Idle>
                  <IconFile
                    style={{
                      width: rem(52),
                      height: rem(52),
                      color: theme.colors.blue[4],
                    }}
                    stroke={1.5}
                  />
                </Dropzone.Idle>

                <div>
                  <Text size="xl" inline fw={500}>
                    Drag CSV file here or click to browse
                  </Text>
                  <Text size="sm" c="dimmed" inline mt={7}>
                    Upload a list of companies for enrichment. File should contain at least a domain column.
                  </Text>
                  <Group mt="md" gap="xs">
                    <Badge variant="light" color="blue">
                      CSV format
                    </Badge>
                    <Badge variant="light" color="gray">
                      Max 10MB
                    </Badge>
                    <Badge variant="light" color="gray">
                      10,000 rows max
                    </Badge>
                  </Group>
                </div>
              </Group>
            </Dropzone>
          </Paper>
        )}
      </Transition>

      {/* File Preview */}
      <Transition mounted={!!uploadedList} transition="slide-up" duration={300}>
        {(styles) => (
          <Paper p="lg" withBorder style={styles}>
            {/* File Header */}
            <Group justify="space-between" mb="md">
              <Group>
                <Box
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.2), rgba(84, 104, 255, 0.1))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconTable size={24} color={theme.colors.blue[4]} />
                </Box>
                <div>
                  <Text fw={500}>{uploadedList?.fileName}</Text>
                  <Group gap="xs">
                    <Badge variant="light" size="sm">
                      {uploadedList?.rowCount.toLocaleString()} rows
                    </Badge>
                    <Badge variant="light" size="sm">
                      {uploadedList?.columns.length} columns
                    </Badge>
                    <Badge
                      variant="filled"
                      size="sm"
                      color={
                        uploadedList?.status === 'complete'
                          ? 'green'
                          : uploadedList?.status === 'error'
                          ? 'red'
                          : 'blue'
                      }
                    >
                      {uploadedList?.status}
                    </Badge>
                  </Group>
                </div>
              </Group>
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconRefresh size={16} />}
                onClick={handleReset}
                disabled={isProcessing}
              >
                Upload Different File
              </Button>
            </Group>

            {/* Processing Progress */}
            {uploadedList?.status === 'processing' && (
              <Box mb="md">
                <Group justify="space-between" mb="xs">
                  <Text size="sm">Processing companies...</Text>
                  <Text size="sm" c="dimmed">
                    {uploadedList.progress}%
                  </Text>
                </Group>
                <Progress
                  value={uploadedList.progress}
                  size="md"
                  color="blue"
                  animated
                  striped
                />
              </Box>
            )}

            {/* Column Mapping Table */}
            {uploadedList?.status === 'preview' && (
              <>
                <Text size="sm" c="dimmed" mb="sm">
                  Column Mapping Preview
                </Text>
                <Table
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                  mb="md"
                  styles={{
                    th: {
                      background: 'rgba(0, 61, 255, 0.05)',
                    },
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>CSV Column</Table.Th>
                      <Table.Th>Sample Value</Table.Th>
                      <Table.Th>Maps To</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {uploadedList.columns.map((col, index) => (
                      <Table.Tr key={index}>
                        <Table.Td>
                          <Text size="sm" fw={500}>
                            {col.csvColumn}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed" lineClamp={1}>
                            {col.sampleValue || '(empty)'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {col.mappedTo ? (
                            <Badge
                              variant="filled"
                              color={col.mappedTo === 'domain' ? 'green' : 'blue'}
                            >
                              {EXPECTED_COLUMNS.find((e) => e.key === col.mappedTo)?.label}
                            </Badge>
                          ) : (
                            <Badge variant="light" color="gray">
                              Not mapped
                            </Badge>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {!hasDomainMapping && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    title="Domain column required"
                    color="red"
                    mb="md"
                  >
                    Could not auto-detect a domain column. Please ensure your CSV has a column with
                    domain names (e.g., &quot;example.com&quot;).
                  </Alert>
                )}

                {/* Action Buttons */}
                <Group justify="flex-end">
                  <Button
                    variant="subtle"
                    onClick={handleReset}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    rightSection={<IconArrowRight size={16} />}
                    onClick={handleProcess}
                    disabled={!hasDomainMapping || isProcessing}
                    loading={isProcessing}
                  >
                    Process {uploadedList.rowCount.toLocaleString()} Companies
                  </Button>
                </Group>
              </>
            )}

            {/* Success State */}
            {uploadedList?.status === 'complete' && (
              <Alert icon={<IconCheck size={16} />} title="Upload Complete" color="green">
                <Text size="sm">
                  {uploadedList.rowCount.toLocaleString()} companies have been added to the enrichment queue.
                  View progress in the Enrichment tab.
                </Text>
              </Alert>
            )}

            {/* Error State */}
            {uploadedList?.status === 'error' && (
              <Alert icon={<IconAlertCircle size={16} />} title="Upload Failed" color="red">
                <Text size="sm">{uploadedList.errorMessage || 'An error occurred during upload'}</Text>
              </Alert>
            )}
          </Paper>
        )}
      </Transition>
    </Stack>
  );
}
