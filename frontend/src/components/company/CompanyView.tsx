/**
 * CompanyView Component
 *
 * Full company detail view with all 15 intelligence modules.
 * Features tabbed interface: Overview | Intelligence | Changes | Alerts
 * Glassmorphism dark theme with source citations visible on hover.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Tabs,
  Paper,
  Grid,
  Text,
  Badge,
  Group,
  Stack,
  Alert,
  Skeleton,
  Box,
  ThemeIcon,
  Progress,
  ScrollArea,
} from '@mantine/core';
import {
  IconLayoutDashboard,
  IconBrain,
  IconTimeline,
  IconBell,
  IconAlertCircle,
  IconTrendingUp,
  IconUsers,
  IconCoin,
  IconChartLine,
  IconServer,
  IconBriefcase,
  IconQuote,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Metric, Text as TremorText, AreaChart, DonutChart, BarList } from '@tremor/react';

import { getCompany, getIntelOverview, triggerEnrichment } from '@/services/api';
import { CompanyHeader } from './CompanyHeader';
import { IntelligenceModules, MODULE_CONFIGS, type ModuleData } from './IntelligenceModules';
import { ChangeTimeline, type ChangeEntry } from './ChangeTimeline';
import { SourceBadge } from '@/components/common/SourceBadge';
import type { ModuleId, Company } from '@/types';

// =============================================================================
// Mock Data (until API endpoints are ready)
// =============================================================================

const generateMockChanges = (domain: string): ChangeEntry[] => {
  const now = new Date();
  return [
    {
      id: '1',
      domain,
      module_id: 'm03_traffic',
      change_type: 'value_change',
      field: 'Monthly Visits',
      old_value: '12.5M',
      new_value: '14.2M',
      significance: 'high',
      detected_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      description: 'Significant traffic increase detected, possibly due to seasonal campaign',
    },
    {
      id: '2',
      domain,
      module_id: 'm06_hiring',
      change_type: 'new_data',
      field: 'New VP Engineering Role',
      new_value: 'VP of Engineering - Search Infrastructure',
      significance: 'high',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(),
      description: 'High-level search role posted, indicating strategic focus on search',
    },
    {
      id: '3',
      domain,
      module_id: 'm04_financials',
      change_type: 'value_change',
      field: 'Stock Price',
      old_value: '$142.50',
      new_value: '$148.75',
      significance: 'medium',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: '4',
      domain,
      module_id: 'm02_tech_stack',
      change_type: 'status_change',
      field: 'Search Provider',
      old_value: 'Elasticsearch',
      new_value: 'Elasticsearch (investigating alternatives)',
      significance: 'high',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 48).toISOString(),
      description: 'Tech stack analysis indicates potential search platform evaluation',
    },
    {
      id: '5',
      domain,
      module_id: 'm05_competitors',
      change_type: 'new_data',
      field: 'Competitor Using Algolia',
      new_value: 'CompetitorCo switched to Algolia',
      significance: 'medium',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 72).toISOString(),
    },
  ];
};

const generateMockModuleData = (overview: Record<string, { status: string; last_updated?: string }>): Record<ModuleId, ModuleData> => {
  const moduleData: Record<ModuleId, ModuleData> = {} as Record<ModuleId, ModuleData>;

  MODULE_CONFIGS.forEach((config) => {
    const status = overview[config.id] || { status: 'pending' };
    moduleData[config.id] = {
      status: {
        status: status.status as ModuleData['status']['status'],
        last_updated: status.last_updated,
        freshness: status.last_updated ? 'fresh' : undefined,
      },
      source: status.last_updated ? {
        url: `https://api.partnerforge.com/intel/${config.id}`,
        date: status.last_updated,
        type: 'api',
      } : undefined,
      summary: status.status === 'complete' ? `${config.name} data enriched successfully.` : undefined,
    };
  });

  return moduleData;
};

// =============================================================================
// Stat Card Component
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; direction: 'up' | 'down' | 'neutral' };
}

function StatCard({ title, value, subtitle, icon: Icon, color, trend }: StatCardProps) {
  return (
    <Paper
      p="md"
      radius="md"
      style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(100, 116, 139, 0.2)',
      }}
    >
      <Group justify="space-between" align="flex-start">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={500}>
            {title}
          </Text>
          <Text size="xl" fw={700} mt={4}>
            {value}
          </Text>
          {subtitle && (
            <Text size="xs" c="dimmed" mt={2}>
              {subtitle}
            </Text>
          )}
          {trend && (
            <Badge
              size="xs"
              variant="light"
              color={trend.direction === 'up' ? 'green' : trend.direction === 'down' ? 'red' : 'gray'}
              mt={4}
            >
              {trend.direction === 'up' ? '+' : trend.direction === 'down' ? '-' : ''}
              {trend.value}%
            </Badge>
          )}
        </div>
        <ThemeIcon variant="light" color={color} size="lg" radius="md">
          <Icon size={20} />
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

// =============================================================================
// Overview Tab Content
// =============================================================================

interface OverviewTabProps {
  company?: Company;
  isLoading: boolean;
}

function OverviewTab({ company, isLoading }: OverviewTabProps) {
  if (isLoading) {
    return (
      <Grid gutter="md">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
            <Skeleton height={120} radius="md" />
          </Grid.Col>
        ))}
      </Grid>
    );
  }

  // Mock traffic data for chart
  const trafficData = [
    { month: 'Aug', visits: 10.2 },
    { month: 'Sep', visits: 11.5 },
    { month: 'Oct', visits: 11.8 },
    { month: 'Nov', visits: 12.5 },
    { month: 'Dec', visits: 13.2 },
    { month: 'Jan', visits: 14.2 },
  ];

  // Mock device distribution
  const deviceData = [
    { name: 'Desktop', value: 58 },
    { name: 'Mobile', value: 38 },
    { name: 'Tablet', value: 4 },
  ];

  // Mock traffic sources
  const trafficSources = [
    { name: 'Organic Search', value: 45 },
    { name: 'Direct', value: 28 },
    { name: 'Referral', value: 15 },
    { name: 'Social', value: 8 },
    { name: 'Paid', value: 4 },
  ];

  return (
    <Stack gap="lg">
      {/* Key Metrics */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <StatCard
            title="ICP Score"
            value={company?.icp_score || 0}
            subtitle="out of 100"
            icon={IconTrendingUp}
            color={company?.icp_score && company.icp_score >= 80 ? 'red' : company?.icp_score && company.icp_score >= 60 ? 'orange' : 'blue'}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Signal Score"
            value={company?.signal_score || 0}
            subtitle="buying signals detected"
            icon={IconBrain}
            color="violet"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <StatCard
            title="Priority Rank"
            value={`#${company?.priority_score || '—'}`}
            subtitle="in target list"
            icon={IconUsers}
            color="green"
          />
        </Grid.Col>
      </Grid>

      {/* Charts Row */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper
            p="md"
            radius="md"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
            }}
          >
            <Text size="sm" fw={600} mb="md">
              Traffic Trend (6 months)
            </Text>
            <AreaChart
              data={trafficData}
              index="month"
              categories={['visits']}
              colors={['blue']}
              valueFormatter={(v) => `${v}M`}
              showLegend={false}
              showYAxis={true}
              showXAxis={true}
              className="h-48"
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper
            p="md"
            radius="md"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
            }}
          >
            <Text size="sm" fw={600} mb="md">
              Device Distribution
            </Text>
            <DonutChart
              data={deviceData}
              category="value"
              index="name"
              colors={['blue', 'cyan', 'violet']}
              valueFormatter={(v: number) => `${v}%`}
              showLabel
              className="h-48"
            />
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Info Cards Row */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            p="md"
            radius="md"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
            }}
          >
            <Text size="sm" fw={600} mb="md">
              Traffic Sources
            </Text>
            <BarList
              data={trafficSources}
              valueFormatter={(v: number) => `${v}%`}
              color="blue"
              className="mt-2"
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Paper
            p="md"
            radius="md"
            h="100%"
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
            }}
          >
            <Text size="sm" fw={600} mb="md">
              Company Details
            </Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Industry</Text>
                <Text size="sm">{company?.industry || '—'}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Vertical</Text>
                <Badge variant="light" color="blue" size="sm">
                  {company?.vertical || '—'}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Employees</Text>
                <Text size="sm">{company?.employee_count?.toLocaleString() || '—'}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Founded</Text>
                <Text size="sm">{company?.founded_year || '—'}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Public/Private</Text>
                <Badge variant="light" color={company?.is_public ? 'green' : 'gray'} size="sm">
                  {company?.is_public ? 'Public' : 'Private'}
                </Badge>
              </Group>
            </Stack>
          </Paper>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

// =============================================================================
// Alerts Tab Content (Placeholder)
// =============================================================================

function AlertsTab({ domain }: { domain: string }) {
  return (
    <Paper
      p="xl"
      radius="md"
      style={{
        background: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(100, 116, 139, 0.2)',
        textAlign: 'center',
      }}
    >
      <ThemeIcon variant="light" color="gray" size="xl" radius="xl" mb="md">
        <IconBell size={24} />
      </ThemeIcon>
      <Text size="lg" fw={600} mb="xs">
        Company Alerts
      </Text>
      <Text c="dimmed" size="sm" maw={400} mx="auto">
        Set up alerts to get notified when intelligence changes for {domain}.
        Configure your alert rules in the Alerts page.
      </Text>
    </Paper>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CompanyView() {
  const { domain } = useParams<{ domain: string }>();
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const queryClient = useQueryClient();

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

  // Enrichment mutation
  const enrichMutation = useMutation({
    mutationFn: ({ domain, force }: { domain: string; force: boolean }) =>
      triggerEnrichment(domain, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', domain] });
      queryClient.invalidateQueries({ queryKey: ['intel-overview', domain] });
      notifications.show({
        title: 'Enrichment Started',
        message: `Processing intelligence for ${domain}`,
        color: 'blue',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Enrichment Failed',
        message: error.message,
        color: 'red',
      });
    },
  });

  const handleRefresh = () => {
    if (domain) {
      enrichMutation.mutate({ domain, force: true });
    }
  };

  const handleExport = () => {
    notifications.show({
      title: 'Export Started',
      message: 'Company data export will download shortly',
      color: 'blue',
    });
  };

  const handleAddToList = () => {
    notifications.show({
      title: 'Add to List',
      message: 'Select a list to add this company to',
      color: 'blue',
    });
  };

  // Prepare module data
  const moduleData = intelOverview?.modules
    ? generateMockModuleData(intelOverview.modules)
    : ({} as Record<ModuleId, ModuleData>);

  // Mock changes
  const changes = domain ? generateMockChanges(domain) : [];

  if (companyError) {
    return (
      <Container size="xl" py="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error Loading Company"
          color="red"
          variant="filled"
        >
          Failed to load company data for {domain}. Please try again.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <CompanyHeader
          company={company}
          isLoading={companyLoading}
          onRefresh={handleRefresh}
          onExport={handleExport}
          onAddToList={handleAddToList}
          isRefreshing={enrichMutation.isPending}
        />

        {/* Tabbed Content */}
        <Paper
          radius="lg"
          style={{
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(100, 116, 139, 0.2)',
            overflow: 'hidden',
          }}
        >
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
              }}
            >
              <Tabs.Tab
                value="overview"
                leftSection={<IconLayoutDashboard size={16} />}
              >
                Overview
              </Tabs.Tab>
              <Tabs.Tab
                value="intelligence"
                leftSection={<IconBrain size={16} />}
              >
                Intelligence
                <Badge size="xs" variant="filled" color="blue" ml={6}>
                  {MODULE_CONFIGS.length}
                </Badge>
              </Tabs.Tab>
              <Tabs.Tab
                value="changes"
                leftSection={<IconTimeline size={16} />}
              >
                Changes
                {changes.length > 0 && (
                  <Badge size="xs" variant="filled" color="orange" ml={6}>
                    {changes.length}
                  </Badge>
                )}
              </Tabs.Tab>
              <Tabs.Tab
                value="alerts"
                leftSection={<IconBell size={16} />}
              >
                Alerts
              </Tabs.Tab>
            </Tabs.List>

            <Box p="lg">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Tabs.Panel value="overview">
                    <OverviewTab company={company} isLoading={companyLoading} />
                  </Tabs.Panel>

                  <Tabs.Panel value="intelligence">
                    <IntelligenceModules
                      domain={domain || ''}
                      modules={moduleData}
                      isLoading={intelLoading}
                      onRefreshModule={(moduleId) => {
                        notifications.show({
                          title: 'Module Refresh',
                          message: `Refreshing ${moduleId} for ${domain}`,
                          color: 'blue',
                        });
                      }}
                    />
                  </Tabs.Panel>

                  <Tabs.Panel value="changes">
                    <ChangeTimeline
                      domain={domain || ''}
                      changes={changes}
                      isLoading={false}
                      onRefresh={() => {
                        notifications.show({
                          title: 'Refreshing Changes',
                          message: 'Fetching latest changes...',
                          color: 'blue',
                        });
                      }}
                    />
                  </Tabs.Panel>

                  <Tabs.Panel value="alerts">
                    <AlertsTab domain={domain || ''} />
                  </Tabs.Panel>
                </motion.div>
              </AnimatePresence>
            </Box>
          </Tabs>
        </Paper>
      </Stack>
    </Container>
  );
}
