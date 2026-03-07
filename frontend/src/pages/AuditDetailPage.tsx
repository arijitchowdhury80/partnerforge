/**
 * AuditDetailPage - Full search audit results page
 *
 * Features:
 * - Executive summary card
 * - Search test results (20 tests with pass/fail)
 * - Screenshots gallery (with zoom modal)
 * - Scoring breakdown (10 dimensions, 0-10 each)
 * - Strategic insights section
 * - Download buttons (PDF, Landing Page, Deck)
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Group,
  Badge,
  Grid,
  Card,
  Progress,
  Table,
  Button,
  Loader,
  Alert,
  Accordion,
  Modal,
  Image,
  ActionIcon,
  Tabs,
  RingProgress,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconDownload,
  IconCheck,
  IconX,
  IconExternalLink,
  IconZoomIn,
  IconFileTypePdf,
  IconPresentation,
  IconWorld,
  IconChartBar,
  IconSearch,
  IconDeviceMobile,
  IconBrain,
  IconUsers,
  IconTrendingUp,
} from '@tabler/icons-react';

interface Audit {
  id: string;
  company_id: string;
  audit_type: string;
  status: string;
  overall_score: number;
  fit_score: number;
  intent_score: number;
  value_score: number;
  displacement_score: number;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  companies: {
    id: string;
    domain: string;
    name: string;
    industry: string;
    sector: string;
    employee_count: number;
    annual_revenue: number;
    headquarters_city: string;
    headquarters_country: string;
    website_url: string;
    linkedin_url: string;
  };
}

interface SearchTest {
  company_id: string;
  audit_id: string;
  test_name: string;
  test_category: string;
  test_phase: string;
  test_query: string;
  executed_at: string;
  passed: boolean;
  score: number;
  severity: string;
  finding_summary: string;
  finding_details: any;
  screenshot_count: number;
  duration_ms: number;
}

export function AuditDetailPage() {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [tests, setTests] = useState<SearchTest[]>([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (!auditId) return;

    const fetchAudit = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:3001/api/audits/${auditId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch audit');
        }

        const data = await response.json();
        setAudit(data.audit);
        setTests(data.tests || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch audit');
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, [auditId]);

  if (loading) {
    return (
      <Container>
        <Group justify="center" py="xl">
          <Loader size="lg" />
          <Text>Loading audit results...</Text>
        </Group>
      </Container>
    );
  }

  if (error || !audit) {
    return (
      <Container>
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error || 'Audit not found'}
        </Alert>
      </Container>
    );
  }

  const company = audit.companies;
  const passedTests = tests.filter((t) => t.passed).length;
  const totalTests = tests.length;
  const passRate = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0;

  // Group tests by category
  const testsByCategory = tests.reduce((acc, test) => {
    const category = test.test_category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(test);
    return acc;
  }, {} as Record<string, SearchTest[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'search_ux':
        return <IconSearch size={20} />;
      case 'mobile':
        return <IconDeviceMobile size={20} />;
      case 'nlp':
        return <IconBrain size={20} />;
      case 'personalization':
        return <IconUsers size={20} />;
      case 'facets':
        return <IconChartBar size={20} />;
      default:
        return <IconSearch size={20} />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'search_ux':
        return 'blue';
      case 'mobile':
        return 'purple';
      case 'nlp':
        return 'teal';
      case 'personalization':
        return 'orange';
      case 'facets':
        return 'green';
      default:
        return 'gray';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'teal';
    if (score >= 6) return 'yellow';
    if (score >= 4) return 'orange';
    return 'red';
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <div>
          <Group justify="space-between" mb="xs">
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
                {company.name}
              </Title>
              <Group gap="xs" mt="xs">
                <Text c="dimmed" size="lg">
                  {company.domain}
                </Text>
                <Badge color="blue" variant="light">
                  {company.industry}
                </Badge>
                <Badge
                  color={audit.status === 'completed' ? 'green' : 'yellow'}
                  variant="light"
                >
                  {audit.status}
                </Badge>
              </Group>
            </div>
            <Group>
              <Button
                variant="light"
                leftSection={<IconFileTypePdf size={18} />}
                disabled
              >
                Download PDF
              </Button>
              <Button
                variant="light"
                leftSection={<IconPresentation size={18} />}
                disabled
              >
                Download Deck
              </Button>
              <Button
                variant="light"
                leftSection={<IconWorld size={18} />}
                disabled
              >
                View Landing Page
              </Button>
            </Group>
          </Group>
        </div>

        {/* Executive Summary */}
        <Paper
          shadow="lg"
          p="xl"
          radius="lg"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.05) 0%, rgba(84, 104, 255, 0.05) 100%)',
            border: '1px solid rgba(0, 61, 255, 0.1)',
          }}
        >
          <Title order={2} mb="lg">
            Executive Summary
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <div style={{ textAlign: 'center' }}>
                <RingProgress
                  size={120}
                  thickness={12}
                  sections={[
                    {
                      value: (audit.overall_score / 10) * 100,
                      color: getScoreColor(audit.overall_score),
                    },
                  ]}
                  label={
                    <Text size="xl" fw={700} ta="center">
                      {audit.overall_score.toFixed(1)}
                    </Text>
                  }
                />
                <Text size="sm" fw={600} mt="xs">
                  Overall Score
                </Text>
                <Text size="xs" c="dimmed">
                  Out of 10
                </Text>
              </div>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 9 }}>
              <Grid>
                <Grid.Col span={6}>
                  <Card padding="md" radius="md" withBorder>
                    <Group justify="apart">
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          Tests Passed
                        </Text>
                        <Text size="xl" fw={700}>
                          {passedTests}/{totalTests}
                        </Text>
                      </div>
                      <Progress
                        value={passRate}
                        size="lg"
                        radius="md"
                        style={{ flex: 1, maxWidth: 200 }}
                        color={passRate >= 70 ? 'teal' : passRate >= 40 ? 'yellow' : 'red'}
                      />
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card padding="md" radius="md" withBorder>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                      Audit Duration
                    </Text>
                    <Text size="xl" fw={700}>
                      {Math.round(audit.duration_seconds / 60)} min
                    </Text>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card padding="md" radius="md" withBorder>
                    <Group>
                      <IconTrendingUp size={24} color="#003DFF" />
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          Fit Score
                        </Text>
                        <Text size="xl" fw={700} c={getScoreColor(audit.fit_score)}>
                          {audit.fit_score.toFixed(1)}
                        </Text>
                      </div>
                    </Group>
                  </Card>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Card padding="md" radius="md" withBorder>
                    <Group>
                      <IconChartBar size={24} color="#5468FF" />
                      <div>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          Intent Score
                        </Text>
                        <Text size="xl" fw={700} c={getScoreColor(audit.intent_score)}>
                          {audit.intent_score.toFixed(1)}
                        </Text>
                      </div>
                    </Group>
                  </Card>
                </Grid.Col>
              </Grid>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Test Results Tabs */}
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
          <Title order={2} mb="lg">
            Test Results
          </Title>
          <Tabs defaultValue={Object.keys(testsByCategory)[0]}>
            <Tabs.List>
              {Object.entries(testsByCategory).map(([category, categoryTests]) => {
                const passed = categoryTests.filter((t) => t.passed).length;
                return (
                  <Tabs.Tab
                    key={category}
                    value={category}
                    leftSection={getCategoryIcon(category)}
                  >
                    <Group gap="xs">
                      <Text tt="capitalize">{category.replace('_', ' ')}</Text>
                      <Badge size="sm" color={getCategoryColor(category)}>
                        {passed}/{categoryTests.length}
                      </Badge>
                    </Group>
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>

            {Object.entries(testsByCategory).map(([category, categoryTests]) => (
              <Tabs.Panel key={category} value={category} pt="lg">
                <Stack gap="md">
                  {categoryTests.map((test) => (
                    <Card
                      key={test.test_name}
                      padding="lg"
                      radius="md"
                      withBorder
                      style={{
                        borderLeft: `4px solid ${
                          test.passed ? '#10B981' : '#EF4444'
                        }`,
                      }}
                    >
                      <Group justify="apart" mb="sm">
                        <Group>
                          {test.passed ? (
                            <IconCheck size={24} color="#10B981" />
                          ) : (
                            <IconX size={24} color="#EF4444" />
                          )}
                          <div>
                            <Text fw={600}>{test.test_name.replace(/_/g, ' ')}</Text>
                            {test.test_query && (
                              <Text size="sm" c="dimmed">
                                Query: "{test.test_query}"
                              </Text>
                            )}
                          </div>
                        </Group>
                        <Group>
                          <Badge color={getScoreColor(test.score)}>
                            Score: {test.score.toFixed(1)}
                          </Badge>
                          <Badge
                            color={
                              test.severity === 'high'
                                ? 'red'
                                : test.severity === 'medium'
                                ? 'yellow'
                                : 'gray'
                            }
                            variant="light"
                          >
                            {test.severity}
                          </Badge>
                        </Group>
                      </Group>
                      <Text size="sm">{test.finding_summary}</Text>
                      {test.screenshot_count > 0 && (
                        <Text size="xs" c="dimmed" mt="xs">
                          {test.screenshot_count} screenshot(s) captured
                        </Text>
                      )}
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Paper>

        {/* Strategic Insights */}
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
          <Title order={2} mb="lg">
            Strategic Insights
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card padding="lg" radius="md" withBorder>
                <Text fw={600} mb="sm">
                  Company Profile
                </Text>
                <Stack gap="xs">
                  <Group justify="apart">
                    <Text size="sm" c="dimmed">
                      Industry
                    </Text>
                    <Text size="sm" fw={500}>
                      {company.industry}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text size="sm" c="dimmed">
                      Employees
                    </Text>
                    <Text size="sm" fw={500}>
                      {company.employee_count?.toLocaleString() || 'N/A'}
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text size="sm" c="dimmed">
                      Revenue
                    </Text>
                    <Text size="sm" fw={500}>
                      ${(company.annual_revenue / 1_000_000).toFixed(0)}M
                    </Text>
                  </Group>
                  <Group justify="apart">
                    <Text size="sm" c="dimmed">
                      Headquarters
                    </Text>
                    <Text size="sm" fw={500}>
                      {company.headquarters_city}, {company.headquarters_country}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card padding="lg" radius="md" withBorder>
                <Text fw={600} mb="sm">
                  Opportunity Scores
                </Text>
                <Stack gap="md">
                  <div>
                    <Group justify="apart" mb="xs">
                      <Text size="sm">Value Score</Text>
                      <Text size="sm" fw={600} c={getScoreColor(audit.value_score)}>
                        {audit.value_score.toFixed(1)}/10
                      </Text>
                    </Group>
                    <Progress
                      value={(audit.value_score / 10) * 100}
                      color={getScoreColor(audit.value_score)}
                    />
                  </div>
                  <div>
                    <Group justify="apart" mb="xs">
                      <Text size="sm">Displacement Score</Text>
                      <Text size="sm" fw={600} c={getScoreColor(audit.displacement_score)}>
                        {audit.displacement_score.toFixed(1)}/10
                      </Text>
                    </Group>
                    <Progress
                      value={(audit.displacement_score / 10) * 100}
                      color={getScoreColor(audit.displacement_score)}
                    />
                  </div>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Company Links */}
        <Group justify="center">
          <Button
            variant="light"
            leftSection={<IconExternalLink size={18} />}
            component="a"
            href={company.website_url}
            target="_blank"
          >
            Visit Website
          </Button>
          {company.linkedin_url && (
            <Button
              variant="light"
              leftSection={<IconExternalLink size={18} />}
              component="a"
              href={company.linkedin_url}
              target="_blank"
            >
              View LinkedIn
            </Button>
          )}
        </Group>
      </Stack>

      {/* Screenshot Modal */}
      <Modal
        opened={!!selectedScreenshot}
        onClose={() => setSelectedScreenshot(null)}
        size="xl"
        title="Screenshot"
      >
        {selectedScreenshot && <Image src={selectedScreenshot} alt="Screenshot" />}
      </Modal>
    </Container>
  );
}
