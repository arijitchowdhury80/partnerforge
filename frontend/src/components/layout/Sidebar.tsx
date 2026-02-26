/**
 * Sidebar Navigation Component
 *
 * Navigation sidebar with Algolia brand styling and glassmorphism effects.
 */

import { NavLink, Stack, Text, ThemeIcon, Box, Badge, Divider } from '@mantine/core';
import {
  IconDashboard,
  IconBuilding,
  IconUpload,
  IconSettings,
  IconChartBar,
  IconBell,
  IconBook,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EnrichmentPanel } from './EnrichmentPanel';

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
  { icon: IconBell, label: 'Alerts', path: '/alerts' },
  { icon: IconUpload, label: 'Upload Lists', path: '/lists' },
  { icon: IconChartBar, label: 'Analytics', path: '/analytics' },
];

const secondaryNavItems: NavItem[] = [
  { icon: IconBook, label: 'Documentation', path: '/docs' },
  { icon: IconSettings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Stack h="100%" justify="space-between" p="md">
      {/* Main Navigation */}
      <Box>
        <Text size="xs" fw={600} c="#64748b" tt="uppercase" mb="sm">
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
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: '#f1f5f9',
                  },
                  '&[data-active]': {
                    backgroundColor: 'rgba(0, 61, 255, 0.1)',
                    borderLeft: '3px solid var(--mantine-color-blue-6)',
                  },
                },
                label: {
                  color: '#334155',
                  fontWeight: 500,
                },
              }}
            />
          ))}
        </Stack>

        <Divider my="lg" />

        {/* Secondary Navigation */}
        <Text size="xs" fw={600} c="#64748b" tt="uppercase" mb="sm">
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
                  backgroundColor: 'transparent',
                  '&:hover': {
                    backgroundColor: '#f1f5f9',
                  },
                },
                label: {
                  color: '#334155',
                  fontWeight: 500,
                },
              }}
            />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
