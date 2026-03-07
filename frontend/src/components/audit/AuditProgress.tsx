/**
 * AuditProgress - Real-time Audit Progress Tracker
 *
 * Connects to WebSocket for live audit updates.
 * Displays 4 phase cards with progress bars and status badges.
 */

import { useEffect, useState, useRef } from 'react';
import {
  Paper,
  Stack,
  Group,
  Text,
  Progress,
  Badge,
  Card,
  Timeline,
  ThemeIcon,
  RingProgress,
  Center,
  Button,
  Alert,
  Box,
} from '@mantine/core';
import {
  IconCheck,
  IconLoader,
  IconAlertCircle,
  IconClock,
  IconDatabase,
  IconSearch,
  IconBrain,
  IconFileText,
  IconExternalLink,
} from '@tabler/icons-react';
import { io, Socket } from 'socket.io-client';

interface AuditPhase {
  phase: string;
  percent: number;
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface AuditProgressProps {
  auditId: string;
  onComplete?: () => void;
}

interface ProgressUpdate {
  phase: string;
  percent: number;
  message: string;
}

export function AuditProgress({ auditId, onComplete }: AuditProgressProps) {
  const [phases, setPhases] = useState<AuditPhase[]>([
    {
      phase: 'enrichment',
      percent: 25,
      message: 'Collecting company data',
      status: 'pending',
    },
    {
      phase: 'search-audit',
      percent: 50,
      message: 'Running search tests',
      status: 'pending',
    },
    {
      phase: 'strategic-analysis',
      percent: 75,
      message: 'Analyzing opportunities',
      status: 'pending',
    },
    {
      phase: 'deliverables',
      percent: 100,
      message: 'Generating reports',
      status: 'pending',
    },
  ]);

  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('initialization');
  const [currentMessage, setCurrentMessage] = useState('Initializing audit...');
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');

    console.log('Connecting to WebSocket:', wsUrl);

    const socket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('WebSocket connected', socket.id);
      setIsConnected(true);

      // Subscribe to audit updates
      socket.emit('subscribe:audit', auditId);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err);
      setError('Failed to connect to real-time updates');
    });

    // Subscription events
    socket.on('subscribed', (data) => {
      console.log('Subscribed to audit:', data);
      setCurrentPhase(data.current_phase || 'initialization');
      setCurrentProgress(data.progress_percent || 0);
    });

    // Progress events
    socket.on('audit:event', (event) => {
      console.log('Audit event:', event);

      if (event.type === 'audit:started') {
        setCurrentMessage('Audit started');
      } else if (event.type === 'test:started' && event.data?.progress) {
        const { percentage, message } = event.data.progress;
        setCurrentProgress(percentage);
        if (message) {
          setCurrentMessage(message);
        }
      } else if (event.type === 'audit:completed') {
        setIsComplete(true);
        setCurrentProgress(100);
        setCurrentMessage('Audit completed successfully!');
        if (onComplete) {
          onComplete();
        }
      } else if (event.type === 'audit:error') {
        setError(event.data?.error || 'An error occurred during the audit');
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:audit', auditId);
        socketRef.current.disconnect();
      }
    };
  }, [auditId, onComplete]);

  // Update phase statuses based on current progress
  useEffect(() => {
    setPhases((prev) =>
      prev.map((phase) => {
        if (currentProgress >= phase.percent) {
          return { ...phase, status: 'completed' };
        } else if (phase.phase === currentPhase) {
          return { ...phase, status: 'running' };
        } else if (currentProgress < phase.percent) {
          return { ...phase, status: 'pending' };
        }
        return phase;
      })
    );
  }, [currentProgress, currentPhase]);

  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'enrichment':
        return IconDatabase;
      case 'search-audit':
        return IconSearch;
      case 'strategic-analysis':
        return IconBrain;
      case 'deliverables':
        return IconFileText;
      default:
        return IconClock;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>
            Completed
          </Badge>
        );
      case 'running':
        return (
          <Badge color="blue" variant="light" leftSection={<IconLoader size={12} />}>
            Running
          </Badge>
        );
      case 'failed':
        return (
          <Badge color="red" variant="light" leftSection={<IconAlertCircle size={12} />}>
            Failed
          </Badge>
        );
      default:
        return (
          <Badge color="gray" variant="light" leftSection={<IconClock size={12} />}>
            Pending
          </Badge>
        );
    }
  };

  return (
    <Stack gap="lg">
      {/* Connection Status */}
      {!isConnected && !error && (
        <Alert icon={<IconLoader size={16} />} color="blue" variant="light">
          Connecting to real-time updates...
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" title="Error">
          {error}
        </Alert>
      )}

      {/* Overall Progress */}
      <Card shadow="sm" padding="lg" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="lg" fw={600}>
              Audit Progress
            </Text>
            {getStatusBadge(isComplete ? 'completed' : phases.find((p) => p.status === 'running') ? 'running' : 'pending')}
          </Group>

          <Center>
            <RingProgress
              size={180}
              thickness={16}
              sections={[{ value: currentProgress, color: 'blue' }]}
              label={
                <Center>
                  <Stack gap={0} align="center">
                    <Text size="xl" fw={700}>
                      {currentProgress}%
                    </Text>
                    <Text size="xs" c="dimmed">
                      Complete
                    </Text>
                  </Stack>
                </Center>
              }
            />
          </Center>

          <Box>
            <Text size="sm" c="dimmed" mb={4}>
              {currentMessage}
            </Text>
            <Progress value={currentProgress} size="lg" animated={!isComplete} />
          </Box>
        </Stack>
      </Card>

      {/* Phase Cards */}
      <Timeline active={phases.findIndex((p) => p.status === 'running')} bulletSize={24}>
        {phases.map((phase, index) => {
          const Icon = getPhaseIcon(phase.phase);

          return (
            <Timeline.Item
              key={phase.phase}
              bullet={<Icon size={16} />}
              title={
                <Group justify="space-between">
                  <Text fw={500}>{phase.message}</Text>
                  {getStatusBadge(phase.status)}
                </Group>
              }
            >
              <Card mt="xs" padding="sm" radius="sm" withBorder>
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">
                    Phase {index + 1} of {phases.length}
                  </Text>
                  <Progress
                    value={phase.status === 'completed' ? 100 : phase.status === 'running' ? 50 : 0}
                    size="sm"
                    color={phase.status === 'failed' ? 'red' : 'blue'}
                    animated={phase.status === 'running'}
                  />
                </Stack>
              </Card>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {/* Complete Actions */}
      {isComplete && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Stack gap={0}>
              <Text size="lg" fw={600}>
                Audit Complete!
              </Text>
              <Text size="sm" c="dimmed">
                All phases completed successfully
              </Text>
            </Stack>
            <Button rightSection={<IconExternalLink size={16} />} variant="filled">
              View Results
            </Button>
          </Group>
        </Card>
      )}
    </Stack>
  );
}
