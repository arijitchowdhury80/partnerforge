/**
 * AppShell - Algolia Brand
 *
 * Clean, professional layout matching Algolia's design language.
 * Light theme with white sidebar and Algolia Blue accents.
 */

import { AppShell as MantineAppShell, Group, Title, NavLink, Badge, ActionIcon, Tooltip, Text, Divider } from '@mantine/core';
import { IconDashboard, IconBuilding, IconSettings, IconRefresh, IconBell } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { PartnerSelector } from '@/components/layout/PartnerSelector';

// Algolia brand colors
const ALGOLIA_BLUE = '#003DFF';
const ALGOLIA_PURPLE = '#5468FF';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';
const GRAY_900 = '#0f172a';

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: IconDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: IconBuilding, label: 'Companies', path: '/companies' },
    { icon: IconSettings, label: 'Settings', path: '/settings' },
  ];

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm' }}
      padding={0}
      styles={{
        main: {
          background: GRAY_50,
          minHeight: '100vh',
        },
        header: {
          background: 'white',
          borderBottom: `1px solid ${GRAY_200}`,
        },
        navbar: {
          background: 'white',
          borderRight: `1px solid ${GRAY_200}`,
        },
      }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          {/* Left: Logo + Partner Selector */}
          <Group gap="lg">
            <Group gap="xs">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill={ALGOLIA_BLUE} />
                <path d="M7 8H11L12 12L13 8H17L14 16H10L7 8Z" fill="white" />
              </svg>
              <Title order={4} c={GRAY_900} fw={600}>PartnerForge</Title>
            </Group>

            <Divider orientation="vertical" color={GRAY_200} />

            <PartnerSelector />
          </Group>

          {/* Right: Actions */}
          <Group gap="sm">
            <Tooltip label="Notifications">
              <ActionIcon variant="subtle" size="lg" radius="md" color="gray">
                <IconBell size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Sync data">
              <ActionIcon variant="subtle" size="lg" radius="md" color="gray">
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
            <Badge variant="light" color="blue" size="sm">
              v3.0
            </Badge>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="md">
        <MantineAppShell.Section grow>
          <Text size="xs" fw={600} c={GRAY_500} tt="uppercase" mb="sm" px="sm">
            Navigation
          </Text>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={18} stroke={1.5} />}
              active={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              mb={4}
              styles={{
                root: {
                  borderRadius: 8,
                  color: GRAY_700,
                  fontWeight: 500,
                  '&:hover': {
                    background: GRAY_100,
                  },
                  '&[data-active]': {
                    background: `${ALGOLIA_BLUE}10`,
                    color: ALGOLIA_BLUE,
                    fontWeight: 600,
                  },
                },
                label: {
                  fontSize: 14,
                },
              }}
            />
          ))}
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <div
            style={{
              padding: 12,
              background: GRAY_50,
              borderRadius: 8,
              border: `1px solid ${GRAY_200}`,
            }}
          >
            <Text size="xs" c={GRAY_500} mb="xs" fw={500}>
              Intelligence Modules
            </Text>
            <Group gap="xs">
              <Badge size="sm" variant="light" color="green">
                15 Active
              </Badge>
              <Badge size="sm" variant="light" color="blue">
                4 Waves
              </Badge>
            </Group>
          </div>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
