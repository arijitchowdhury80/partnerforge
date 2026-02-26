import { AppShell as MantineAppShell, Group, Title, NavLink, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconDashboard, IconBuilding, IconSettings, IconRefresh, IconMoon, IconSun } from '@tabler/icons-react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useColorScheme } from '@mantine/hooks';

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const colorScheme = useColorScheme();

  const navItems = [
    { icon: IconDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: IconBuilding, label: 'Companies', path: '/companies' },
    { icon: IconSettings, label: 'Settings', path: '/settings' },
  ];

  return (
    <MantineAppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm' }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Title order={3} c="blue">PartnerForge</Title>
            <Badge variant="light" color="blue" size="sm">v2.0</Badge>
          </Group>
          <Group>
            <Tooltip label="Refresh data">
              <ActionIcon variant="subtle" size="lg">
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
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
            />
          ))}
        </MantineAppShell.Section>

        <MantineAppShell.Section>
          <Group justify="center" gap="xs">
            <Badge color="green" variant="dot">15 Modules</Badge>
            <Badge color="blue" variant="dot">4 Waves</Badge>
          </Group>
        </MantineAppShell.Section>
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>
        <Outlet />
      </MantineAppShell.Main>
    </MantineAppShell>
  );
}
