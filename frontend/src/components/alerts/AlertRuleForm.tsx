/**
 * AlertRuleForm Component
 *
 * Form for creating and editing alert rules.
 * Supports domain selection, module multi-select, threshold configuration,
 * and notification channel selection.
 */

import { useState, useEffect } from 'react';
import {
  Paper,
  Text,
  TextInput,
  Select,
  MultiSelect,
  NumberInput,
  Switch,
  Button,
  Group,
  Stack,
  Divider,
  Badge,
  Tooltip,
  ActionIcon,
  Collapse,
  ThemeIcon,
  Checkbox,
  Radio,
  Box,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconPlus,
  IconTrash,
  IconBell,
  IconMail,
  IconBrandSlack,
  IconWebhook,
  IconChevronDown,
  IconChevronRight,
  IconAlertTriangle,
  IconBulb,
  IconInfoCircle,
  IconBuilding,
  IconX,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ModuleId } from '@/types';
import { MODULE_CONFIGS } from '@/components/company/IntelligenceModules';

// =============================================================================
// Types
// =============================================================================

export type NotificationChannel = 'in_app' | 'email' | 'slack' | 'webhook';
export type ThresholdOperator = 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte' | 'contains' | 'not_contains';

export interface ThresholdCondition {
  field: string;
  operator: ThresholdOperator;
  value: string | number;
}

export interface AlertRule {
  id?: string;
  name: string;
  description?: string;
  domains: string[] | 'all';
  modules: ModuleId[];
  change_types: ('value_change' | 'status_change' | 'new_data' | 'data_removed')[];
  priority: 'high' | 'medium' | 'low' | 'any';
  thresholds: ThresholdCondition[];
  channels: NotificationChannel[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface AlertRuleFormProps {
  initialValues?: Partial<AlertRule>;
  availableDomains: { value: string; label: string }[];
  onSubmit: (rule: AlertRule) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const CHANGE_TYPE_OPTIONS = [
  { value: 'value_change', label: 'Value Changes' },
  { value: 'status_change', label: 'Status Changes' },
  { value: 'new_data', label: 'New Data' },
  { value: 'data_removed', label: 'Data Removed' },
];

const PRIORITY_OPTIONS = [
  { value: 'any', label: 'Any Priority' },
  { value: 'high', label: 'High Only' },
  { value: 'medium', label: 'Medium & Above' },
  { value: 'low', label: 'All Priorities' },
];

const OPERATOR_OPTIONS = [
  { value: 'gt', label: 'Greater than (>)' },
  { value: 'lt', label: 'Less than (<)' },
  { value: 'gte', label: 'Greater or equal (>=)' },
  { value: 'lte', label: 'Less or equal (<=)' },
  { value: 'eq', label: 'Equals (=)' },
  { value: 'ne', label: 'Not equals (!=)' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
];

const CHANNEL_CONFIG: Record<
  NotificationChannel,
  { icon: React.ElementType; label: string; color: string }
> = {
  in_app: { icon: IconBell, label: 'In-App', color: 'blue' },
  email: { icon: IconMail, label: 'Email', color: 'green' },
  slack: { icon: IconBrandSlack, label: 'Slack', color: 'violet' },
  webhook: { icon: IconWebhook, label: 'Webhook', color: 'orange' },
};

// =============================================================================
// Threshold Condition Component
// =============================================================================

interface ThresholdRowProps {
  condition: ThresholdCondition;
  index: number;
  onChange: (index: number, condition: ThresholdCondition) => void;
  onRemove: (index: number) => void;
}

function ThresholdRow({ condition, index, onChange, onRemove }: ThresholdRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Group gap="sm" align="flex-end" mb="xs">
        <TextInput
          label={index === 0 ? 'Field' : undefined}
          placeholder="e.g., monthly_visits"
          value={condition.field}
          onChange={(e) =>
            onChange(index, { ...condition, field: e.currentTarget.value })
          }
          size="sm"
          style={{ flex: 2 }}
        />
        <Select
          label={index === 0 ? 'Operator' : undefined}
          data={OPERATOR_OPTIONS}
          value={condition.operator}
          onChange={(value) =>
            onChange(index, {
              ...condition,
              operator: (value as ThresholdOperator) || 'gt',
            })
          }
          size="sm"
          style={{ flex: 2 }}
        />
        <TextInput
          label={index === 0 ? 'Value' : undefined}
          placeholder="e.g., 1000000"
          value={String(condition.value)}
          onChange={(e) =>
            onChange(index, {
              ...condition,
              value: isNaN(Number(e.currentTarget.value))
                ? e.currentTarget.value
                : Number(e.currentTarget.value),
            })
          }
          size="sm"
          style={{ flex: 2 }}
        />
        <Tooltip label="Remove condition">
          <ActionIcon
            variant="subtle"
            color="red"
            size="lg"
            onClick={() => onRemove(index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AlertRuleForm({
  initialValues,
  availableDomains,
  onSubmit,
  onCancel,
  isLoading = false,
}: AlertRuleFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [watchAllDomains, setWatchAllDomains] = useState(
    initialValues?.domains === 'all'
  );

  // Module options
  const moduleOptions = MODULE_CONFIGS.map((m) => ({
    value: m.id,
    label: `${m.shortName} - ${m.name}`,
    group: `Wave ${m.wave}`,
  }));

  // Form setup
  const form = useForm<AlertRule>({
    initialValues: {
      name: '',
      description: '',
      domains: [],
      modules: [],
      change_types: ['value_change'],
      priority: 'any',
      thresholds: [],
      channels: ['in_app'],
      is_active: true,
      ...initialValues,
    },
    validate: {
      name: (value) => (value.length < 3 ? 'Name must be at least 3 characters' : null),
      modules: (value) => (value.length === 0 ? 'Select at least one module' : null),
      change_types: (value) =>
        value.length === 0 ? 'Select at least one change type' : null,
      channels: (value) =>
        value.length === 0 ? 'Select at least one notification channel' : null,
    },
  });

  // Update domains when watchAllDomains changes
  useEffect(() => {
    if (watchAllDomains) {
      form.setFieldValue('domains', 'all');
    } else if (form.values.domains === 'all') {
      form.setFieldValue('domains', []);
    }
  }, [watchAllDomains]);

  // Threshold handlers
  const addThreshold = () => {
    form.setFieldValue('thresholds', [
      ...form.values.thresholds,
      { field: '', operator: 'gt' as ThresholdOperator, value: '' },
    ]);
  };

  const updateThreshold = (index: number, condition: ThresholdCondition) => {
    const newThresholds = [...form.values.thresholds];
    newThresholds[index] = condition;
    form.setFieldValue('thresholds', newThresholds);
  };

  const removeThreshold = (index: number) => {
    form.setFieldValue(
      'thresholds',
      form.values.thresholds.filter((_, i) => i !== index)
    );
  };

  // Channel toggle handler
  const toggleChannel = (channel: NotificationChannel) => {
    const current = form.values.channels;
    if (current.includes(channel)) {
      form.setFieldValue(
        'channels',
        current.filter((c) => c !== channel)
      );
    } else {
      form.setFieldValue('channels', [...current, channel]);
    }
  };

  const handleSubmit = form.onSubmit((values) => {
    onSubmit(values);
  });

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      p="lg"
      radius="lg"
      style={{
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(100, 116, 139, 0.2)',
      }}
    >
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Text size="lg" fw={600}>
              {initialValues?.id ? 'Edit Alert Rule' : 'Create Alert Rule'}
            </Text>
            <Text size="sm" c="dimmed">
              Get notified when intelligence data changes
            </Text>
          </div>
          <Switch
            label="Active"
            checked={form.values.is_active}
            onChange={(e) => form.setFieldValue('is_active', e.currentTarget.checked)}
          />
        </Group>

        <Divider />

        {/* Basic Info */}
        <Stack gap="md">
          <TextInput
            label="Rule Name"
            placeholder="e.g., High Traffic Alert"
            required
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Description"
            placeholder="Optional description for this rule"
            {...form.getInputProps('description')}
          />
        </Stack>

        <Divider />

        {/* Domain Selection */}
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Watch Domains
          </Text>
          <Checkbox
            label="Watch all domains"
            checked={watchAllDomains}
            onChange={(e) => setWatchAllDomains(e.currentTarget.checked)}
          />
          {!watchAllDomains && (
            <MultiSelect
              placeholder="Select specific domains to watch"
              data={availableDomains}
              value={form.values.domains === 'all' ? [] : form.values.domains}
              onChange={(value) => form.setFieldValue('domains', value)}
              searchable
              clearable
              maxDropdownHeight={200}
            />
          )}
        </Stack>

        <Divider />

        {/* Module Selection */}
        <MultiSelect
          label="Intelligence Modules"
          placeholder="Select modules to monitor"
          data={moduleOptions}
          required
          searchable
          maxDropdownHeight={250}
          {...form.getInputProps('modules')}
        />

        {/* Change Types */}
        <MultiSelect
          label="Change Types"
          placeholder="Select types of changes to monitor"
          data={CHANGE_TYPE_OPTIONS}
          required
          {...form.getInputProps('change_types')}
        />

        {/* Priority Filter */}
        <Select
          label="Minimum Priority"
          description="Only alert for changes at or above this priority"
          data={PRIORITY_OPTIONS}
          {...form.getInputProps('priority')}
        />

        <Divider />

        {/* Notification Channels */}
        <Stack gap="sm">
          <Text size="sm" fw={500}>
            Notification Channels
          </Text>
          <Group gap="md">
            {(Object.keys(CHANNEL_CONFIG) as NotificationChannel[]).map((channel) => {
              const config = CHANNEL_CONFIG[channel];
              const Icon = config.icon;
              const isSelected = form.values.channels.includes(channel);

              return (
                <Paper
                  key={channel}
                  p="sm"
                  radius="md"
                  style={{
                    background: isSelected
                      ? `rgba(var(--mantine-color-${config.color}-9-rgb), 0.2)`
                      : 'rgba(0, 0, 0, 0.2)',
                    border: `1px solid ${
                      isSelected
                        ? `var(--mantine-color-${config.color}-6)`
                        : 'rgba(100, 116, 139, 0.2)'
                    }`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => toggleChannel(channel)}
                >
                  <Group gap="xs">
                    <ThemeIcon
                      variant={isSelected ? 'filled' : 'light'}
                      color={config.color}
                      size="md"
                    >
                      <Icon size={16} />
                    </ThemeIcon>
                    <Text size="sm" fw={isSelected ? 600 : 400}>
                      {config.label}
                    </Text>
                  </Group>
                </Paper>
              );
            })}
          </Group>
          {form.errors.channels && (
            <Text size="xs" c="red">
              {form.errors.channels}
            </Text>
          )}
        </Stack>

        {/* Advanced Options */}
        <Box>
          <Group
            gap="xs"
            style={{ cursor: 'pointer' }}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? (
              <IconChevronDown size={16} />
            ) : (
              <IconChevronRight size={16} />
            )}
            <Text size="sm" fw={500}>
              Advanced Options
            </Text>
            {form.values.thresholds.length > 0 && (
              <Badge size="xs" variant="light" color="blue">
                {form.values.thresholds.length} threshold
                {form.values.thresholds.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </Group>

          <Collapse in={showAdvanced}>
            <Paper
              p="md"
              mt="sm"
              radius="md"
              style={{ background: 'rgba(0, 0, 0, 0.2)' }}
            >
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Text size="sm" fw={500}>
                      Threshold Conditions
                    </Text>
                    <Text size="xs" c="dimmed">
                      Only alert when specific conditions are met
                    </Text>
                  </div>
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconPlus size={14} />}
                    onClick={addThreshold}
                  >
                    Add Condition
                  </Button>
                </Group>

                <AnimatePresence>
                  {form.values.thresholds.map((threshold, index) => (
                    <ThresholdRow
                      key={index}
                      condition={threshold}
                      index={index}
                      onChange={updateThreshold}
                      onRemove={removeThreshold}
                    />
                  ))}
                </AnimatePresence>

                {form.values.thresholds.length === 0 && (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No threshold conditions. All matching changes will trigger alerts.
                  </Text>
                )}
              </Stack>
            </Paper>
          </Collapse>
        </Box>

        <Divider />

        {/* Actions */}
        <Group justify="flex-end" gap="sm">
          {onCancel && (
            <Button variant="subtle" color="gray" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" loading={isLoading}>
            {initialValues?.id ? 'Save Changes' : 'Create Rule'}
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export type { AlertRuleFormProps };
