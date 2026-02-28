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
    path: '/dashboard',
  },
  {
    icon: IconFlame,
    label: 'Whale Composite',
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
      description={item.description}
      leftSection={
        <ThemeIcon variant="light" size="md" color={color}>
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
        description: {
          color: '#94a3b8',
          fontSize: '11px',
        },
      }}
    />
  );

  return (
    <Stack h="100%" justify="space-between" p="md">
      <Box>
        {/* Funnel Layers */}
        <Text size="xs" fw={600} c="#64748b" tt="uppercase" mb="sm">
          5-Layer Funnel
        </Text>
        <Stack gap="xs">
          {funnelNavItems.map((item) => renderNavItem(item, 'blue'))}
        </Stack>

        <Divider my="lg" />

        {/* Tools */}
        <Text size="xs" fw={600} c="#64748b" tt="uppercase" mb="sm">
          Tools
        </Text>
        <Stack gap="xs">
          {toolsNavItems.map((item) => renderNavItem(item, 'violet'))}
        </Stack>

        <Divider my="lg" />

        {/* Configuration */}
        <Text size="xs" fw={600} c="#64748b" tt="uppercase" mb="sm">
          Configuration
        </Text>
        <Stack gap="xs">
          {secondaryNavItems.map((item) => renderNavItem(item, 'gray'))}
        </Stack>
      </Box>
    </Stack>
  );
}
