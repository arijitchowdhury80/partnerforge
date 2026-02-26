/**
 * ChangeTimeline Component
 *
 * Vertical timeline showing intelligence changes over time.
 * Includes significance badges, before/after comparison, and filtering.
 */

import { useState, useMemo } from 'react';
import {
  Paper,
  Text,
  Badge,
  Group,
  Stack,
  Select,
  MultiSelect,
  Box,
  ActionIcon,
  Collapse,
  Tooltip,
  ThemeIcon,
  Divider,
  TextInput,
  Skeleton,
  ScrollArea,
  Center,
  Button,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconChevronDown,
  IconChevronRight,
  IconArrowRight,
  IconFilter,
  IconSearch,
  IconX,
  IconCalendar,
  IconRefresh,
  IconExternalLink,
  IconAlertTriangle,
  IconInfoCircle,
  IconBulb,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ModuleId } from '@/types';
import { MODULE_CONFIGS } from './IntelligenceModules';

// =============================================================================
// Types
// =============================================================================

export type Significance = 'high' | 'medium' | 'low';

export interface ChangeEntry {
  id: string;
  domain: string;
  module_id: ModuleId;
  change_type: 'value_change' | 'status_change' | 'new_data' | 'data_removed';
  field: string;
  old_value?: string | number | null;
  new_value?: string | number | null;
  significance: Significance;
  detected_at: string;
  source_url?: string;
  description?: string;
}

interface ChangeTimelineProps {
  domain: string;
  changes: ChangeEntry[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const SIGNIFICANCE_CONFIG: Record<
  Significance,
  { color: string; icon: React.ElementType; label: string }
> = {
  high: { color: 'red', icon: IconAlertTriangle, label: 'High Impact' },
  medium: { color: 'yellow', icon: IconBulb, label: 'Medium Impact' },
  low: { color: 'blue', icon: IconInfoCircle, label: 'Low Impact' },
};

const CHANGE_TYPE_LABELS: Record<ChangeEntry['change_type'], string> = {
  value_change: 'Value Changed',
  status_change: 'Status Changed',
  new_data: 'New Data',
  data_removed: 'Data Removed',
};

// =============================================================================
// Change Card Component
// =============================================================================

interface ChangeCardProps {
  change: ChangeEntry;
  isFirst?: boolean;
  isLast?: boolean;
}

function ChangeCard({ change, isFirst = false, isLast = false }: ChangeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sigConfig = SIGNIFICANCE_CONFIG[change.significance];
  const SigIcon = sigConfig.icon;

  const moduleConfig = MODULE_CONFIGS.find((m) => m.id === change.module_id);
  const ModuleIcon = moduleConfig?.icon;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      time: date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      full: date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  };

  const dateInfo = formatDate(change.detected_at);

  const formatValue = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    return String(value);
  };

  return (
    <Box pos="relative">
      {/* Timeline Line */}
      <Box
        pos="absolute"
        left={20}
        top={isFirst ? 30 : 0}
        bottom={isLast ? 'auto' : 0}
        h={isLast ? 30 : undefined}
        w={2}
        style={{
          background: `linear-gradient(to bottom, rgba(100, 116, 139, ${
            isFirst ? '0' : '0.3'
          }), rgba(100, 116, 139, 0.3), rgba(100, 116, 139, ${
            isLast ? '0' : '0.3'
          }))`,
        }}
      />

      {/* Timeline Dot */}
      <Box
        pos="absolute"
        left={14}
        top={26}
        w={14}
        h={14}
        style={{
          borderRadius: '50%',
          background: `var(--mantine-color-${sigConfig.color}-6)`,
          border: '3px solid rgba(15, 23, 42, 1)',
          zIndex: 1,
        }}
      />

      {/* Card Content */}
      <motion.div
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        style={{ marginLeft: 48, paddingBottom: 16 }}
      >
        <Paper
          p="md"
          radius="md"
          style={{
            background: isExpanded
              ? 'rgba(15, 23, 42, 0.8)'
              : 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(10px)',
            border: `1px solid rgba(100, 116, 139, ${isExpanded ? '0.4' : '0.2'})`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Header */}
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon
                variant="light"
                color={sigConfig.color}
                size="md"
                radius="md"
              >
                <SigIcon size={16} />
              </ThemeIcon>
              <div>
                <Group gap="xs" mb={2}>
                  <Text size="sm" fw={600}>
                    {change.field}
                  </Text>
                  <Badge
                    size="xs"
                    variant="light"
                    color={sigConfig.color}
                  >
                    {sigConfig.label}
                  </Badge>
                </Group>
                <Group gap="xs">
                  {ModuleIcon && (
                    <ModuleIcon size={12} style={{ opacity: 0.7 }} />
                  )}
                  <Text size="xs" c="dimmed">
                    {moduleConfig?.shortName || change.module_id}
                  </Text>
                  <Text size="xs" c="dimmed">
                    |
                  </Text>
                  <Text size="xs" c="dimmed">
                    {CHANGE_TYPE_LABELS[change.change_type]}
                  </Text>
                </Group>
              </div>
            </Group>

            <Group gap="xs" wrap="nowrap">
              <Tooltip label={dateInfo.full}>
                <Stack gap={0} align="flex-end">
                  <Text size="xs" fw={500}>
                    {dateInfo.time}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {dateInfo.date}
                  </Text>
                </Stack>
              </Tooltip>
              <ActionIcon variant="subtle" size="sm" color="gray">
                {isExpanded ? (
                  <IconChevronDown size={14} />
                ) : (
                  <IconChevronRight size={14} />
                )}
              </ActionIcon>
            </Group>
          </Group>

          {/* Before/After Preview */}
          {change.change_type === 'value_change' && !isExpanded && (
            <Group gap="xs" mt="xs" ml={40}>
              <Text size="xs" c="dimmed" truncate style={{ maxWidth: 100 }}>
                {formatValue(change.old_value)}
              </Text>
              <IconArrowRight size={12} style={{ opacity: 0.5 }} />
              <Text size="xs" c="green" truncate style={{ maxWidth: 100 }}>
                {formatValue(change.new_value)}
              </Text>
            </Group>
          )}

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Divider my="sm" />

                {/* Description */}
                {change.description && (
                  <Text size="sm" c="dimmed" mb="sm">
                    {change.description}
                  </Text>
                )}

                {/* Before/After Comparison */}
                {(change.old_value !== undefined ||
                  change.new_value !== undefined) && (
                  <Paper
                    p="sm"
                    radius="sm"
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    <Group gap="md" grow>
                      <Stack gap={4}>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                          Before
                        </Text>
                        <Text
                          size="sm"
                          c={change.old_value ? undefined : 'dimmed'}
                          style={{
                            wordBreak: 'break-word',
                          }}
                        >
                          {formatValue(change.old_value)}
                        </Text>
                      </Stack>
                      <Box
                        style={{
                          width: 1,
                          background: 'rgba(100, 116, 139, 0.3)',
                          alignSelf: 'stretch',
                        }}
                      />
                      <Stack gap={4}>
                        <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                          After
                        </Text>
                        <Text
                          size="sm"
                          c={change.new_value ? 'green' : 'dimmed'}
                          style={{
                            wordBreak: 'break-word',
                          }}
                        >
                          {formatValue(change.new_value)}
                        </Text>
                      </Stack>
                    </Group>
                  </Paper>
                )}

                {/* Source Link */}
                {change.source_url && (
                  <Group gap="xs" mt="sm" justify="flex-end">
                    <Tooltip label="View source">
                      <ActionIcon
                        variant="light"
                        size="sm"
                        color="gray"
                        component="a"
                        href={change.source_url}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <IconExternalLink size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Paper>
      </motion.div>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ChangeTimeline({
  domain,
  changes,
  isLoading = false,
  onRefresh,
}: ChangeTimelineProps) {
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedSignificance, setSelectedSignificance] = useState<string | null>(
    null
  );
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);

  // Module options for filter
  const moduleOptions = MODULE_CONFIGS.map((m) => ({
    value: m.id,
    label: m.shortName,
  }));

  const significanceOptions = [
    { value: 'high', label: 'High Impact' },
    { value: 'medium', label: 'Medium Impact' },
    { value: 'low', label: 'Low Impact' },
  ];

  // Filter changes
  const filteredChanges = useMemo(() => {
    return changes.filter((change) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          change.field.toLowerCase().includes(query) ||
          change.description?.toLowerCase().includes(query) ||
          String(change.old_value).toLowerCase().includes(query) ||
          String(change.new_value).toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Module filter
      if (selectedModules.length > 0) {
        if (!selectedModules.includes(change.module_id)) return false;
      }

      // Significance filter
      if (selectedSignificance) {
        if (change.significance !== selectedSignificance) return false;
      }

      // Date range filter
      if (dateRange[0] || dateRange[1]) {
        const changeDate = new Date(change.detected_at);
        if (dateRange[0] && changeDate < dateRange[0]) return false;
        if (dateRange[1] && changeDate > dateRange[1]) return false;
      }

      return true;
    });
  }, [changes, searchQuery, selectedModules, selectedSignificance, dateRange]);

  // Group changes by date
  const groupedChanges = useMemo(() => {
    const groups: Record<string, ChangeEntry[]> = {};

    filteredChanges.forEach((change) => {
      const dateKey = new Date(change.detected_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(change);
    });

    // Sort by date descending
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [filteredChanges]);

  const hasActiveFilters =
    searchQuery ||
    selectedModules.length > 0 ||
    selectedSignificance ||
    dateRange[0] ||
    dateRange[1];

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedModules([]);
    setSelectedSignificance(null);
    setDateRange([null, null]);
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <Group justify="space-between">
          <Skeleton height={36} width={200} />
          <Skeleton height={36} width={100} />
        </Group>
        {[1, 2, 3].map((i) => (
          <Box key={i} pl={48}>
            <Skeleton height={100} radius="md" />
          </Box>
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Paper
        p="md"
        radius="md"
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <Group justify="space-between">
          <Group gap="md">
            <Text size="lg" fw={600}>
              Change Timeline
            </Text>
            <Badge variant="light" color="gray">
              {filteredChanges.length} changes
            </Badge>
            {hasActiveFilters && (
              <Tooltip label="Clear all filters">
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="sm"
                  onClick={clearFilters}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>

          <Group gap="xs">
            <Tooltip label="Toggle filters">
              <ActionIcon
                variant={showFilters ? 'filled' : 'light'}
                color="blue"
                onClick={() => setShowFilters(!showFilters)}
              >
                <IconFilter size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Refresh changes">
              <ActionIcon variant="light" color="gray" onClick={onRefresh}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        {/* Filters */}
        <Collapse in={showFilters}>
          <Divider my="sm" />
          <Group gap="md" grow>
            <TextInput
              placeholder="Search changes..."
              leftSection={<IconSearch size={14} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              size="sm"
            />
            <MultiSelect
              placeholder="Filter by module"
              data={moduleOptions}
              value={selectedModules}
              onChange={setSelectedModules}
              clearable
              size="sm"
            />
            <Select
              placeholder="Significance"
              data={significanceOptions}
              value={selectedSignificance}
              onChange={setSelectedSignificance}
              clearable
              size="sm"
            />
            <DatePickerInput
              type="range"
              placeholder="Date range"
              leftSection={<IconCalendar size={14} />}
              value={dateRange}
              onChange={setDateRange}
              clearable
              size="sm"
            />
          </Group>
        </Collapse>
      </Paper>

      {/* Timeline */}
      <ScrollArea.Autosize mah={600} offsetScrollbars>
        {filteredChanges.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="lg">
                No changes recorded
              </Text>
              <Text c="dimmed" size="sm">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'Changes will appear here as intelligence is updated'}
              </Text>
              {hasActiveFilters && (
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={clearFilters}
                  leftSection={<IconX size={14} />}
                >
                  Clear Filters
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <Stack gap="lg">
            {groupedChanges.map(([dateLabel, dateChanges]) => (
              <Box key={dateLabel}>
                {/* Date Header */}
                <Group gap="xs" mb="sm" ml={48}>
                  <IconCalendar size={14} style={{ opacity: 0.5 }} />
                  <Text size="sm" fw={500} c="dimmed">
                    {dateLabel}
                  </Text>
                  <Badge size="xs" variant="light" color="gray">
                    {dateChanges.length}
                  </Badge>
                </Group>

                {/* Changes for this date */}
                {dateChanges.map((change, index) => (
                  <ChangeCard
                    key={change.id}
                    change={change}
                    isFirst={index === 0}
                    isLast={index === dateChanges.length - 1}
                  />
                ))}
              </Box>
            ))}
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Stack>
  );
}

export type { ChangeEntry, ChangeTimelineProps };
