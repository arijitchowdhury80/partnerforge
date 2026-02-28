/**
 * Sidebar Navigation Component
 *
 * Navigation sidebar with v2 5-layer funnel structure.
 * Layers: ICP → Galaxy (L0) → Whale (L2) → Crossbeam (L3) → Hot Targets
 */

import { NavLink, Stack, Text, ThemeIcon, Box, Badge, Divider } from '@mantine/core';
import {
  IconTarget,
  IconPlanet,
  IconFlame,
  IconUsers,
  IconUpload,
  IconSettings,
  IconChartBar,
  IconBook,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string | number;
  badgeColor?: string;
  description?: string;
}

// Dashboard
const dashboardNavItem: NavItem = {
  icon: IconChartBar,
  label: 'Dashboard',
  path: '/dashboard',
};

// 5-Layer Funnel Navigation
const funnelNavItems: NavItem[] = [
  {
    icon: IconTarget,
    label: 'ICP Definition',
    path: '/icp',
  },
  {
    icon: IconPlanet,
    label: 'Partner Tech Galaxy',
    path: '/galaxy',
  },
  {
    icon: IconFlame,
    label: 'Demandbase+Zoominfo',
    path: '/whale',
    badge: '776',
    badgeColor: 'orange',
  },
  {
    icon: IconUsers,
    label: 'Crossbeam',
    path: '/crossbeam',
    badge: '489',
    badgeColor: 'teal',
  },
];

const toolsNavItems: NavItem[] = [
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

  const renderNavItem = (item: NavItem, color: string = 'blue') => (
    <NavLink
      key={item.path}
      label={item.label}
      leftSection={
        <ThemeIcon variant="light" size={44} radius="md" color={color}>
          <item.icon size={24} />
        </ThemeIcon>
      }
      rightSection={
        item.badge ? (
          <Badge size="lg" variant="filled" color={item.badgeColor || 'blue'} style={{ fontSize: '14px', padding: '8px 12px' }}>
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
          padding: '14px 16px',
          marginBottom: '8px',
          '&:hover': {
            backgroundColor: '#f1f5f9',
          },
          '&[data-active]': {
            backgroundColor: 'rgba(0, 61, 255, 0.1)',
            borderLeft: '4px solid var(--mantine-color-blue-6)',
          },
        },
        label: {
          color: '#334155',
          fontWeight: 600,
          fontSize: '18px',
        },
      }}
    />
  );

  return (
    <Stack h="100%" justify="space-between" p="lg">
      <Box>
        {/* Dashboard */}
        {renderNavItem(dashboardNavItem, 'blue')}

        <Divider my="lg" />

        {/* Funnel Layers */}
        <Text size="md" fw={700} c="#64748b" tt="uppercase" mb="md" style={{ letterSpacing: '0.5px' }}>
          Pipeline Layers
        </Text>
        <Stack gap="sm">
          {funnelNavItems.map((item) => renderNavItem(item, 'blue'))}
        </Stack>

        <Divider my="xl" />

        {/* Tools */}
        <Text size="md" fw={700} c="#64748b" tt="uppercase" mb="md" style={{ letterSpacing: '0.5px' }}>
          Tools
        </Text>
        <Stack gap="sm">
          {toolsNavItems.map((item) => renderNavItem(item, 'violet'))}
        </Stack>

        <Divider my="xl" />

        {/* Configuration */}
        <Text size="md" fw={700} c="#64748b" tt="uppercase" mb="md" style={{ letterSpacing: '0.5px' }}>
          Configuration
        </Text>
        <Stack gap="sm">
          {secondaryNavItems.map((item) => renderNavItem(item, 'gray'))}
        </Stack>
      </Box>
    </Stack>
  );
}
