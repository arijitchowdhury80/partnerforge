/**
 * AlertCard Component
 *
 * Single alert card component for displaying intelligence alerts.
 * Shows domain, module, change type, timestamp with expandable details.
 */

import { useState } from 'react';
import {
  Paper,
  Text,
  Badge,
  Group,
  Stack,
  ActionIcon,
  Collapse,
  Tooltip,
  ThemeIcon,
  Divider,
  Anchor,
  Box,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconCheck,
  IconX,
  IconExternalLink,
  IconEye,
  IconClock,
  IconAlertTriangle,
  IconBulb,
  IconInfoCircle,
  IconBuilding,
} from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { ModuleId } from '@/types';
import { MODULE_CONFIGS } from '@/components/company/IntelligenceModules';

// =============================================================================
// Types
// =============================================================================

export type AlertPriority = 'high' | 'medium' | 'low';
export type AlertStatus = 'unread' | 'read' | 'dismissed';

export interface Alert {
  id: string;
  domain: string;
  company_name?: string;
  module_id: ModuleId;
  change_type: 'value_change' | 'status_change' | 'new_data' | 'data_removed' | 'threshold_crossed';
  field: string;
  old_value?: string | number | null;
  new_value?: string | number | null;
  priority: AlertPriority;
  status: AlertStatus;
  message: string;
  details?: string;
  detected_at: string;
  read_at?: string;
  source_url?: string;
  rule_id?: string;
  rule_name?: string;
}

interface AlertCardProps {
  alert: Alert;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onViewCompany?: (domain: string) => void;
  compact?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const PRIORITY_CONFIG: Record<
  AlertPriority,
  { color: string; icon: React.ElementType; label: string }
> = {
  high: { color: 'red', icon: IconAlertTriangle, label: 'High Priority' },
  medium: { color: 'yellow', icon: IconBulb, label: 'Medium Priority' },
  low: { color: 'blue', icon: IconInfoCircle, label: 'Low Priority' },
};

const CHANGE_TYPE_LABELS: Record<Alert['change_type'], string> = {
  value_change: 'Value Changed',
  status_change: 'Status Changed',
  new_data: 'New Data',
  data_removed: 'Data Removed',
  threshold_crossed: 'Threshold Crossed',
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatTimestamp(dateStr: string): { relative: string; full: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let relative: string;
  if (diffMins < 1) {
    relative = 'Just now';
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`;
  } else {
    relative = date.toLocaleDateString();
  }

  const full = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return { relative, full };
}

// =============================================================================
// Component
// =============================================================================

export function AlertCard({
  alert,
  onMarkRead,
  onDismiss,
  onViewCompany,
  compact = false,
}: AlertCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const priorityConfig = PRIORITY_CONFIG[alert.priority];
  const PriorityIcon = priorityConfig.icon;
  const moduleConfig = MODULE_CONFIGS.find((m) => m.id === alert.module_id);
  const ModuleIcon = moduleConfig?.icon;
  const timestamp = formatTimestamp(alert.detected_at);

  const isUnread = alert.status === 'unread';

  const handleToggleExpand = () => {
    if (!compact) {
      setIsExpanded(!isExpanded);
    }
    // Mark as read when expanded
    if (!isExpanded && isUnread && onMarkRead) {
      onMarkRead(alert.id);
    }
  };

  const handleViewCompany = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onViewCompany) {
      onViewCompany(alert.domain);
    } else {
      navigate(`/company/${alert.domain}`);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
    >
      <Paper
        p={compact ? 'sm' : 'md'}
        radius="md"
        style={{
          background: isUnread
            ? 'rgba(84, 104, 255, 0.08)'
            : 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(10px)',
          border: `1px solid rgba(${isUnread ? '84, 104, 255' : '100, 116, 139'}, ${
            isUnread ? '0.3' : '0.2'
          })`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onClick={handleToggleExpand}
      >
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          {/* Left Section */}
          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
            {/* Priority Indicator */}
            <ThemeIcon
              variant="light"
              color={priorityConfig.color}
              size={compact ? 'sm' : 'md'}
              radius="md"
            >
              <PriorityIcon size={compact ? 14 : 16} />
            </ThemeIcon>

            {/* Content */}
            <div style={{ minWidth: 0, flex: 1 }}>
              {/* Header Line */}
              <Group gap="xs" mb={2} wrap="nowrap">
                {isUnread && (
                  <Box
                    w={8}
                    h={8}
                    style={{
                      borderRadius: '50%',
                      background: 'var(--mantine-color-blue-5)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <Text
                  size={compact ? 'xs' : 'sm'}
                  fw={isUnread ? 600 : 500}
                  truncate
                  style={{ flex: 1 }}
                >
                  {alert.message}
                </Text>
              </Group>

              {/* Meta Line */}
              <Group gap="xs" wrap="nowrap">
                <Tooltip label="View company">
                  <Anchor
                    size="xs"
                    c="dimmed"
                    onClick={handleViewCompany}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <IconBuilding size={12} />
                    {alert.company_name || alert.domain}
                  </Anchor>
                </Tooltip>
                <Text size="xs" c="dimmed">
                  |
                </Text>
                <Group gap={4} wrap="nowrap">
                  {ModuleIcon && <ModuleIcon size={12} style={{ opacity: 0.7 }} />}
                  <Text size="xs" c="dimmed">
                    {moduleConfig?.shortName || alert.module_id}
                  </Text>
                </Group>
                {alert.rule_name && (
                  <>
                    <Text size="xs" c="dimmed">
                      |
                    </Text>
                    <Badge size="xs" variant="dot" color="gray">
                      {alert.rule_name}
                    </Badge>
                  </>
                )}
              </Group>
            </div>
          </Group>

          {/* Right Section */}
          <Group gap="xs" wrap="nowrap">
            <Tooltip label={timestamp.full}>
              <Group gap={4} wrap="nowrap">
                <IconClock size={12} style={{ opacity: 0.5 }} />
                <Text size="xs" c="dimmed">
                  {timestamp.relative}
                </Text>
              </Group>
            </Tooltip>

            {!compact && (
              <Group gap={4} wrap="nowrap">
                <Tooltip label={isUnread ? 'Mark as read' : 'Already read'}>
                  <ActionIcon
                    variant="subtle"
                    color={isUnread ? 'blue' : 'gray'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isUnread && onMarkRead) {
                        onMarkRead(alert.id);
                      }
                    }}
                    disabled={!isUnread}
                  >
                    <IconCheck size={14} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Dismiss">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss?.(alert.id);
                    }}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
                <ActionIcon variant="subtle" color="gray" size="sm">
                  {isExpanded ? (
                    <IconChevronDown size={14} />
                  ) : (
                    <IconChevronRight size={14} />
                  )}
                </ActionIcon>
              </Group>
            )}
          </Group>
        </Group>

        {/* Expanded Content */}
        {!compact && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Divider my="sm" />

                <Stack gap="sm">
                  {/* Details */}
                  {alert.details && (
                    <Text size="sm" c="dimmed">
                      {alert.details}
                    </Text>
                  )}

                  {/* Value Change */}
                  {(alert.old_value !== undefined ||
                    alert.new_value !== undefined) && (
                    <Paper
                      p="sm"
                      radius="sm"
                      style={{ background: 'rgba(0, 0, 0, 0.2)' }}
                    >
                      <Group gap="md">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed" tt="uppercase">
                            Previous
                          </Text>
                          <Text size="sm" c={alert.old_value ? undefined : 'dimmed'}>
                            {alert.old_value ?? '(none)'}
                          </Text>
                        </Stack>
                        <Box
                          style={{
                            width: 1,
                            height: 40,
                            background: 'rgba(100, 116, 139, 0.3)',
                          }}
                        />
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed" tt="uppercase">
                            Current
                          </Text>
                          <Text
                            size="sm"
                            c={alert.new_value ? 'green' : 'dimmed'}
                          >
                            {alert.new_value ?? '(none)'}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  )}

                  {/* Change Type Badge */}
                  <Group gap="xs">
                    <Badge variant="light" color={priorityConfig.color} size="sm">
                      {priorityConfig.label}
                    </Badge>
                    <Badge variant="outline" color="gray" size="sm">
                      {CHANGE_TYPE_LABELS[alert.change_type]}
                    </Badge>
                  </Group>

                  {/* Actions */}
                  <Group gap="xs" justify="flex-end">
                    <Tooltip label="View company details">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        size="sm"
                        onClick={handleViewCompany}
                      >
                        <IconEye size={14} />
                      </ActionIcon>
                    </Tooltip>
                    {alert.source_url && (
                      <Tooltip label="View source">
                        <ActionIcon
                          variant="light"
                          color="gray"
                          size="sm"
                          component="a"
                          href={alert.source_url}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconExternalLink size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Stack>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </Paper>
    </motion.div>
  );
}

export type { AlertCardProps };
