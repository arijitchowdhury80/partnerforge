/**
 * ErrorNotification Component
 *
 * Displays user-friendly error messages with recovery actions.
 * Supports different error types with visual distinction.
 */

import { useState, useCallback } from 'react';
import {
  Alert,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Paper,
  List,
  ThemeIcon,
  CopyButton,
} from '@mantine/core';
import {
  IconX,
  IconRefresh,
  IconWifi,
  IconLock,
  IconClock,
  IconSearch,
  IconAlertTriangle,
  IconCheck,
  IconCopy,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react';
import { COLORS } from '@/lib/constants';
import type { EnrichmentErrorData, ErrorType } from '@/services/errorHandling';

// Re-export type for convenience
export type { EnrichmentErrorData as EnrichmentError } from '@/services/errorHandling';

// =============================================================================
// Types
// =============================================================================

interface ErrorNotificationProps {
  error: EnrichmentErrorData;
  onRetry?: () => void;
  onDismiss: () => void;
  onAction?: (action: string) => void;
}

// =============================================================================
// Configuration
// =============================================================================

interface ErrorTypeConfig {
  title: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
}

const errorTypeConfig: Record<ErrorType, ErrorTypeConfig> = {
  network: {
    title: 'Network Error',
    color: 'red',
    bgColor: '#fef2f2',
    icon: <IconWifi size={20} />,
  },
  rate_limit: {
    title: 'Rate Limit Exceeded',
    color: 'orange',
    bgColor: '#fff7ed',
    icon: <IconClock size={20} />,
  },
  auth: {
    title: 'Authentication Error',
    color: 'red',
    bgColor: '#fef2f2',
    icon: <IconLock size={20} />,
  },
  not_found: {
    title: 'Not Found',
    color: 'gray',
    bgColor: '#f9fafb',
    icon: <IconSearch size={20} />,
  },
  partial_success: {
    title: 'Partial Success',
    color: 'yellow',
    bgColor: '#fefce8',
    icon: <IconAlertTriangle size={20} />,
  },
  unknown: {
    title: 'Error',
    color: 'red',
    bgColor: '#fef2f2',
    icon: <IconAlertTriangle size={20} />,
  },
};

// =============================================================================
// Component
// =============================================================================

export function ErrorNotification({
  error,
  onRetry,
  onDismiss,
  onAction,
}: ErrorNotificationProps) {
  const [copyFeedback, setCopyFeedback] = useState(false);
  const config = errorTypeConfig[error.type];

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(error.errorCode);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy error code:', err);
    }
  }, [error.errorCode]);

  const handleActionClick = useCallback(
    (action: string) => {
      if (onAction) {
        onAction(action);
      }
    },
    [onAction]
  );

  // Determine if retry should be disabled (rate limit with retryAfter)
  const isRetryDisabled = error.type === 'rate_limit' && error.retryAfter && error.retryAfter > 0;

  return (
    <Alert
      role="alert"
      color={config.color}
      title={
        <Group gap="xs">
          {config.icon}
          <span>{config.title}</span>
        </Group>
      }
      withCloseButton
      onClose={onDismiss}
      closeButtonLabel="Close"
      styles={{
        root: {
          backgroundColor: config.bgColor,
          border: `1px solid ${config.color === 'red' ? COLORS.GRAY_300 : COLORS.GRAY_200}`,
        },
      }}
    >
      <Stack gap="md">
        {/* User-friendly message */}
        <Text size="sm" c={COLORS.GRAY_700}>
          {error.userMessage}
        </Text>

        {/* Partial success details */}
        {error.type === 'partial_success' && (
          <PartialSuccessDetails
            completedSources={error.completedSources || []}
            failedSources={error.failedSources || []}
          />
        )}

        {/* Rate limit timer */}
        {error.type === 'rate_limit' && error.retryAfter && (
          <Badge color="orange" variant="light" size="lg">
            <Group gap={4}>
              <IconClock size={14} />
              <span>Retry available in {formatSeconds(error.retryAfter)}</span>
            </Group>
          </Badge>
        )}

        {/* Suggested actions */}
        {error.suggestedActions.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {error.suggestedActions.map((action) => (
              <Button
                key={action}
                variant="light"
                size="xs"
                color={config.color}
                onClick={() => handleActionClick(action)}
              >
                {action}
              </Button>
            ))}
          </Group>
        )}

        {/* Error code and actions */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Error code: {error.errorCode}
            </Text>
            <Tooltip label={copyFeedback ? 'Copied!' : 'Copy error code'}>
              <ActionIcon
                variant="subtle"
                size="xs"
                color={copyFeedback ? 'green' : 'gray'}
                onClick={handleCopyCode}
                aria-label="Copy error code"
              >
                {copyFeedback ? <IconCheck size={12} /> : <IconCopy size={12} />}
              </ActionIcon>
            </Tooltip>
            {copyFeedback && (
              <Text size="xs" c="green">
                Copied!
              </Text>
            )}
          </Group>

          <Group gap="xs">
            {onRetry && (
              <Button
                variant="filled"
                size="xs"
                color={COLORS.ALGOLIA_NEBULA_BLUE}
                leftSection={<IconRefresh size={14} />}
                onClick={onRetry}
                disabled={isRetryDisabled}
                aria-label="Retry"
              >
                Retry
              </Button>
            )}
            <Button
              variant="subtle"
              size="xs"
              color="gray"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              Dismiss
            </Button>
          </Group>
        </Group>
      </Stack>
    </Alert>
  );
}

// =============================================================================
// Partial Success Details
// =============================================================================

interface PartialSuccessDetailsProps {
  completedSources: string[];
  failedSources: Array<{ source: string; reason: string }>;
}

function PartialSuccessDetails({
  completedSources,
  failedSources,
}: PartialSuccessDetailsProps) {
  if (completedSources.length === 0 && failedSources.length === 0) {
    return null;
  }

  return (
    <Paper p="sm" withBorder radius="sm" bg="white">
      <Stack gap="sm">
        {/* Summary counts */}
        <Group gap="md">
          {completedSources.length > 0 && (
            <Badge color="green" variant="light">
              {completedSources.length} succeeded
            </Badge>
          )}
          {failedSources.length > 0 && (
            <Badge color="red" variant="light">
              {failedSources.length} failed
            </Badge>
          )}
        </Group>

        {/* Completed sources */}
        {completedSources.length > 0 && (
          <div>
            <Text size="xs" fw={600} c={COLORS.GRAY_600} mb={4}>
              Completed Sources
            </Text>
            <List
              size="xs"
              spacing={2}
              icon={
                <ThemeIcon color="green" size={16} radius="xl">
                  <IconCircleCheck size={12} />
                </ThemeIcon>
              }
            >
              {completedSources.map((source) => (
                <List.Item key={source}>
                  <Text size="xs" c={COLORS.GRAY_700}>
                    {source}
                  </Text>
                </List.Item>
              ))}
            </List>
          </div>
        )}

        {/* Failed sources */}
        {failedSources.length > 0 && (
          <div>
            <Text size="xs" fw={600} c={COLORS.GRAY_600} mb={4}>
              Failed Sources
            </Text>
            <List
              size="xs"
              spacing={2}
              icon={
                <ThemeIcon color="red" size={16} radius="xl">
                  <IconCircleX size={12} />
                </ThemeIcon>
              }
            >
              {failedSources.map(({ source, reason }) => (
                <List.Item key={source}>
                  <Group gap={4}>
                    <Text size="xs" fw={500} c={COLORS.GRAY_700}>
                      {source}:
                    </Text>
                    <Text size="xs" c={COLORS.GRAY_500}>
                      {reason}
                    </Text>
                  </Group>
                </List.Item>
              ))}
            </List>
          </div>
        )}
      </Stack>
    </Paper>
  );
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatSeconds(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  return `${seconds} second${seconds !== 1 ? 's' : ''}`;
}

// =============================================================================
// Exports
// =============================================================================

export default ErrorNotification;
