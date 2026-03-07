/**
 * SearchAuditDashboard - List view of all search audits
 *
 * Features:
 * - Table view of all audits
 * - Filter by status (pending/in_progress/completed/failed)
 * - Search by domain/company name
 * - Sort by date, score, status
 * - Create new audit button
 * - Click row to view details
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Table,
  Button,
  TextInput,
  Select,
  Loader,
  Alert,
  ActionIcon,
  Pagination,
  Card,
  Grid,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconPlus,
  IconSearch,
  IconEye,
  IconClock,
  IconCheck,
  IconX,
  IconProgress,
  IconChartBar,
} from '@tabler/icons-react';

interface Audit {
  id: string;
  company_id: string;
  audit_type: string;
  status: string;
  overall_score: number;
  fit_score: number;
  intent_score: number;
  created_at: string;
  completed_at: string;
  duration_seconds: number;
  companies: {
    domain: string;
    name: string;
    industry: string;
  };
}

export function SearchAuditDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    failed: 0,
  });

  useEffect(() => {
    fetchAudits();
  }, [page, statusFilter]);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        audit_type: 'search-audit',
      });

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`http://localhost:3001/api/audits?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch audits');
      }

      const data = await response.json();
      setAudits(data.audits || []);
      setTotal(data.total || 0);

      // Calculate stats
      const statsData = {
        total: data.audits?.length || 0,
        completed: data.audits?.filter((a: Audit) => a.status === 'completed').length || 0,
        in_progress: data.audits?.filter((a: Audit) => a.status === 'in_progress').length || 0,
        pending: data.audits?.filter((a: Audit) => a.status === 'pending').length || 0,
        failed: data.audits?.filter((a: Audit) => a.status === 'failed').length || 0,
      };
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audits');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: any }> = {
      completed: { color: 'green', icon: <IconCheck size={14} /> },
      in_progress: { color: 'blue', icon: <IconProgress size={14} /> },
      pending: { color: 'yellow', icon: <IconClock size={14} /> },
      failed: { color: 'red', icon: <IconX size={14} /> },
    };

    const config = statusConfig[status] || { color: 'gray', icon: null };

    return (
      <Badge color={config.color} variant="light" leftSection={config.icon}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'teal';
    if (score >= 6) return 'yellow';
    if (score >= 4) return 'orange';
    return 'red';
  };

  const filteredAudits = audits.filter((audit) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      audit.companies.domain.toLowerCase().includes(query) ||
      audit.companies.name.toLowerCase().includes(query)
    );
  });

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <div>
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
              Search Audits
            </Title>
            <Text c="dimmed" size="lg">
              Manage and track all your search audits
            </Text>
          </div>
          <Button
            size="lg"
            leftSection={<IconPlus size={20} />}
            onClick={() => navigate('/search-audit/new')}
            styles={{
              root: {
                background: 'linear-gradient(135deg, #003DFF 0%, #5468FF 100%)',
                border: 'none',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 24px rgba(0, 61, 255, 0.3)',
                },
              },
            }}
          >
            New Audit
          </Button>
        </Group>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              padding="lg"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.05) 0%, rgba(0, 61, 255, 0.1) 100%)',
                border: '1px solid rgba(0, 61, 255, 0.2)',
              }}
            >
              <Group justify="apart">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    Total Audits
                  </Text>
                  <Text size="xl" fw={700} c="#003DFF">
                    {total}
                  </Text>
                </div>
                <IconChartBar size={32} color="#003DFF" opacity={0.5} />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              padding="lg"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.1) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              }}
            >
              <Group justify="apart">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    Completed
                  </Text>
                  <Text size="xl" fw={700} c="#10B981">
                    {stats.completed}
                  </Text>
                </div>
                <IconCheck size={32} color="#10B981" opacity={0.5} />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              padding="lg"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.1) 100%)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
              }}
            >
              <Group justify="apart">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    In Progress
                  </Text>
                  <Text size="xl" fw={700} c="#3B82F6">
                    {stats.in_progress}
                  </Text>
                </div>
                <IconProgress size={32} color="#3B82F6" opacity={0.5} />
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card
              padding="lg"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.1) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              }}
            >
              <Group justify="apart">
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                    Failed
                  </Text>
                  <Text size="xl" fw={700} c="#EF4444">
                    {stats.failed}
                  </Text>
                </div>
                <IconX size={32} color="#EF4444" opacity={0.5} />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Paper
          shadow="md"
          p="md"
          radius="lg"
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(0, 61, 255, 0.1)',
          }}
        >
          <Group>
            <TextInput
              placeholder="Search by domain or company..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: 'all', label: 'All Statuses' },
                { value: 'completed', label: 'Completed' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
              ]}
              value={statusFilter || 'all'}
              onChange={(value) => setStatusFilter(value === 'all' ? null : value)}
              style={{ minWidth: 200 }}
            />
          </Group>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Table */}
        {loading ? (
          <Group justify="center" py="xl">
            <Loader size="lg" />
            <Text>Loading audits...</Text>
          </Group>
        ) : filteredAudits.length === 0 ? (
          <Paper p="xl" ta="center">
            <IconSearch size={48} color="#CBD5E1" />
            <Text size="lg" fw={600} mt="md">
              No audits found
            </Text>
            <Text c="dimmed" mb="lg">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first search audit to get started'}
            </Text>
            <Button
              onClick={() => navigate('/search-audit/new')}
              leftSection={<IconPlus size={18} />}
            >
              Create New Audit
            </Button>
          </Paper>
        ) : (
          <Paper
            shadow="md"
            radius="lg"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(0, 61, 255, 0.1)',
              overflow: 'hidden',
            }}
          >
            <Table.ScrollContainer minWidth={800}>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Company</Table.Th>
                    <Table.Th>Industry</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Score</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Duration</Table.Th>
                    <Table.Th>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredAudits.map((audit) => (
                    <Table.Tr
                      key={audit.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/search-audit/${audit.id}`)}
                    >
                      <Table.Td>
                        <div>
                          <Text fw={600}>{audit.companies.name}</Text>
                          <Text size="sm" c="dimmed">
                            {audit.companies.domain}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {audit.companies.industry}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{getStatusBadge(audit.status)}</Table.Td>
                      <Table.Td>
                        {audit.overall_score > 0 ? (
                          <Badge color={getScoreColor(audit.overall_score)} size="lg">
                            {audit.overall_score.toFixed(1)}
                          </Badge>
                        ) : (
                          <Text c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(audit.created_at).toLocaleDateString()}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(audit.created_at).toLocaleTimeString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {audit.duration_seconds > 0 ? (
                          <Text size="sm">
                            {Math.round(audit.duration_seconds / 60)} min
                          </Text>
                        ) : (
                          <Text c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>
                        <Group gap="xs">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => navigate(`/search-audit/${audit.id}`)}
                          >
                            <IconEye size={18} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}

        {/* Pagination */}
        {!loading && total > limit && (
          <Group justify="center">
            <Pagination
              total={Math.ceil(total / limit)}
              value={page}
              onChange={setPage}
              color="blue"
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
}
