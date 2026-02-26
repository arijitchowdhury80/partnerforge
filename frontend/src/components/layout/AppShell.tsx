/**
 * AppShell - Main Layout Component
 *
 * Provides the main application structure with header, sidebar, and content area.
 * Features dark theme with glassmorphism effects and Algolia brand colors.
 */

import {
  AppShell as MantineAppShell,
  Group,
  Title,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Text,
  Burger,
  Box,
} from '@mantine/core';
import {
  IconRefresh,
  IconBell,
  IconUser,
  IconLogout,
  IconSettings,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { Outlet } from 'react-router-dom';
import { useDisclosure } from '@mantine/hooks';
import { useMantineColorScheme } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';

import { Sidebar } from './Sidebar';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';

export function AppShell() {
  const [opened, { toggle }] = useDisclosure();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
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
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
          minHeight: '100vh',
        },
        navbar: {
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
        header: {
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      {/* Header - Single Row */}
      <MantineAppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          {/* Left: Logo */}
          <Group gap="md">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="white" />

            <Group gap="sm">
              {/* Algolia Logo */}
              <AlgoliaLogo size={28} />
              <Title order={4} c="white" fw={600}>
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
                onClick={handleRefresh}
                style={{ color: 'rgba(255,255,255,0.6)' }}
                className="hover:text-white hover:bg-white/10"
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
                style={{ color: 'rgba(255,255,255,0.6)' }}
                className="hover:text-white hover:bg-white/10"
              >
                <IconBell size={20} />
              </ActionIcon>
            </Tooltip>

            {/* Theme Toggle */}
            <Tooltip label={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} mode`}>
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="md"
                onClick={() => toggleColorScheme()}
                style={{ color: 'rgba(255,255,255,0.6)' }}
                className="hover:text-white hover:bg-white/10"
              >
                {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
              </ActionIcon>
            </Tooltip>

            {/* User Menu */}
            <Menu shadow="xl" width={200}>
              <Menu.Target>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  radius="md"
                  style={{ color: 'rgba(255,255,255,0.6)' }}
                  className="hover:text-white hover:bg-white/10"
                >
                  <IconUser size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown
                style={{
                  background: 'rgba(26, 27, 30, 0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
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
              gradient={{ from: '#5468FF', to: '#8B5CF6' }}
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
