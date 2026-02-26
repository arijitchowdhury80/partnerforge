import { AppShell as MantineAppShell, Group, Title, NavLink, Badge, ActionIcon, Tooltip, Text, Divider } from '@mantine/core';
import { IconDashboard, IconBuilding, IconSettings, IconRefresh, IconBell } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { PartnerSelector } from '@/components/layout/PartnerSelector';

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
      header={{ height: 64 }}
      navbar={{ width: 260, breakpoint: 'sm' }}
      padding="md"
      styles={{
        main: {
          background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #16213e 100%)',
          minHeight: '100vh',
        },
        header: {
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        },
        navbar: {
          background: 'rgba(10, 10, 15, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      <MantineAppShell.Header>
        <Group h="100%" px="lg" justify="space-between">
          {/* Left: Logo + Partner Selector */}
          <Group gap="lg">
            <Group gap="xs">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#5468FF" />
                <path d="M7 8H11L12 12L13 8H17L14 16H10L7 8Z" fill="white" />
              </svg>
              <Title order={4} c="white" fw={600}>PartnerForge</Title>
            </Group>

            <Divider orientation="vertical" color="rgba(255,255,255,0.1)" />

            <PartnerSelector />
          </Group>

          {/* Right: Actions */}
          <Group gap="sm">
            <Tooltip label="Notifications">
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="md"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                <IconBell size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Sync data">
              <ActionIcon
                variant="subtle"
                size="lg"
                radius="md"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
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

      <MantineAppShell.Navbar p="md">
        <MantineAppShell.Section grow>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              leftSection={<item.icon size={20} />}
              active={location.pathname.startsWith(item.path)}
              onClick={() => navigate(item.path)}
              mb="xs"
              styles={{
                root: {
                  borderRadius: '8px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    background: 'rgba(255, 255, 255, 0.05)',
                  },
                  '&[data-active]': {
                    background: 'rgba(84, 104, 255, 0.15)',
                    color: 'white',
                    borderLeft: '3px solid #5468FF',
                  },
                },
              }}
            />
          ))}
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <div
            style={{
              padding: '12px',
              background: 'rgba(84, 104, 255, 0.1)',
              borderRadius: '10px',
              border: '1px solid rgba(84, 104, 255, 0.2)',
            }}
          >
            <Text size="xs" c="dimmed" mb="xs" fw={500}>
              Intelligence Modules
            </Text>
            <Group gap="xs">
              <Badge
                size="sm"
                variant="light"
                color="green"
              >
                15 Active
              </Badge>
              <Badge
                size="sm"
                variant="light"
                color="blue"
              >
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
