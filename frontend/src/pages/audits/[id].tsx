/**
 * Audit Detail Page
 *
 * Displays audit status and results.
 * - If pending/running: shows AuditProgress component
 * - If completed: shows tabs with Overview, Enrichment, Tests, etc.
 * - If failed: shows error message with retry button
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Stack,
  Group,
  Text,
  Button,
  Tabs,
  Paper,
  Alert,
  LoadingOverlay,
  Badge,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRefresh,
  IconChartBar,
  IconDatabase,
  IconSearch,
  IconBrain,
  IconFileText,
  IconArrowLeft,
} from '@tabler/icons-react';
import axios from 'axios';
import { AuditProgress } from '@/components/audit/AuditProgress';

interface AuditStatus {
  id: string;
  company_id: string;
  audit_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  overall_score?: number;
  current_phase: string;
  progress_percent: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [audit, setAudit] = useState<AuditStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const fetchAuditStatus = async () => {
    if (!id) {
      setError('Audit ID is required');
      setLoading(false);
      return;
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const response = await axios.get<AuditStatus>(`${API_BASE_URL}/api/audits/${id}/status`);
      setAudit(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch audit status:', err);

      if (err.response?.status === 404) {
        setError('Audit not found');
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Failed to load audit status');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditStatus();

    // Poll for updates if audit is running
    const interval = setInterval(() => {
      if (audit?.status === 'running' || audit?.status === 'pending') {
        fetchAuditStatus();
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [id, audit?.status]);

  const handleRetry = async () => {
    if (!id) return;

    setRetrying(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      // Create a new audit with the same domain
      // Note: This requires fetching the company domain first
      // For now, we'll just reload the page
      window.location.reload();
    } catch (err) {
      console.error('Failed to retry audit:', err);
    } finally {
      setRetrying(false);
    }
  };

  const handleComplete = () => {
    // Refresh audit status when complete
    fetchAuditStatus();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge color="green" size="lg">Completed</Badge>;
      case 'running':
        return <Badge color="blue" size="lg">Running</Badge>;
      case 'failed':
        return <Badge color="red" size="lg">Failed</Badge>;
      default:
        return <Badge color="gray" size="lg">Pending</Badge>;
    }
  };

  if (loading) {
    return (
      <Container size="lg" py="xl">
        <Paper p="xl" radius="md" pos="relative" style={{ minHeight: 400 }}>
          <LoadingOverlay visible overlayProps={{ blur: 2 }} />
        </Paper>
      </Container>
    );
  }

  if (error || !audit) {
    return (
      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Button
            leftSection={<IconArrowLeft size={16} />}
            variant="subtle"
            onClick={() => navigate(-1)}
          >
            Back
          </Button>

          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Error"
            color="red"
            variant="light"
          >
            {error || 'Audit not found'}
          </Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Stack gap={4}>
            <Group gap="sm">
              <Button
                leftSection={<IconArrowLeft size={16} />}
                variant="subtle"
                onClick={() => navigate(-1)}
                size="sm"
              >
                Back
              </Button>
              {getStatusBadge(audit.status)}
            </Group>
            <Text size="xl" fw={700}>
              Audit: {audit.id}
            </Text>
            <Text size="sm" c="dimmed">
              Created {new Date(audit.created_at).toLocaleString()}
            </Text>
          </Stack>

          {audit.overall_score !== undefined && (
            <Paper p="md" radius="md" withBorder>
              <Stack gap={0} align="center">
                <Text size="xs" c="dimmed" tt="uppercase">
                  Overall Score
                </Text>
                <Text size="xl" fw={700} c="blue">
                  {audit.overall_score.toFixed(1)}/10
                </Text>
              </Stack>
            </Paper>
          )}
        </Group>

        {/* Failed State */}
        {audit.status === 'failed' && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Audit Failed"
            color="red"
            variant="light"
          >
            <Stack gap="md">
              <Text size="sm">{audit.error_message || 'An unknown error occurred'}</Text>
              <Button
                leftSection={<IconRefresh size={16} />}
                variant="light"
                color="red"
                onClick={handleRetry}
                loading={retrying}
              >
                Retry Audit
              </Button>
            </Stack>
          </Alert>
        )}

        {/* Running/Pending State */}
        {(audit.status === 'running' || audit.status === 'pending') && id && (
          <AuditProgress auditId={id} onComplete={handleComplete} />
        )}

        {/* Completed State */}
        {audit.status === 'completed' && (
          <Tabs defaultValue="overview">
            <Tabs.List>
              <Tabs.Tab value="overview" leftSection={<IconChartBar size={16} />}>
                Overview
              </Tabs.Tab>
              <Tabs.Tab value="enrichment" leftSection={<IconDatabase size={16} />}>
                Enrichment Data
              </Tabs.Tab>
              <Tabs.Tab value="search-tests" leftSection={<IconSearch size={16} />}>
                Search Tests
              </Tabs.Tab>
              <Tabs.Tab value="strategic" leftSection={<IconBrain size={16} />}>
                Strategic Analysis
              </Tabs.Tab>
              <Tabs.Tab value="deliverables" leftSection={<IconFileText size={16} />}>
                Deliverables
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="xl">
              <Paper p="xl" radius="md" withBorder>
                <Text size="lg" fw={600} mb="md">
                  Audit Overview
                </Text>
                <Stack gap="md">
                  <Group>
                    <Text size="sm" fw={500} w={150}>
                      Company ID:
                    </Text>
                    <Text size="sm" c="dimmed">
                      {audit.company_id}
                    </Text>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={150}>
                      Audit Type:
                    </Text>
                    <Badge>{audit.audit_type}</Badge>
                  </Group>
                  <Group>
                    <Text size="sm" fw={500} w={150}>
                      Status:
                    </Text>
                    {getStatusBadge(audit.status)}
                  </Group>
                  {audit.overall_score !== undefined && (
                    <Group>
                      <Text size="sm" fw={500} w={150}>
                        Overall Score:
                      </Text>
                      <Text size="sm" c="blue" fw={600}>
                        {audit.overall_score.toFixed(1)}/10
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="enrichment" pt="xl">
              <Paper p="xl" radius="md" withBorder>
                <Text c="dimmed">Enrichment data will be displayed here</Text>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="search-tests" pt="xl">
              <Paper p="xl" radius="md" withBorder>
                <Text c="dimmed">Search test results will be displayed here</Text>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="strategic" pt="xl">
              <Paper p="xl" radius="md" withBorder>
                <Text c="dimmed">Strategic analysis will be displayed here</Text>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="deliverables" pt="xl">
              <Paper p="xl" radius="md" withBorder>
                <Text c="dimmed">Deliverables will be available for download here</Text>
              </Paper>
            </Tabs.Panel>
          </Tabs>
        )}
      </Stack>
    </Container>
  );
}

export default AuditDetailPage;
