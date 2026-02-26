/**
 * AlertCenter Component
 *
 * Central hub for viewing and managing user alerts.
 * Features filtering, digest summary, bulk actions, and real-time updates.
 */

import { useState, useMemo } from 'react';
import {
  Paper,
  Text,
  Badge,
  Group,
  Stack,
  Select,
  TextInput,
  ActionIcon,
  Tooltip,
  Divider,
  ScrollArea,
  Center,
  Button,
  Checkbox,
  Menu,
  Box,
  Skeleton,
  Tabs,
  SegmentedControl,
  RingProgress,
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconCheck,
  IconCheckbox,
  IconTrash,
  IconDotsVertical,
  IconRefresh,
  IconBell,
  IconBellOff,
  IconAlertTriangle,
  IconBulb,
  IconInfoCircle,
  IconClock,
  IconChevronDown,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCard, type Alert, type AlertPriority, type AlertStatus } from './AlertCard';
import { MODULE_CONFIGS } from '@/components/company/IntelligenceModules';
import type { ModuleId } from '@/types';

// =============================================================================
// Types
// =============================================================================

interface AlertDigest {
  total: number;
  unread: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  by_module: Record<ModuleId, number>;
  recent_domains: string[];
}

interface AlertCenterProps {
  alerts: Alert[];
  isLoading?: boolean;
  onMarkRead?: (ids: string[]) => void;
  onMarkAllRead?: () => void;
  onDismiss?: (ids: string[]) => void;
  onRefresh?: () => void;
}

// =============================================================================
// Digest Card Component
// =============================================================================

interface DigestCardProps {
  digest: AlertDigest;
  onViewUnread?: () => void;
}

function DigestCard({ digest, onViewUnread }: DigestCardProps) {
  const readPercentage =
    digest.total > 0
      ? Math.round(((digest.total - digest.unread) / digest.total) * 100)
      : 100;

  return (
    <Paper
      p="lg"
      radius="lg"
      style={{
        background: 'linear-gradient(135deg, rgba(84, 104, 255, 0.15), rgba(15, 23, 42, 0.9))',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(84, 104, 255, 0.3)',
      }}
    >
      <Group justify="space-between" align="flex-start">
        {/* Left: Stats */}
        <Stack gap="md">
          <div>
            <Text size="sm" c="dimmed" mb={4}>
              Alert Summary
            </Text>
            <Group gap="lg">
              <div>
                <Text size="2rem" fw={700} lh={1}>
                  {digest.unread}
                </Text>
                <Text size="xs" c="dimmed">
                  Unread
                </Text>
              </div>
              <div>
                <Text size="2rem" fw={700} lh={1} c="dimmed">
                  {digest.total}
                </Text>
                <Text size="xs" c="dimmed">
                  Total
                </Text>
              </div>
            </Group>
          </div>

          {/* Priority Breakdown */}
          <Group gap="md">
            <Group gap={4}>
              <IconAlertTriangle size={14} color="var(--mantine-color-red-5)" />
              <Text size="sm" fw={500}>
                {digest.high_priority}
              </Text>
              <Text size="xs" c="dimmed">
                High
              </Text>
            </Group>
            <Group gap={4}>
              <IconBulb size={14} color="var(--mantine-color-yellow-5)" />
              <Text size="sm" fw={500}>
                {digest.medium_priority}
              </Text>
              <Text size="xs" c="dimmed">
                Medium
              </Text>
            </Group>
            <Group gap={4}>
              <IconInfoCircle size={14} color="var(--mantine-color-blue-5)" />
              <Text size="sm" fw={500}>
                {digest.low_priority}
              </Text>
              <Text size="xs" c="dimmed">
                Low
              </Text>
            </Group>
          </Group>
        </Stack>

        {/* Right: Ring Progress */}
        <Stack align="center" gap="xs">
          <RingProgress
            size={100}
            thickness={10}
            roundCaps
            sections={[
              {
                value: readPercentage,
                color: 'green',
                tooltip: `${readPercentage}% read`,
              },
            ]}
            label={
              <Center>
                <Text size="lg" fw={700}>
                  {readPercentage}%
                </Text>
              </Center>
            }
          />
          <Text size="xs" c="dimmed">
            Read
          </Text>
        </Stack>
      </Group>

      {/* Recent Activity */}
      {digest.recent_domains.length > 0 && (
        <>
          <Divider my="md" />
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Recent activity:
            </Text>
            {digest.recent_domains.slice(0, 3).map((domain) => (
              <Badge key={domain} variant="light" size="xs">
                {domain}
              </Badge>
            ))}
            {digest.recent_domains.length > 3 && (
              <Text size="xs" c="dimmed">
                +{digest.recent_domains.length - 3} more
              </Text>
            )}
          </Group>
        </>
      )}

      {/* CTA */}
      {digest.unread > 0 && (
        <Button
          variant="light"
          color="blue"
          size="sm"
          mt="md"
          fullWidth
          onClick={onViewUnread}
        >
          View {digest.unread} Unread Alert{digest.unread !== 1 ? 's' : ''}
        </Button>
      )}
    </Paper>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AlertCenter({
  alerts,
  isLoading = false,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onRefresh,
}: AlertCenterProps) {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  // Compute unique domains for filter
  const domainOptions = useMemo(() => {
    const domains = new Set(alerts.map((a) => a.domain));
    return Array.from(domains).map((d) => ({ value: d, label: d }));
  }, [alerts]);

  // Module options
  const moduleOptions = MODULE_CONFIGS.map((m) => ({
    value: m.id,
    label: m.shortName,
  }));

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          alert.message.toLowerCase().includes(query) ||
          alert.domain.toLowerCase().includes(query) ||
          alert.company_name?.toLowerCase().includes(query) ||
          alert.details?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Domain filter
      if (selectedDomain && alert.domain !== selectedDomain) return false;

      // Module filter
      if (selectedModule && alert.module_id !== selectedModule) return false;

      // Status filter
      if (statusFilter === 'unread' && alert.status !== 'unread') return false;
      if (statusFilter === 'read' && alert.status !== 'read') return false;

      // Priority filter
      if (priorityFilter && alert.priority !== priorityFilter) return false;

      return true;
    });
  }, [alerts, searchQuery, selectedDomain, selectedModule, statusFilter, priorityFilter]);

  // Compute digest
  const digest: AlertDigest = useMemo(() => {
    const unread = alerts.filter((a) => a.status === 'unread').length;
    const high = alerts.filter((a) => a.priority === 'high').length;
    const medium = alerts.filter((a) => a.priority === 'medium').length;
    const low = alerts.filter((a) => a.priority === 'low').length;

    const byModule: Record<ModuleId, number> = {} as Record<ModuleId, number>;
    alerts.forEach((a) => {
      byModule[a.module_id] = (byModule[a.module_id] || 0) + 1;
    });

    const recentDomains = Array.from(new Set(
      alerts
        .sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime())
        .slice(0, 10)
        .map((a) => a.domain)
    ));

    return {
      total: alerts.length,
      unread,
      high_priority: high,
      medium_priority: medium,
      low_priority: low,
      by_module: byModule,
      recent_domains: recentDomains,
    };
  }, [alerts]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map((a) => a.id)));
    }
  };

  const handleBulkMarkRead = () => {
    if (selectedIds.size > 0) {
      onMarkRead?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleBulkDismiss = () => {
    if (selectedIds.size > 0) {
      onDismiss?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedDomain(null);
    setSelectedModule(null);
    setStatusFilter('all');
    setPriorityFilter(null);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedDomain ||
    selectedModule ||
    statusFilter !== 'all' ||
    priorityFilter;

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={150} radius="lg" />
        <Skeleton height={60} radius="md" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={80} radius="md" />
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Digest Summary */}
      <DigestCard
        digest={digest}
        onViewUnread={() => setStatusFilter('unread')}
      />

      {/* Filters & Actions Bar */}
      <Paper
        p="md"
        radius="md"
        style={{
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <Text size="lg" fw={600}>
              Alerts
            </Text>
            <Badge variant="light" color="gray">
              {filteredAlerts.length}
            </Badge>
            {hasActiveFilters && (
              <Tooltip label="Clear filters">
                <Badge
                  variant="light"
                  color="blue"
                  style={{ cursor: 'pointer' }}
                  onClick={clearFilters}
                >
                  Filtered
                </Badge>
              </Tooltip>
            )}
          </Group>

          <Group gap="xs">
            {selectionMode && selectedIds.size > 0 && (
              <>
                <Button
                  variant="light"
                  size="xs"
                  leftSection={<IconCheck size={14} />}
                  onClick={handleBulkMarkRead}
                >
                  Mark Read ({selectedIds.size})
                </Button>
                <Button
                  variant="light"
                  size="xs"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={handleBulkDismiss}
                >
                  Dismiss ({selectedIds.size})
                </Button>
              </>
            )}
            <Tooltip label={selectionMode ? 'Exit selection mode' : 'Select multiple'}>
              <ActionIcon
                variant={selectionMode ? 'filled' : 'light'}
                color="blue"
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedIds(new Set());
                }}
              >
                <IconCheckbox size={16} />
              </ActionIcon>
            </Tooltip>
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="light" color="gray">
                  <IconDotsVertical size={16} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconCheck size={14} />}
                  onClick={onMarkAllRead}
                >
                  Mark All Read
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRefresh size={14} />}
                  onClick={onRefresh}
                >
                  Refresh Alerts
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconBellOff size={14} />}
                  color="red"
                >
                  Mute All
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Filter Controls */}
        <Group gap="sm">
          <TextInput
            placeholder="Search alerts..."
            leftSection={<IconSearch size={14} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            size="sm"
            style={{ flex: 1, minWidth: 150 }}
          />
          <Select
            placeholder="Domain"
            data={domainOptions}
            value={selectedDomain}
            onChange={setSelectedDomain}
            clearable
            size="sm"
            style={{ minWidth: 140 }}
          />
          <Select
            placeholder="Module"
            data={moduleOptions}
            value={selectedModule}
            onChange={setSelectedModule}
            clearable
            size="sm"
            style={{ minWidth: 120 }}
          />
          <SegmentedControl
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: 'all', label: 'All' },
              { value: 'unread', label: 'Unread' },
              { value: 'read', label: 'Read' },
            ]}
            size="xs"
          />
          <Select
            placeholder="Priority"
            data={[
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
            value={priorityFilter}
            onChange={setPriorityFilter}
            clearable
            size="sm"
            style={{ minWidth: 100 }}
          />
        </Group>
      </Paper>

      {/* Selection Header (when in selection mode) */}
      {selectionMode && (
        <Group gap="xs" px="md">
          <Checkbox
            checked={selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0}
            indeterminate={selectedIds.size > 0 && selectedIds.size < filteredAlerts.length}
            onChange={handleSelectAll}
            label={`Select all (${filteredAlerts.length})`}
            size="sm"
          />
        </Group>
      )}

      {/* Alert List */}
      <ScrollArea.Autosize mah={500} offsetScrollbars>
        {filteredAlerts.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconBell size={48} style={{ opacity: 0.3 }} />
              <Text c="dimmed" size="lg">
                No alerts found
              </Text>
              <Text c="dimmed" size="sm">
                {hasActiveFilters
                  ? 'Try adjusting your filters'
                  : 'You\'re all caught up!'}
              </Text>
              {hasActiveFilters && (
                <Button variant="subtle" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </Stack>
          </Center>
        ) : (
          <Stack gap="sm">
            <AnimatePresence mode="popLayout">
              {filteredAlerts.map((alert) => (
                <Group key={alert.id} gap="sm" wrap="nowrap">
                  {selectionMode && (
                    <Checkbox
                      checked={selectedIds.has(alert.id)}
                      onChange={() => handleToggleSelect(alert.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <Box style={{ flex: 1 }}>
                    <AlertCard
                      alert={alert}
                      onMarkRead={(id) => onMarkRead?.([id])}
                      onDismiss={(id) => onDismiss?.([id])}
                    />
                  </Box>
                </Group>
              ))}
            </AnimatePresence>
          </Stack>
        )}
      </ScrollArea.Autosize>
    </Stack>
  );
}

export type { AlertDigest, AlertCenterProps };
