/**
 * Sidebar Navigation Component
 *
 * Navigation sidebar with Algolia brand styling and glassmorphism effects.
 */

import { NavLink, Stack, Group, Text, Badge, ThemeIcon, Divider, Box, Progress } from '@mantine/core';
import {
  IconDashboard,
  IconBuilding,
  IconUpload,
  IconSettings,
  IconChartBar,
  IconTarget,
  IconBolt,
  IconDatabase,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '@/services/api';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string | number;
  badgeColor?: string;
}

const mainNavItems: NavItem[] = [
  { icon: IconDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: IconBuilding, label: 'Companies', path: '/companies' },
  { icon: IconUpload, label: 'Upload Lists', path: '/lists' },
  { icon: IconChartBar, label: 'Analytics', path: '/analytics' },
];

const secondaryNavItems: NavItem[] = [
  { icon: IconSettings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const enrichmentProgress = stats?.enriched_companies && stats?.total_companies
    ? Math.round((stats.enriched_companies / stats.total_companies) * 100)
    : 0;

  return (
    <Stack h="100%" justify="space-between" p="md">
      {/* Main Navigation */}
      <Box>
        <Text size="xs" fw={500} c="dimmed" tt="uppercase" mb="sm">
          Navigation
        </Text>
        <Stack gap="xs">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={
                <ThemeIcon variant="light" size="md" color="blue">
                  <item.icon size={16} />
                </ThemeIcon>
              }
              rightSection={
                item.badge ? (
                  <Badge size="sm" variant="filled" color={item.badgeColor || 'blue'}>
                    {item.badge}
                  </Badge>
                ) : null
              }
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              styles={{
                root: {
                  borderRadius: 'var(--mantine-radius-md)',
                  '&[data-active]': {
                    backgroundColor: 'rgba(0, 61, 255, 0.1)',
                    borderLeft: '3px solid var(--mantine-color-blue-6)',
                  },
                },
              }}
            />
          ))}
        </Stack>

        <Divider my="lg" />

        {/* Quick Stats */}
        <Text size="xs" fw={500} c="dimmed" tt="uppercase" mb="sm">
          Quick Stats
        </Text>
        <Stack gap="xs">
          <Group justify="space-between" px="sm" py="xs">
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="red">
                <IconTarget size={12} />
              </ThemeIcon>
              <Text size="sm">Hot Leads</Text>
            </Group>
            <Badge color="red" variant="filled" size="sm">
              {stats?.hot_leads || 0}
            </Badge>
          </Group>
          <Group justify="space-between" px="sm" py="xs">
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="orange">
                <IconBolt size={12} />
              </ThemeIcon>
              <Text size="sm">Warm Leads</Text>
            </Group>
            <Badge color="orange" variant="filled" size="sm">
              {stats?.warm_leads || 0}
            </Badge>
          </Group>
          <Group justify="space-between" px="sm" py="xs">
            <Group gap="xs">
              <ThemeIcon size="sm" variant="light" color="blue">
                <IconDatabase size={12} />
              </ThemeIcon>
              <Text size="sm">Total</Text>
            </Group>
            <Badge color="blue" variant="filled" size="sm">
              {stats?.total_companies?.toLocaleString() || 0}
            </Badge>
          </Group>
        </Stack>

        <Divider my="lg" />

        {/* Secondary Navigation */}
        <Text size="xs" fw={500} c="dimmed" tt="uppercase" mb="sm">
          Configuration
        </Text>
        <Stack gap="xs">
          {secondaryNavItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={
                <ThemeIcon variant="light" size="md" color="gray">
                  <item.icon size={16} />
                </ThemeIcon>
              }
              active={location.pathname === item.path}
              onClick={() => navigate(item.path)}
              styles={{
                root: {
                  borderRadius: 'var(--mantine-radius-md)',
                },
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Enrichment Progress Footer */}
      <Box
        p="md"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.1), rgba(84, 104, 255, 0.05))',
          borderRadius: 'var(--mantine-radius-md)',
          border: '1px solid rgba(0, 61, 255, 0.2)',
        }}
      >
        <Group justify="space-between" mb="xs">
          <Text size="xs" fw={500}>Enrichment Progress</Text>
          <Text size="xs" c="dimmed">{enrichmentProgress}%</Text>
        </Group>
        <Progress
          value={enrichmentProgress}
          size="sm"
          color="blue"
          animated={enrichmentProgress > 0 && enrichmentProgress < 100}
        />
        <Text size="xs" c="dimmed" mt="xs">
          {stats?.enriched_companies || 0} of {stats?.total_companies || 0} enriched
        </Text>
      </Box>
    </Stack>
  );
}
