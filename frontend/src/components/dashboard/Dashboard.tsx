import { useState } from 'react';
import { Container, Title, Grid, Paper, Group, Text, Badge, Button, SegmentedControl, TextInput } from '@mantine/core';
import { IconSearch, IconRefresh, IconFilter } from '@tabler/icons-react';
import { Card, Metric, Text as TremorText, DonutChart, BarList, AreaChart } from '@tremor/react';
import { useQuery } from '@tanstack/react-query';

import { getStats, getCompanies } from '@/services/api';
import { TargetTable } from './TargetTable';
import type { FilterState } from '@/types';

export function Dashboard() {
  const [filters, setFilters] = useState<FilterState>({
    sort_by: 'icp_score',
    sort_order: 'desc',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', filters],
    queryFn: () => getCompanies({ ...filters, limit: 50 }),
  });

  const statusData = [
    { name: 'Hot', value: stats?.hot_leads || 0 },
    { name: 'Warm', value: stats?.warm_leads || 0 },
    { name: 'Cool', value: 50 },
    { name: 'Cold', value: 100 },
  ];

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Partner Intelligence Dashboard</Title>
          <Text c="dimmed" size="sm">
            Displacement targets and enrichment status
          </Text>
        </div>
        <Button leftSection={<IconRefresh size={16} />} variant="light">
          Refresh All
        </Button>
      </Group>

      {/* Stats Cards - Using Tremor */}
      <Grid mb="lg">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card decoration="top" decorationColor="blue">
            <TremorText>Total Companies</TremorText>
            <Metric>{stats?.total_companies?.toLocaleString() || '—'}</Metric>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card decoration="top" decorationColor="green">
            <TremorText>Enriched</TremorText>
            <Metric>{stats?.enriched_companies?.toLocaleString() || '—'}</Metric>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card decoration="top" decorationColor="red">
            <TremorText>Hot Leads</TremorText>
            <Metric>{stats?.hot_leads || '—'}</Metric>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card decoration="top" decorationColor="orange">
            <TremorText>Warm Leads</TremorText>
            <Metric>{stats?.warm_leads || '—'}</Metric>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Charts Row */}
      <Grid mb="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper p="md" withBorder>
            <Text fw={500} mb="md">Lead Status Distribution</Text>
            <DonutChart
              data={statusData}
              category="value"
              index="name"
              colors={['red', 'orange', 'blue', 'gray']}
              showAnimation
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Paper p="md" withBorder>
            <Text fw={500} mb="md">Top ICP Scores</Text>
            <BarList
              data={[
                { name: 'Mercedes-Benz', value: 95 },
                { name: "Mark's", value: 85 },
                { name: 'Infiniti', value: 85 },
                { name: 'Allianz', value: 85 },
                { name: 'Chevrolet Mexico', value: 85 },
              ]}
              color="blue"
            />
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Paper p="md" mb="lg" withBorder>
        <Group>
          <TextInput
            placeholder="Search companies..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <SegmentedControl
            data={[
              { label: 'All', value: 'all' },
              { label: 'Hot', value: 'hot' },
              { label: 'Warm', value: 'warm' },
              { label: 'Cold', value: 'cold' },
            ]}
            value={filters.status || 'all'}
            onChange={(value) =>
              setFilters((prev) => ({
                ...prev,
                status: value === 'all' ? undefined : (value as 'hot' | 'warm' | 'cold'),
              }))
            }
          />
          <Button variant="subtle" leftSection={<IconFilter size={16} />}>
            More Filters
          </Button>
        </Group>
      </Paper>

      {/* Data Table */}
      <Paper p="md" withBorder>
        <TargetTable
          companies={companies?.data || []}
          loading={companiesLoading}
          pagination={companies?.pagination}
        />
      </Paper>
    </Container>
  );
}
