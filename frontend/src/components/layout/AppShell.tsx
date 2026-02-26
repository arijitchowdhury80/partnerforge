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

// Algolia Brand Colors (Official)
const ALGOLIA_NEBULA_BLUE = '#003DFF';   // Primary - CTAs, headers
const ALGOLIA_SPACE_GRAY = '#21243D';    // Body text, headings
const ALGOLIA_PURPLE = '#5468FF';        // Accents, highlights
const ALGOLIA_WHITE = '#FFFFFF';         // Backgrounds
const ALGOLIA_LIGHT_GRAY = '#F5F5F7';    // Alternating sections
const ALGOLIA_BORDER = '#E8E8ED';        // Borders

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
          background: ALGOLIA_LIGHT_GRAY,
          minHeight: '100vh',
          fontFamily: "'Source Sans 3', 'Source Sans Pro', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        navbar: {
          background: ALGOLIA_WHITE,
          borderRight: `1px solid ${ALGOLIA_BORDER}`,
        },
        header: {
          background: ALGOLIA_WHITE,
          borderBottom: `1px solid ${ALGOLIA_BORDER}`,
        },
      }}
    >
      {/* Header - Single Row */}
      <MantineAppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          {/* Left: Logo */}
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color={ALGOLIA_SPACE_GRAY} />

            <Group gap="sm">
              {/* Algolia Logo */}
              <AlgoliaLogo size={32} />
              <Title order={3} c={ALGOLIA_SPACE_GRAY} fw={700} style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
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

            {/* Version Badge - Algolia Brand */}
            <Badge
              variant="gradient"
              gradient={{ from: ALGOLIA_NEBULA_BLUE, to: ALGOLIA_PURPLE }}
              size="lg"
              style={{ fontWeight: 700, fontSize: 14, padding: '8px 16px' }}
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
