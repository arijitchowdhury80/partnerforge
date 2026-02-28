/**
 * ExportModal Component
 *
 * Modal for exporting company data to CSV, JSON, or Excel formats.
 * Supports column selection, presets, and custom formatting.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Modal,
  Button,
  Group,
  Stack,
  Text,
  Checkbox,
  Radio,
  SimpleGrid,
  Divider,
  Badge,
  Chip,
  Box,
} from '@mantine/core';
import { IconDownload, IconX } from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';
import {
  exportToCSV,
  exportToJSON,
  downloadExport,
  generateFilename,
  EXPORT_PRESETS,
  EXPORT_COLUMNS,
  type ExportFormat,
  type ExportPresetKey,
} from '@/services/exportService';
import type { Company } from '@/types';

// =============================================================================
// Types
// =============================================================================

export interface ExportModalProps {
  opened: boolean;
  onClose: () => void;
  companies: Company[];
  selectedCount: number;
}

// =============================================================================
// Preset Metadata
// =============================================================================

const PRESET_INFO: Record<ExportPresetKey, { label: string; description: string }> = {
  salesOutreach: {
    label: 'Sales Outreach',
    description: 'Essential fields for sales prospecting',
  },
  fullIntel: {
    label: 'Full Intel',
    description: 'All available intelligence fields',
  },
  crmImport: {
    label: 'CRM Import',
    description: 'Standard fields for CRM import',
  },
};

// =============================================================================
// Component
// =============================================================================

export function ExportModal({
  opened,
  onClose,
  companies,
  selectedCount,
}: ExportModalProps) {
  // State
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(EXPORT_PRESETS.salesOutreach)
  );
  const [activePreset, setActivePreset] = useState<ExportPresetKey | null>('salesOutreach');
  const [isLoading, setIsLoading] = useState(false);

  // Check which preset matches current selection
  const currentPreset = useMemo(() => {
    for (const [key, columns] of Object.entries(EXPORT_PRESETS)) {
      const presetSet = new Set<string>(columns);
      if (
        selectedColumns.size === presetSet.size &&
        [...selectedColumns].every((col) => presetSet.has(col))
      ) {
        return key as ExportPresetKey;
      }
    }
    return null;
  }, [selectedColumns]);

  // Handlers
  const handleColumnToggle = useCallback((columnKey: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) {
        next.delete(columnKey);
      } else {
        next.add(columnKey);
      }
      return next;
    });
    setActivePreset(null);
  }, []);

  const handlePresetSelect = useCallback((presetKey: ExportPresetKey) => {
    setSelectedColumns(new Set(EXPORT_PRESETS[presetKey]));
    setActivePreset(presetKey);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedColumns(new Set(EXPORT_COLUMNS.map((c) => c.key)));
    setActivePreset(null);
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedColumns(new Set());
    setActivePreset(null);
  }, []);

  const handleDownload = useCallback(async () => {
    if (selectedColumns.size === 0) return;

    setIsLoading(true);

    try {
      const columns = Array.from(selectedColumns);
      const options = { format, columns };

      let data: string;
      let mimeType: string;

      if (format === 'json') {
        data = exportToJSON(companies, options);
        mimeType = 'application/json';
      } else {
        data = exportToCSV(companies, options);
        mimeType = 'text/csv';
      }

      const filename = generateFilename(format);
      downloadExport(data, filename, mimeType);

      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [companies, format, selectedColumns, onClose]);

  // Format number with commas
  const formattedCount = selectedCount.toLocaleString();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={600} size="lg">
            Export Companies
          </Text>
          <Badge variant="light" color="blue">
            {formattedCount} selected
          </Badge>
        </Group>
      }
      size="lg"
      padding="lg"
    >
      <Stack gap="lg">
        {/* Export Format */}
        <Box>
          <Text fw={500} mb="xs">
            Export Format
          </Text>
          <Radio.Group value={format} onChange={(v) => setFormat(v as ExportFormat)}>
            <Group>
              <Radio value="csv" label="CSV" aria-label="CSV" />
              <Radio value="excel" label="Excel" aria-label="Excel" />
              <Radio value="json" label="JSON" aria-label="JSON" />
            </Group>
          </Radio.Group>
        </Box>

        <Divider />

        {/* Presets */}
        <Box>
          <Text fw={500} mb="xs">
            Column Presets
          </Text>
          <Group gap="xs">
            {(Object.keys(EXPORT_PRESETS) as ExportPresetKey[]).map((presetKey) => (
              <Chip
                key={presetKey}
                checked={activePreset === presetKey || currentPreset === presetKey}
                onChange={() => handlePresetSelect(presetKey)}
                variant="filled"
                data-active={activePreset === presetKey || currentPreset === presetKey}
              >
                {PRESET_INFO[presetKey].label}
              </Chip>
            ))}
          </Group>
        </Box>

        <Divider />

        {/* Column Selection */}
        <Box>
          <Group justify="space-between" mb="xs">
            <Text fw={500}>Select Columns</Text>
            <Group gap="xs">
              <Button
                variant="subtle"
                size="xs"
                onClick={handleSelectAll}
                aria-label="Select all"
              >
                Select All
              </Button>
              <Button
                variant="subtle"
                size="xs"
                onClick={handleClearAll}
                aria-label="Clear all"
              >
                Clear All
              </Button>
            </Group>
          </Group>

          <SimpleGrid cols={3} spacing="xs">
            {EXPORT_COLUMNS.map((column) => (
              <Checkbox
                key={column.key}
                label={column.label}
                aria-label={column.label}
                checked={selectedColumns.has(column.key)}
                onChange={() => handleColumnToggle(column.key)}
              />
            ))}
          </SimpleGrid>
        </Box>

        <Divider />

        {/* Summary */}
        <Box>
          <Text size="sm" c="dimmed">
            {selectedColumns.size} columns selected for {formattedCount} companies
          </Text>
        </Box>

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          <Button
            variant="subtle"
            onClick={onClose}
            leftSection={<IconX size={16} />}
            aria-label="Cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            loading={isLoading}
            disabled={selectedColumns.size === 0}
            leftSection={<IconDownload size={16} />}
            data-loading={isLoading ? 'true' : undefined}
            style={{
              background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE} 0%, ${COLORS.ALGOLIA_PURPLE} 100%)`,
            }}
            aria-label="Download"
          >
            Download {format.toUpperCase()}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default ExportModal;
