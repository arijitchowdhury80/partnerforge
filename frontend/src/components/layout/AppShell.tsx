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
import { PartnerSelector } from './PartnerSelector';

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
      header={{ height: 110 }}
      navbar={{
        width: 280,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
      styles={{
        main: {
          background: 'var(--mantine-color-dark-8)',
        },
        navbar: {
          background: 'linear-gradient(180deg, var(--mantine-color-dark-7), var(--mantine-color-dark-8))',
          borderRight: '1px solid var(--mantine-color-dark-5)',
        },
        header: {
          background: 'linear-gradient(90deg, rgba(0, 61, 255, 0.1), rgba(84, 104, 255, 0.05))',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0, 61, 255, 0.2)',
        },
      }}
    >
      {/* Header */}
      <MantineAppShell.Header>
        <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Top Row: Logo & Actions */}
          <Group h={60} px="md" justify="space-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {/* Left: Logo & Brand */}
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                {/* Logo Icon */}
                <Box
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #003DFF, #5468FF)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                    color: 'white',
                  }}
                >
                  PF
                </Box>
                <div>
                  <Title order={4} c="blue.4" style={{ lineHeight: 1.2 }}>
                    PartnerForge
                  </Title>
                  <Text size="xs" c="dimmed">
                    Partner Intelligence Platform
                  </Text>
                </div>
              </Box>
              <Badge
                variant="gradient"
                gradient={{ from: 'blue', to: 'cyan' }}
                size="sm"
                ml="sm"
              >
                v3.0
              </Badge>
            </Group>

            {/* Right: Actions */}
            <Group gap="xs">
              {/* Refresh Button */}
              <Tooltip label="Refresh all data">
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={handleRefresh}
                  color="blue"
                >
                  <IconRefresh size={20} />
                </ActionIcon>
              </Tooltip>

              {/* Notifications */}
              <Tooltip label="Notifications">
                <ActionIcon variant="subtle" size="lg" color="gray">
                  <IconBell size={20} />
                </ActionIcon>
              </Tooltip>

              {/* Theme Toggle */}
              <Tooltip label={`Switch to ${colorScheme === 'dark' ? 'light' : 'dark'} mode`}>
                <ActionIcon
                  variant="subtle"
                  size="lg"
                  onClick={() => toggleColorScheme()}
                  color="gray"
                >
                  {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
                </ActionIcon>
              </Tooltip>

              {/* User Menu */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="subtle" size="lg" color="gray">
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
            </Group>
          </Group>

          {/* Bottom Row: Partner Selector */}
          <Group h={50} px="md" justify="center" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <PartnerSelector />
          </Group>
        </Box>
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
