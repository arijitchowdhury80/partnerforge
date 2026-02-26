/**
 * ColumnMapper Component
 *
 * Auto-detect and map CSV columns with glassmorphism UI.
 * Allows users to confirm or override detected mappings.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Select, Text, Badge, Button, Group, Tooltip, Box } from '@mantine/core';
import {
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
  IconSparkles,
  IconRefresh,
} from '@tabler/icons-react';
import type { ColumnMapping } from '@/types';

interface ColumnMapperProps {
  listId: string;
  detectedMapping: ColumnMapping;
  csvHeaders: string[];
  sampleData?: Record<string, unknown>[];
  onConfirm: (mapping: ColumnMapping) => void;
  onBack?: () => void;
}

interface FieldConfig {
  key: keyof ColumnMapping;
  label: string;
  description: string;
  required: boolean;
  icon: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  {
    key: 'domain',
    label: 'Domain',
    description: 'Website domain (e.g., example.com)',
    required: true,
    icon: 'globe',
  },
  {
    key: 'company_name',
    label: 'Company Name',
    description: 'Display name of the company',
    required: false,
    icon: 'building',
  },
  {
    key: 'salesforce_id',
    label: 'Salesforce ID',
    description: '18-digit Account ID for CRM sync',
    required: false,
    icon: 'cloud',
  },
  {
    key: 'demandbase_id',
    label: 'Demandbase ID',
    description: 'ABM platform ID',
    required: false,
    icon: 'chart',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    description: 'Annual revenue (if available)',
    required: false,
    icon: 'currency',
  },
  {
    key: 'traffic',
    label: 'Traffic',
    description: 'Monthly website visits',
    required: false,
    icon: 'trending',
  },
  {
    key: 'industry',
    label: 'Industry',
    description: 'Company industry/vertical',
    required: false,
    icon: 'category',
  },
  {
    key: 'owner',
    label: 'Account Owner',
    description: 'Assigned sales representative',
    required: false,
    icon: 'user',
  },
  {
    key: 'region',
    label: 'Sales Region',
    description: 'Territory assignment',
    required: false,
    icon: 'map',
  },
  {
    key: 'journey_stage',
    label: 'Journey Stage',
    description: 'ABM journey stage',
    required: false,
    icon: 'journey',
  },
  {
    key: 'engagement_score',
    label: 'Engagement Score',
    description: 'Pre-existing engagement score',
    required: false,
    icon: 'score',
  },
];

export function ColumnMapper({
  listId,
  detectedMapping,
  csvHeaders,
  sampleData = [],
  onConfirm,
  onBack,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<ColumnMapping>(detectedMapping);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if required fields are mapped
  const isValid = useMemo(() => {
    return FIELD_CONFIGS.filter((f) => f.required).every(
      (f) => mapping[f.key] && mapping[f.key]!.trim() !== ''
    );
  }, [mapping]);

  // Get unmapped headers
  const unmappedHeaders = useMemo(() => {
    const mappedHeaders = Object.values(mapping).filter(Boolean);
    return csvHeaders.filter((h) => !mappedHeaders.includes(h));
  }, [mapping, csvHeaders]);

  // Get sample value for a column
  const getSampleValue = (header: string | undefined): string => {
    if (!header || sampleData.length === 0) return '';
    const value = sampleData[0][header];
    if (value === null || value === undefined) return '';
    const str = String(value);
    return str.length > 30 ? str.substring(0, 30) + '...' : str;
  };

  const handleFieldChange = (field: keyof ColumnMapping, value: string | null) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handleConfirm = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      // API call to confirm mapping
      const response = await fetch(`/api/v1/lists/${listId}/confirm-mapping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping }),
      });

      if (!response.ok) {
        throw new Error('Failed to confirm mapping');
      }

      onConfirm(mapping);
    } catch (error) {
      console.error('Mapping confirmation error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoDetect = () => {
    setMapping(detectedMapping);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text size="xl" fw={600} c="white">
            Column Mapping
          </Text>
          <Text size="sm" c="dimmed" mt={4}>
            We detected the following column mappings. Please verify or correct.
          </Text>
        </div>
        <Tooltip label="Re-detect columns automatically">
          <Button
            variant="subtle"
            size="sm"
            leftSection={<IconRefresh size={16} />}
            onClick={handleAutoDetect}
          >
            Auto-detect
          </Button>
        </Tooltip>
      </div>

      {/* Mapping status */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <IconSparkles size={20} className="text-purple-400" />
        <Text size="sm" c="white">
          {Object.values(mapping).filter(Boolean).length} of {csvHeaders.length} columns mapped
        </Text>
        {unmappedHeaders.length > 0 && (
          <Badge variant="light" color="yellow" size="sm">
            {unmappedHeaders.length} unmapped
          </Badge>
        )}
      </div>

      {/* Required fields section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Text size="sm" fw={600} c="white">
            Required Fields
          </Text>
          <Badge color="red" size="xs" variant="filled">
            Required
          </Badge>
        </div>

        {FIELD_CONFIGS.filter((f) => f.required).map((field, index) => (
          <FieldMappingRow
            key={field.key}
            field={field}
            currentMapping={mapping[field.key]}
            csvHeaders={csvHeaders}
            sampleValue={getSampleValue(mapping[field.key])}
            onChange={(value) => handleFieldChange(field.key, value)}
            index={index}
          />
        ))}
      </div>

      {/* Optional fields section */}
      <div className="space-y-4">
        <Text size="sm" fw={600} c="white">
          Optional Fields
        </Text>

        {FIELD_CONFIGS.filter((f) => !f.required).map((field, index) => (
          <FieldMappingRow
            key={field.key}
            field={field}
            currentMapping={mapping[field.key]}
            csvHeaders={csvHeaders}
            sampleValue={getSampleValue(mapping[field.key])}
            onChange={(value) => handleFieldChange(field.key, value)}
            index={index}
          />
        ))}
      </div>

      {/* Unmapped columns info */}
      {unmappedHeaders.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30"
        >
          <Text size="sm" fw={500} c="yellow.4" mb="xs">
            Unmapped Columns
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            These columns will be preserved but not actively used for enrichment:
          </Text>
          <div className="flex flex-wrap gap-2">
            {unmappedHeaders.map((header) => (
              <Badge key={header} variant="outline" color="gray" size="sm">
                {header}
              </Badge>
            ))}
          </div>
        </motion.div>
      )}

      {/* Action buttons */}
      <Group justify="space-between" pt="md">
        {onBack && (
          <Button variant="subtle" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          onClick={handleConfirm}
          disabled={!isValid}
          loading={isSubmitting}
          size="lg"
          rightSection={<IconArrowRight size={18} />}
          className={`
            ${isValid
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
              : 'bg-gray-600'
            } border-0 ml-auto
          `}
        >
          Confirm Mapping & Validate
        </Button>
      </Group>
    </motion.div>
  );
}

// Field mapping row component
interface FieldMappingRowProps {
  field: FieldConfig;
  currentMapping: string | undefined;
  csvHeaders: string[];
  sampleValue: string;
  onChange: (value: string | null) => void;
  index: number;
}

function FieldMappingRow({
  field,
  currentMapping,
  csvHeaders,
  sampleValue,
  onChange,
  index,
}: FieldMappingRowProps) {
  const isMapped = !!currentMapping;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`
        p-4 rounded-xl border transition-all duration-200
        ${isMapped
          ? 'bg-green-500/5 border-green-500/30'
          : field.required
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-white/5 border-white/10'
        }
      `}
    >
      <div className="flex items-center gap-4">
        {/* Field info */}
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2">
            <Text size="sm" fw={500} c="white">
              {field.label}
            </Text>
            {isMapped ? (
              <IconCheck size={16} className="text-green-400" />
            ) : field.required ? (
              <IconAlertTriangle size={16} className="text-red-400" />
            ) : null}
          </div>
          <Text size="xs" c="dimmed">
            {field.description}
          </Text>
        </div>

        {/* Arrow */}
        <IconArrowRight size={20} className="text-white/30 flex-shrink-0" />

        {/* Column selector */}
        <div className="flex-1 min-w-[200px]">
          <Select
            placeholder="Select column..."
            value={currentMapping || null}
            onChange={onChange}
            data={[
              { value: '', label: '-- Not mapped --' },
              ...csvHeaders.map((h) => ({ value: h, label: h })),
            ]}
            searchable
            clearable
            classNames={{
              input: `bg-white/5 border-white/20 text-white ${
                !isMapped && field.required ? 'border-red-500/50' : ''
              }`,
            }}
          />
        </div>

        {/* Sample value */}
        <div className="flex-1 min-w-[150px]">
          {sampleValue ? (
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <Text size="xs" c="dimmed" mb={2}>
                Sample:
              </Text>
              <Text size="sm" c="white" truncate>
                {sampleValue}
              </Text>
            </div>
          ) : (
            <Text size="xs" c="dimmed" fs="italic">
              No sample data
            </Text>
          )}
        </div>
      </div>
    </motion.div>
  );
}
