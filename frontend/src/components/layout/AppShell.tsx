/**
 * AppShell - Main Layout Component
 *
 * Provides the main application structure with header, sidebar, and content area.
 * Uses light theme with Algolia brand colors.
 */

import {
  AppShell as MantineAppShell,
  Group,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Burger,
} from '@mantine/core';
import {
  IconRefresh,
  IconBell,
  IconUser,
  IconLogout,
  IconSettings,
} from '@tabler/icons-react';
import { Outlet } from 'react-router-dom';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from './Sidebar';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';

// Light theme colors
const ALGOLIA_BLUE = '#003DFF';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';
const GRAY_700 = '#334155';
const GRAY_900 = '#0f172a';

export function AppShell() {
  const [opened, { toggle }] = useDisclosure();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
    notifications.show({
      title: 'Data Refreshed',
      message: 'All data has been reloaded from the server',
      color: 'blue',
    });
  };

  return (
    <MantineAppShell
      header={{ height: 64 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: {
          background: GRAY_50,
          minHeight: '100vh',
        },
        navbar: {
          background: 'white',
          borderRight: `1px solid ${GRAY_200}`,
        },
        header: {
          background: 'white',
          borderBottom: `1px solid ${GRAY_200}`,
        },
      }}
    >
      {/* Header - Single Row */}
      <MantineAppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          {/* Left: Logo */}
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color={GRAY_700} />

            <Group gap="sm">
              {/* Algolia Logo */}
              <AlgoliaLogo size={28} />
              <Title order={4} c={GRAY_900} fw={600}>
                PartnerForge
              </Title>
            </Group>
          </Group>

          {/* Right: Actions */}
          <Group gap="sm">
            {/* Refresh Button */}
            <Tooltip label="Refresh data">
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="md"
                color="gray"
                onClick={handleRefresh}
              >
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>

            {/* Notifications */}
            <Tooltip label="Notifications">
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="md"
                color="gray"
              >
                <IconBell size={20} />
              </ActionIcon>
            </Tooltip>

            {/* User Menu */}
            <Menu shadow="xl" width={200}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  radius="md"
                  color="gray"
                >
                  <IconUser size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Account</Menu.Label>
                <Menu.Item leftSection={<IconSettings size={14} />}>
                  Settings
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconLogout size={14} />} color="red">
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Version Badge */}
            <Badge
              variant="gradient"
              gradient={{ from: ALGOLIA_BLUE, to: '#5468FF' }}
              size="sm"
            >
              v3.0
            </Badge>
          </Group>
        </Group>
      </MantineAppShell.Header>

      {/* Sidebar Navigation */}
      <MantineAppShell.Navbar>
        <Sidebar />
      </MantineAppShell.Navbar>

      {/* Main Content */}
      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
