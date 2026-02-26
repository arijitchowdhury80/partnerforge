/**
 * TargetDetail Page
 *
 * Full intelligence view for a single company with tabbed sections.
 * Displays all enrichment data with source citations.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Badge,
  Button,
  Tabs,
  Grid,
  Stack,
  Breadcrumbs,
  Anchor,
  Tooltip,
  Alert,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBuilding,
  IconServer,
  IconChartLine,
  IconCoin,
  IconUsers,
  IconBriefcase,
  IconQuote,
  IconBolt,
  IconRefresh,
  IconExternalLink,
  IconArrowLeft,
  IconMapPin,
  IconCalendar,
  IconHash,
  IconWorld,
} from '@tabler/icons-react';

import {
  getCompany,
  getIntelOverview,
  triggerEnrichment,
  modules,
} from '@/services/api';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ScoreGauge, ScoreBar } from '@/components/common/ScoreGauge';
import { LoadingSpinner, Skeleton } from '@/components/common/LoadingSpinner';
import { TechStackCard } from '@/components/intelligence/TechStackCard';
import { TrafficCard } from '@/components/intelligence/TrafficCard';
import { FinancialCard } from '@/components/intelligence/FinancialCard';
import { CompetitorCard } from '@/components/intelligence/CompetitorCard';
import { HiringCard, type HiringCardData } from '@/components/intelligence/HiringCard';
import { ExecutiveCard, type ExecutiveData as ExecutiveCardData } from '@/components/intelligence/ExecutiveCard';
import type { Company, TechStackData, TrafficData, FinancialData, CompetitorData } from '@/types';

export function TargetDetail() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  // Fetch company data
  const {
    data: company,
    isLoading: companyLoading,
    error: companyError,
  } = useQuery({
    queryKey: ['company', domain],
    queryFn: () => getCompany(domain!),
    enabled: !!domain,
  });

  // Fetch intelligence overview
  const {
    data: intelOverview,
    isLoading: intelLoading,
  } = useQuery({
    queryKey: ['intel-overview', domain],
    queryFn: () => getIntelOverview(domain!),
    enabled: !!domain,
  });

  // Fetch module-specific data based on active tab
  const { data: techStackData, isLoading: techLoading } = useQuery({
    queryKey: ['intel', domain, 'm02'],
    queryFn: () => modules.techStack(domain!),
    enabled: !!domain && activeTab === 'tech',
  });

  const { data: trafficData, isLoading: trafficLoading } = useQuery({
    queryKey: ['intel', domain, 'm03'],
    queryFn: () => modules.traffic(domain!),
    enabled: !!domain && activeTab === 'traffic',
  });

  const { data: financialData, isLoading: financialLoading } = useQuery({
    queryKey: ['intel', domain, 'm04'],
    queryFn: () => modules.financials(domain!),
    enabled: !!domain && activeTab === 'financials',
  });

  const { data: competitorData, isLoading: competitorLoading } = useQuery({
    queryKey: ['intel', domain, 'm05'],
    queryFn: () => modules.competitors(domain!),
    enabled: !!domain && activeTab === 'competitors',
  });

  const { data: hiringData, isLoading: hiringLoading } = useQuery({
    queryKey: ['intel', domain, 'm06'],
    queryFn: () => modules.hiring(domain!),
    enabled: !!domain && activeTab === 'hiring',
  });

  const { data: executiveData, isLoading: executiveLoading } = useQuery({
    queryKey: ['intel', domain, 'm09'],
    queryFn: () => modules.executive(domain!),
    enabled: !!domain && activeTab === 'executives',
  });

  // Enrichment mutation
  const enrichMutation = useMutation({
    mutationFn: () => triggerEnrichment(domain!, true),
    onSuccess: () => {
      notifications.show({
        title: 'Enrichment Started',
        message: 'Intelligence gathering has begun. Data will update automatically.',
        color: 'blue',
      });
      queryClient.invalidateQueries({ queryKey: ['company', domain] });
      queryClient.invalidateQueries({ queryKey: ['intel-overview', domain] });
    },
    onError: () => {
      notifications.show({
        title: 'Enrichment Failed',
        message: 'Could not start enrichment. Please try again.',
        color: 'red',
      });
    },
  });

  if (companyError) {
    return (
      <Container size="xl" py="md">
        <Alert color="red" title="Error">
          Failed to load company data. Please try again.
        </Alert>
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(-1)}
          mt="md"
        >
          Go Back
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Breadcrumbs */}
      <Breadcrumbs mb="lg" separator="/">
        <Anchor onClick={() => navigate('/dashboard')} size="sm" c="dimmed">
          Dashboard
        </Anchor>
        <Anchor onClick={() => navigate('/companies')} size="sm" c="dimmed">
          Companies
        </Anchor>
        <Text size="sm" c="white">
          {company?.company_name || domain}
        </Text>
      </Breadcrumbs>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Paper
          p="xl"
          radius="lg"
          mb="lg"
          className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 backdrop-blur-xl"
        >
          {companyLoading ? (
            <CompanyHeaderSkeleton />
          ) : company ? (
            <CompanyHeader
              company={company}
              onEnrich={() => enrichMutation.mutate()}
              isEnriching={enrichMutation.isPending}
            />
          ) : null}
        </Paper>
      </motion.div>

      {/* Intelligence Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Paper
          radius="lg"
          className="bg-white/5 border border-white/10 overflow-hidden"
        >
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List className="border-b border-white/10 px-4">
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
              <Tabs.Tab value="competitors" leftSection={<IconUsers size={16} />}>
                Competitors
              </Tabs.Tab>
              <Tabs.Tab value="hiring" leftSection={<IconBriefcase size={16} />}>
                Hiring
              </Tabs.Tab>
              <Tabs.Tab value="executives" leftSection={<IconQuote size={16} />}>
                Executives
              </Tabs.Tab>
              <Tabs.Tab value="signals" leftSection={<IconBolt size={16} />}>
                Signals
              </Tabs.Tab>
            </Tabs.List>

            {/* Overview Tab */}
            <Tabs.Panel value="overview" p="lg">
              <OverviewTab
                company={company}
                intelOverview={intelOverview}
                isLoading={companyLoading || intelLoading}
              />
            </Tabs.Panel>

            {/* Tech Stack Tab */}
            <Tabs.Panel value="tech" p="lg">
              <TechStackCard
                data={techStackData?.data as TechStackData}
                source={techStackData?.source}
                isLoading={techLoading}
              />
            </Tabs.Panel>

            {/* Traffic Tab */}
            <Tabs.Panel value="traffic" p="lg">
              <TrafficCard
                data={trafficData?.data as TrafficData}
                source={trafficData?.source}
                isLoading={trafficLoading}
              />
            </Tabs.Panel>

            {/* Financials Tab */}
            <Tabs.Panel value="financials" p="lg">
              <FinancialCard
                data={financialData?.data as FinancialData}
                source={financialData?.source}
                isLoading={financialLoading}
              />
            </Tabs.Panel>

            {/* Competitors Tab */}
            <Tabs.Panel value="competitors" p="lg">
              <CompetitorCard
                data={competitorData?.data as CompetitorData}
                source={competitorData?.source}
                isLoading={competitorLoading}
              />
            </Tabs.Panel>

            {/* Hiring Tab */}
            <Tabs.Panel value="hiring" p="lg">
              <HiringCard
                data={hiringData?.data as HiringCardData}
                source={hiringData?.source}
                isLoading={hiringLoading}
              />
            </Tabs.Panel>

            {/* Executives Tab */}
            <Tabs.Panel value="executives" p="lg">
              <ExecutiveCard
                data={executiveData?.data as ExecutiveCardData}
                source={executiveData?.source}
                isLoading={executiveLoading}
              />
            </Tabs.Panel>

            {/* Signals Tab */}
            <Tabs.Panel value="signals" p="lg">
              <SignalsTab company={company} />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </motion.div>
    </Container>
  );
}

// Company Header Component
interface CompanyHeaderProps {
  company: Company;
  onEnrich: () => void;
  isEnriching: boolean;
}

function CompanyHeader({ company, onEnrich, isEnriching }: CompanyHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
      {/* Left: Company Info */}
      <div className="flex-1">
        <Group gap="md" mb="sm">
          <Title order={2} c="white">
            {company.company_name || company.domain}
          </Title>
          {company.ticker && (
            <Badge size="lg" variant="light" color="blue">
              {company.exchange}:{company.ticker}
            </Badge>
          )}
          <StatusBadge status={company.status} size="lg" />
        </Group>

        <Group gap="lg" mb="md">
          <Group gap="xs">
            <IconWorld size={14} className="text-white/40" />
            <Anchor
              href={`https://${company.domain}`}
              target="_blank"
              size="sm"
              c="dimmed"
            >
              {company.domain}
            </Anchor>
          </Group>
          {company.headquarters && (
            <Group gap="xs">
              <IconMapPin size={14} className="text-white/40" />
              <Text size="sm" c="dimmed">
                {company.headquarters.city}, {company.headquarters.state}
              </Text>
            </Group>
          )}
          <Group gap="xs">
            <IconBuilding size={14} className="text-white/40" />
            <Text size="sm" c="dimmed">
              {company.industry || 'Industry unknown'}
            </Text>
          </Group>
        </Group>

        {/* Quick metrics */}
        <Group gap="xl">
          <div>
            <Text size="xs" c="dimmed" mb={4}>ICP Score</Text>
            <ScoreGauge value={company.icp_score} size="lg" />
          </div>
          <div>
            <Text size="xs" c="dimmed" mb={4}>Signal Score</Text>
            <ScoreGauge value={company.signal_score} size="lg" />
          </div>
          <div>
            <Text size="xs" c="dimmed" mb={4}>Priority Score</Text>
            <ScoreGauge value={company.priority_score} size="lg" />
          </div>
        </Group>
      </div>

      {/* Right: Actions */}
      <Stack gap="sm">
        <Button
          leftSection={<IconRefresh size={16} />}
          loading={isEnriching}
          onClick={onEnrich}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
        >
          Enrich Now
        </Button>
        <Button
          variant="outline"
          leftSection={<IconExternalLink size={16} />}
          component="a"
          href={`https://${company.domain}`}
          target="_blank"
        >
          Visit Website
        </Button>
        {company.last_enriched && (
          <Text size="xs" c="dimmed" ta="center">
            Last enriched: {new Date(company.last_enriched).toLocaleDateString()}
          </Text>
        )}
      </Stack>
    </div>
  );
}

function CompanyHeaderSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
      <div className="flex-1">
        <Group gap="md" mb="sm">
          <Skeleton width={200} height={32} />
          <Skeleton width={80} height={24} />
          <Skeleton width={60} height={24} />
        </Group>
        <Group gap="lg" mb="md">
          <Skeleton width={150} height={16} />
          <Skeleton width={120} height={16} />
          <Skeleton width={100} height={16} />
        </Group>
        <Group gap="xl">
          <Skeleton width={64} height={64} circle />
          <Skeleton width={64} height={64} circle />
          <Skeleton width={64} height={64} circle />
        </Group>
      </div>
      <Stack gap="sm">
        <Skeleton width={140} height={36} />
        <Skeleton width={140} height={36} />
      </Stack>
    </div>
  );
}

// Overview Tab Component
interface OverviewTabProps {
  company?: Company;
  intelOverview?: any;
  isLoading: boolean;
}

function OverviewTab({ company, intelOverview, isLoading }: OverviewTabProps) {
  if (isLoading) {
    return (
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Skeleton width="100%" height={300} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Skeleton width="100%" height={300} />
        </Grid.Col>
      </Grid>
    );
  }

  return (
    <Grid>
      {/* Company Context */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p="lg" radius="md" className="bg-white/5 border border-white/10 h-full">
          <Text fw={600} c="white" mb="md">Company Context</Text>
          <Stack gap="sm">
            <DetailRow label="Industry" value={company?.industry} />
            <DetailRow label="Vertical" value={company?.vertical} />
            <DetailRow label="Sub-Vertical" value={company?.sub_vertical} />
            <DetailRow
              label="Headquarters"
              value={
                company?.headquarters
                  ? `${company.headquarters.city}, ${company.headquarters.state}, ${company.headquarters.country}`
                  : undefined
              }
            />
            <DetailRow
              label="Employees"
              value={company?.employee_count?.toLocaleString()}
            />
            <DetailRow
              label="Stores"
              value={company?.store_count?.toLocaleString()}
            />
            <DetailRow label="Founded" value={company?.founded_year?.toString()} />
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Module Status */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Paper p="lg" radius="md" className="bg-white/5 border border-white/10 h-full">
          <Text fw={600} c="white" mb="md">Intelligence Modules</Text>
          <Stack gap="xs">
            {Object.entries(intelOverview?.modules || {}).map(([moduleId, status]: [string, any]) => (
              <Group key={moduleId} justify="space-between">
                <Text size="sm" c="white/70" tt="capitalize">
                  {moduleId.replace(/_/g, ' ').replace(/^m\d+\s?/, '')}
                </Text>
                <Badge
                  size="sm"
                  variant="light"
                  color={
                    status.status === 'complete'
                      ? 'green'
                      : status.status === 'running'
                      ? 'yellow'
                      : status.status === 'error'
                      ? 'red'
                      : 'gray'
                  }
                >
                  {status.status}
                </Badge>
              </Group>
            ))}
          </Stack>
        </Paper>
      </Grid.Col>

      {/* Score Breakdown */}
      <Grid.Col span={12}>
        <Paper p="lg" radius="md" className="bg-white/5 border border-white/10">
          <Text fw={600} c="white" mb="md">Score Breakdown</Text>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <ScoreBar value={company?.icp_score || 0} label="ICP Score" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <ScoreBar value={company?.signal_score || 0} label="Signal Score" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <ScoreBar value={company?.priority_score || 0} label="Priority Score" />
            </Grid.Col>
          </Grid>
        </Paper>
      </Grid.Col>
    </Grid>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <Group justify="space-between">
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" c="white" fw={500}>{value || '---'}</Text>
    </Group>
  );
}

// Executives Tab Placeholder
function ExecutivesTab({ domain }: { domain: string }) {
  return (
    <div className="text-center py-12">
      <IconQuote size={48} className="text-white/20 mx-auto mb-4" />
      <Text c="dimmed" mb="md">Executive quotes and "In Their Own Words" data</Text>
      <Text size="sm" c="dimmed">
        Run enrichment to collect executive intelligence from earnings calls,
        investor presentations, and SEC filings.
      </Text>
    </div>
  );
}

// Signals Tab
function SignalsTab({ company }: { company?: Company }) {
  if (!company) {
    return (
      <div className="text-center py-12">
        <Text c="dimmed">Loading signal data...</Text>
      </div>
    );
  }

  return (
    <Stack gap="lg">
      <Paper p="lg" radius="md" className="bg-white/5 border border-white/10">
        <Text fw={600} c="white" mb="md">Buying Signals Summary</Text>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <div className="p-4 rounded-lg bg-white/5 text-center">
              <Text size="xl" fw={700} c="white">{company.icp_score}</Text>
              <Text size="xs" c="dimmed">ICP Score</Text>
            </div>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <div className="p-4 rounded-lg bg-white/5 text-center">
              <Text size="xl" fw={700} c="white">{company.signal_score}</Text>
              <Text size="xs" c="dimmed">Signal Score</Text>
            </div>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <div className="p-4 rounded-lg bg-white/5 text-center">
              <Text size="xl" fw={700} c="white">{company.priority_score}</Text>
              <Text size="xs" c="dimmed">Priority Score</Text>
            </div>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <div className="p-4 rounded-lg bg-white/5 text-center">
              <StatusBadge status={company.status} size="lg" />
              <Text size="xs" c="dimmed" mt="xs">Status</Text>
            </div>
          </Grid.Col>
        </Grid>
      </Paper>

      {/* Partner tech signals */}
      {company.partner_tech && company.partner_tech.length > 0 && (
        <Paper p="lg" radius="md" className="bg-green-500/10 border border-green-500/30">
          <Group gap="xs" mb="md">
            <IconServer size={18} className="text-green-400" />
            <Text fw={600} c="green.4">Partner Technology Detected</Text>
          </Group>
          <Group gap="xs">
            {company.partner_tech.map((tech) => (
              <Badge key={tech} size="lg" variant="light" color="green">
                {tech}
              </Badge>
            ))}
          </Group>
          <Text size="sm" c="dimmed" mt="md">
            This company uses partner technologies that integrate well with Algolia.
            Strong co-sell opportunity.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
