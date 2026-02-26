import { useParams } from 'react-router-dom';
import { Container, Title, Tabs, Paper, Group, Text, Badge, Button, Grid, Skeleton, Alert } from '@mantine/core';
import { IconBuilding, IconServer, IconChartLine, IconCoin, IconUsers, IconBriefcase, IconQuote, IconFileText, IconRefresh, IconExternalLink } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Card, Metric, Text as TremorText, AreaChart, DonutChart, BarList } from '@tremor/react';

import { getCompany, getIntelOverview, triggerEnrichment } from '@/services/api';
import { SourceBadge } from '@/components/common/SourceBadge';

export function CompanyView() {
  const { domain } = useParams<{ domain: string }>();

  const { data: company, isLoading: companyLoading, error: companyError } = useQuery({
    queryKey: ['company', domain],
    queryFn: () => getCompany(domain!),
    enabled: !!domain,
  });

  const { data: intel, isLoading: intelLoading } = useQuery({
    queryKey: ['intel-overview', domain],
    queryFn: () => getIntelOverview(domain!),
    enabled: !!domain,
  });

  const handleEnrich = async () => {
    if (domain) {
      await triggerEnrichment(domain, true);
    }
  };

  if (companyError) {
    return (
      <Container size="xl" py="md">
        <Alert color="red" title="Error">
          Failed to load company data. Please try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Paper p="lg" mb="lg" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Group gap="md">
              {companyLoading ? (
                <Skeleton height={32} width={200} />
              ) : (
                <>
                  <Title order={2}>{company?.company_name || domain}</Title>
                  {company?.ticker && (
                    <Badge size="lg" variant="light">
                      {company.exchange}:{company.ticker}
                    </Badge>
                  )}
                  <Badge
                    size="lg"
                    color={
                      company?.status === 'hot'
                        ? 'red'
                        : company?.status === 'warm'
                        ? 'orange'
                        : 'blue'
                    }
                  >
                    {company?.status?.toUpperCase()}
                  </Badge>
                </>
              )}
            </Group>
            <Text c="dimmed" mt="xs">
              {domain} • {company?.industry || 'Industry unknown'}
            </Text>
          </div>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={handleEnrich}
            >
              Enrich Now
            </Button>
            <Button
              leftSection={<IconExternalLink size={16} />}
              variant="outline"
              component="a"
              href={`https://${domain}`}
              target="_blank"
            >
              Visit Site
            </Button>
          </Group>
        </Group>

        {/* Quick Stats */}
        <Grid>
          <Grid.Col span={{ base: 6, md: 3 }}>
            <Card>
              <TremorText>ICP Score</TremorText>
              <Metric>{company?.icp_score || '—'}</Metric>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 3 }}>
            <Card>
              <TremorText>Signal Score</TremorText>
              <Metric>{company?.signal_score || '—'}</Metric>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 3 }}>
            <Card>
              <TremorText>Priority Score</TremorText>
              <Metric>{company?.priority_score || '—'}</Metric>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 6, md: 3 }}>
            <Card>
              <TremorText>Last Enriched</TremorText>
              <Metric className="text-base">
                {company?.last_enriched
                  ? new Date(company.last_enriched).toLocaleDateString()
                  : 'Never'}
              </Metric>
            </Card>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Intelligence Tabs */}
      <Paper withBorder>
        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconBuilding size={16} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="tech" leftSection={<IconServer size={16} />}>
              Tech Stack
            </Tabs.Tab>
            <Tabs.Tab value="traffic" leftSection={<IconChartLine size={16} />}>
              Traffic
            </Tabs.Tab>
            <Tabs.Tab value="financials" leftSection={<IconCoin size={16} />}>
              Financials
            </Tabs.Tab>
            <Tabs.Tab value="hiring" leftSection={<IconBriefcase size={16} />}>
              Hiring
            </Tabs.Tab>
            <Tabs.Tab value="quotes" leftSection={<IconQuote size={16} />}>
              Executive Quotes
            </Tabs.Tab>
            <Tabs.Tab value="signals" leftSection={<IconFileText size={16} />}>
              Signals
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" p="lg">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" withBorder>
                  <Text fw={500} mb="md">Company Context</Text>
                  <Group gap="xs" mb="sm">
                    <Text size="sm" c="dimmed" w={100}>Industry:</Text>
                    <Text size="sm">{company?.industry || '—'}</Text>
                  </Group>
                  <Group gap="xs" mb="sm">
                    <Text size="sm" c="dimmed" w={100}>Vertical:</Text>
                    <Text size="sm">{company?.vertical || '—'}</Text>
                  </Group>
                  <Group gap="xs" mb="sm">
                    <Text size="sm" c="dimmed" w={100}>HQ:</Text>
                    <Text size="sm">
                      {company?.headquarters
                        ? `${company.headquarters.city}, ${company.headquarters.state}`
                        : '—'}
                    </Text>
                  </Group>
                  <Group gap="xs" mb="sm">
                    <Text size="sm" c="dimmed" w={100}>Employees:</Text>
                    <Text size="sm">
                      {company?.employee_count?.toLocaleString() || '—'}
                    </Text>
                  </Group>
                </Paper>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" withBorder>
                  <Text fw={500} mb="md">Module Status</Text>
                  {intelLoading ? (
                    <Skeleton height={200} />
                  ) : (
                    <div>
                      {Object.entries(intel?.modules || {}).map(([moduleId, status]) => (
                        <Group key={moduleId} justify="space-between" mb="xs">
                          <Text size="sm" tt="capitalize">
                            {moduleId.replace(/_/g, ' ').replace(/^m\d+\s/, '')}
                          </Text>
                          <Badge
                            size="sm"
                            color={
                              status.status === 'complete'
                                ? 'green'
                                : status.status === 'running'
                                ? 'yellow'
                                : 'gray'
                            }
                          >
                            {status.status}
                          </Badge>
                        </Group>
                      ))}
                    </div>
                  )}
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="tech" p="lg">
            <Text c="dimmed">Technology Stack intelligence will appear here...</Text>
          </Tabs.Panel>

          <Tabs.Panel value="traffic" p="lg">
            <Text c="dimmed">Traffic analysis will appear here...</Text>
          </Tabs.Panel>

          <Tabs.Panel value="financials" p="lg">
            <Text c="dimmed">Financial profile will appear here...</Text>
          </Tabs.Panel>

          <Tabs.Panel value="hiring" p="lg">
            <Text c="dimmed">Hiring signals will appear here...</Text>
          </Tabs.Panel>

          <Tabs.Panel value="quotes" p="lg">
            <Text c="dimmed">Executive quotes ("In Their Own Words") will appear here...</Text>
          </Tabs.Panel>

          <Tabs.Panel value="signals" p="lg">
            <Text c="dimmed">Aggregated signals will appear here...</Text>
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Container>
  );
}
