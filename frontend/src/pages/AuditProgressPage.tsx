/**
 * AuditProgressPage - Real-time audit progress tracking via WebSocket
 *
 * Features:
 * - WebSocket connection to backend
 * - Real-time progress updates (0-100%)
 * - Current step display with detailed messages
 * - Event timeline (audit started, tests running, screenshots captured)
 * - Auto-redirect to AuditDetailPage when complete
 */

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Progress,
  Stack,
  Group,
  Badge,
  Timeline,
  Alert,
  Button,
  Loader,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconCamera,
  IconSearch,
  IconChartBar,
  IconWifi,
  IconWifiOff,
} from '@tabler/icons-react';
import { io, Socket } from 'socket.io-client';

interface AuditEvent {
  type: string;
  data: any;
  timestamp: Date;
}

export function AuditProgressPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);

  const [connected, setConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initializing audit...');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!auditId) return;

    // Connect to WebSocket
    const socket = io('http://localhost:3001', {
      path: '/ws',
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      // Subscribe to audit updates
      socket.emit('subscribe:audit', auditId);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });

    socket.on('subscribed', (data) => {
      console.log('Subscribed to audit:', data.auditId);
    });

    socket.on('audit:event', (event: AuditEvent) => {
      console.log('Audit event:', event);

      // Add to timeline
      setEvents((prev) => [event, ...prev]);

      // Update progress based on event type
      if (event.type === 'audit:started') {
        setCurrentStep('Audit started');
        setProgress(5);
      } else if (event.type === 'test:started') {
        if (event.data.message) {
          setCurrentStep(event.data.message);
        }
        if (event.data.progress) {
          setProgress(event.data.progress.percentage);
        }
      } else if (event.type === 'test:completed') {
        setCurrentStep(`Test completed: ${event.data.testName || 'Unknown'}`);
      } else if (event.type === 'test:failed') {
        setCurrentStep(`Test failed: ${event.data.testName || 'Unknown'}`);
      } else if (event.type === 'screenshot:captured') {
        setCurrentStep(`Screenshot captured: ${event.data.caption || 'Screenshot'}`);
      } else if (event.type === 'finding:detected') {
        setCurrentStep(`Finding detected: ${event.data.summary || 'Finding'}`);
      } else if (event.type === 'audit:completed') {
        setCurrentStep('Audit completed!');
        setProgress(100);
        setCompleted(true);
        // Auto-redirect after 2 seconds
        setTimeout(() => {
          navigate(`/search-audit/${auditId}`);
        }, 2000);
      } else if (event.type === 'audit:error') {
        setError(event.data.error || 'An error occurred');
        setCurrentStep('Audit failed');
      }
    });

    socket.on('error', (err) => {
      console.error('WebSocket error:', err);
      setError('WebSocket connection error');
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('unsubscribe:audit', auditId);
        socketRef.current.disconnect();
      }
    };
  }, [auditId, navigate]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'audit:started':
        return <IconSearch size={20} />;
      case 'test:started':
      case 'test:completed':
        return <IconChartBar size={20} />;
      case 'screenshot:captured':
        return <IconCamera size={20} />;
      case 'finding:detected':
        return <IconAlertCircle size={20} />;
      case 'audit:completed':
        return <IconCheck size={20} />;
      default:
        return <IconCheck size={20} />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'audit:started':
        return 'blue';
      case 'test:completed':
        return 'green';
      case 'test:failed':
      case 'audit:error':
        return 'red';
      case 'screenshot:captured':
        return 'purple';
      case 'finding:detected':
        return 'yellow';
      case 'audit:completed':
        return 'teal';
      default:
        return 'gray';
    }
  };

  if (!auditId) {
    return (
      <Container>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          Invalid audit ID
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Group justify="space-between" mb="xs">
            <Title
              order={1}
              style={{
                background: 'linear-gradient(135deg, #21243D 0%, #003DFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: '36px',
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              Audit Progress
            </Title>
            <Badge
              color={connected ? 'green' : 'red'}
              variant="light"
              leftSection={connected ? <IconWifi size={14} /> : <IconWifiOff size={14} />}
            >
              {connected ? 'Connected' : 'Disconnected'}
            </Badge>
          </Group>
          <Text c="dimmed" size="lg">
            Audit ID: {auditId}
          </Text>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
            <Group mt="sm">
              <Button size="xs" variant="light" onClick={() => navigate('/search-audit/new')}>
                Create New Audit
              </Button>
            </Group>
          </Alert>
        )}

        {/* Progress Card */}
        <Paper
          shadow="lg"
          p="xl"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(0, 61, 255, 0.1)',
          }}
        >
          <Stack gap="lg">
            {/* Current Step */}
            <Group>
              {!completed && <Loader size="sm" color="blue" />}
              {completed && <IconCheck size={24} color="#10B981" />}
              <div style={{ flex: 1 }}>
                <Text size="lg" fw={600}>
                  {currentStep}
                </Text>
                <Text size="sm" c="dimmed">
                  {completed
                    ? 'Redirecting to results...'
                    : "This may take several minutes. Feel free to navigate away - we'll save your progress."}
                </Text>
              </div>
            </Group>

            {/* Progress Bar */}
            <div>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={500}>
                  Overall Progress
                </Text>
                <Text size="sm" fw={600} c="#003DFF">
                  {progress}%
                </Text>
              </Group>
              <Progress
                value={progress}
                size="lg"
                radius="md"
                color="blue"
                style={{
                  background: 'rgba(0, 61, 255, 0.1)',
                }}
              />
            </div>
          </Stack>
        </Paper>

        {/* Event Timeline */}
        {events.length > 0 && (
          <Paper
            shadow="md"
            p="lg"
            radius="lg"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(0, 61, 255, 0.1)',
            }}
          >
            <Title order={3} mb="md">
              Event Timeline
            </Title>
            <Timeline
              active={events.length}
              bulletSize={28}
              lineWidth={2}
              styles={{
                itemBullet: {
                  borderWidth: 2,
                },
              }}
            >
              {events.map((event, index) => (
                <Timeline.Item
                  key={index}
                  bullet={getEventIcon(event.type)}
                  color={getEventColor(event.type)}
                  title={
                    <Text size="sm" fw={500}>
                      {event.type
                        .split(':')
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ')}
                    </Text>
                  }
                >
                  <Text size="xs" c="dimmed" mb={4}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </Text>
                  {event.data.message && (
                    <Text size="sm" c="dimmed">
                      {event.data.message}
                    </Text>
                  )}
                  {event.data.testName && (
                    <Text size="sm" c="dimmed">
                      Test: {event.data.testName}
                    </Text>
                  )}
                  {event.data.caption && (
                    <Text size="sm" c="dimmed">
                      {event.data.caption}
                    </Text>
                  )}
                  {event.data.summary && (
                    <Text size="sm" c="dimmed">
                      {event.data.summary}
                    </Text>
                  )}
                </Timeline.Item>
              ))}
            </Timeline>
          </Paper>
        )}

        {/* Actions */}
        {completed && (
          <Group justify="center">
            <Button
              size="lg"
              onClick={() => navigate(`/search-audit/${auditId}`)}
              styles={{
                root: {
                  background: 'linear-gradient(135deg, #003DFF 0%, #5468FF 100%)',
                },
              }}
            >
              View Results
            </Button>
          </Group>
        )}
      </Stack>
    </Container>
  );
}
