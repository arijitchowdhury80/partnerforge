/**
 * AlertsPage
 *
 * Route: /alerts
 * Alert management dashboard with AlertCenter and rule configuration.
 */

import { useState, useMemo } from 'react';
import {
  Container,
  Tabs,
  Paper,
  Text,
  Button,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Modal,
  Tooltip,
  Table,
  Switch,
  Menu,
  ScrollArea,
  Skeleton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBell,
  IconSettings,
  IconPlus,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCopy,
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import {
  AlertCenter,
  AlertRuleForm,
  type Alert,
  type AlertRule,
} from '@/components/alerts';
import { MODULE_CONFIGS } from '@/components/company/IntelligenceModules';
import type { ModuleId } from '@/types';

// =============================================================================
// Mock Data
// =============================================================================

const generateMockAlerts = (): Alert[] => {
  const now = new Date();
  return [
    {
      id: '1',
      domain: 'mercedes-benz.com',
      company_name: 'Mercedes-Benz',
      module_id: 'm03_traffic',
      change_type: 'value_change',
      field: 'Monthly Visits',
      old_value: '45.2M',
      new_value: '52.8M',
      priority: 'high',
      status: 'unread',
      message: 'Mercedes-Benz traffic increased by 16.8%',
      details: 'Significant traffic growth detected. May indicate successful marketing campaign or seasonal demand.',
      detected_at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      rule_name: 'Traffic Spike Alert',
    },
    {
      id: '2',
      domain: 'infiniti.com',
      company_name: 'Infiniti',
      module_id: 'm06_hiring',
      change_type: 'new_data',
      field: 'VP of Digital Experience',
      new_value: 'New leadership role posted',
      priority: 'high',
      status: 'unread',
      message: 'Infiniti posted VP of Digital Experience role',
      details: 'Senior digital leadership hire signals potential technology transformation initiative.',
      detected_at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      rule_name: 'Executive Hiring',
    },
    {
      id: '3',
      domain: 'marks.com',
      company_name: "Mark's",
      module_id: 'm02_tech_stack',
      change_type: 'status_change',
      field: 'Search Provider',
      old_value: 'Elasticsearch',
      new_value: 'Elasticsearch (RFP initiated)',
      priority: 'high',
      status: 'unread',
      message: "Mark's initiated search platform RFP",
      details: 'BuiltWith detected RFP-related technology signals. High displacement opportunity.',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(),
      rule_name: 'Tech Change Alert',
    },
    {
      id: '4',
      domain: 'allianz.com',
      company_name: 'Allianz',
      module_id: 'm04_financials',
      change_type: 'value_change',
      field: 'Stock Price',
      old_value: '$285.40',
      new_value: '$298.75',
      priority: 'medium',
      status: 'read',
      message: 'Allianz stock price increased 4.7%',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: '5',
      domain: 'chevrolet.com.mx',
      company_name: 'Chevrolet Mexico',
      module_id: 'm09_executive',
      change_type: 'new_data',
      field: 'Executive Quote',
      new_value: 'CEO emphasized digital commerce priority in earnings call',
      priority: 'medium',
      status: 'read',
      message: 'Chevrolet Mexico CEO mentioned digital commerce focus',
      details: 'Q4 earnings call transcript revealed strategic focus on digital customer experience.',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 12).toISOString(),
      rule_name: 'Executive Statement',
    },
    {
      id: '6',
      domain: 'hofer.at',
      company_name: 'HOFER',
      module_id: 'm05_competitors',
      change_type: 'new_data',
      field: 'Competitor Migration',
      new_value: 'Competitor ALDI switched to Algolia',
      priority: 'low',
      status: 'read',
      message: "HOFER's competitor ALDI adopted Algolia",
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: '7',
      domain: 'fiat.com',
      company_name: 'Fiat',
      module_id: 'm03_traffic',
      change_type: 'threshold_crossed',
      field: 'Bounce Rate',
      old_value: '42%',
      new_value: '51%',
      priority: 'medium',
      status: 'unread',
      message: 'Fiat bounce rate exceeded 50% threshold',
      details: 'Site experience may be degrading. Opportunity to position Algolia as UX improvement.',
      detected_at: new Date(now.getTime() - 1000 * 60 * 60 * 36).toISOString(),
      rule_name: 'UX Metric Alert',
    },
  ];
};

const generateMockRules = (): AlertRule[] => [
  {
    id: 'rule-1',
    name: 'Traffic Spike Alert',
    description: 'Alert when traffic increases by more than 15%',
    domains: 'all',
    modules: ['m03_traffic'],
    change_types: ['value_change'],
    priority: 'any',
    thresholds: [{ field: 'monthly_visits_change', operator: 'gt', value: 15 }],
    channels: ['in_app', 'email'],
    is_active: true,
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'rule-2',
    name: 'Executive Hiring',
    description: 'Alert on VP+ level hires related to digital/search',
    domains: 'all',
    modules: ['m06_hiring'],
    change_types: ['new_data'],
    priority: 'high',
    thresholds: [],
    channels: ['in_app', 'slack'],
    is_active: true,
    created_at: '2026-02-05T14:30:00Z',
  },
  {
    id: 'rule-3',
    name: 'Tech Change Alert',
    description: 'Alert when search provider status changes',
    domains: ['marks.com', 'mercedes-benz.com', 'infiniti.com'],
    modules: ['m02_tech_stack'],
    change_types: ['status_change', 'value_change'],
    priority: 'any',
    thresholds: [],
    channels: ['in_app', 'email', 'slack'],
    is_active: true,
    created_at: '2026-02-10T09:00:00Z',
  },
  {
    id: 'rule-4',
    name: 'Executive Statement',
    description: 'Alert on executive quotes mentioning digital/search/experience',
    domains: 'all',
    modules: ['m09_executive'],
    change_types: ['new_data'],
    priority: 'medium',
    thresholds: [],
    channels: ['in_app'],
    is_active: true,
    created_at: '2026-02-12T16:00:00Z',
  },
  {
    id: 'rule-5',
    name: 'UX Metric Alert',
    description: 'Alert when bounce rate exceeds 50% or time on site drops',
    domains: 'all',
    modules: ['m03_traffic'],
    change_types: ['threshold_crossed'],
    priority: 'any',
    thresholds: [
      { field: 'bounce_rate', operator: 'gt', value: 50 },
      { field: 'avg_visit_duration', operator: 'lt', value: 120 },
    ],
    channels: ['in_app'],
    is_active: false,
    created_at: '2026-02-15T11:00:00Z',
  },
];

// =============================================================================
// Rules Table Component
// =============================================================================

interface RulesTableProps {
  rules: AlertRule[];
  onEdit: (rule: AlertRule) => void;
  onDelete: (ruleId: string) => void;
  onToggle: (ruleId: string, active: boolean) => void;
  onDuplicate: (rule: AlertRule) => void;
}

function RulesTable({ rules, onEdit, onDelete, onToggle, onDuplicate }: RulesTableProps) {
  const getModuleLabel = (moduleId: ModuleId) => {
    const config = MODULE_CONFIGS.find((m) => m.id === moduleId);
    return config?.shortName || moduleId;
  };

  return (
    <ScrollArea>
      <Table verticalSpacing="sm" highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Rule Name</Table.Th>
            <Table.Th>Domains</Table.Th>
            <Table.Th>Modules</Table.Th>
            <Table.Th>Channels</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={100}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rules.map((rule) => (
            <Table.Tr key={rule.id}>
              <Table.Td>
                <Stack gap={2}>
                  <Text size="sm" fw={500}>
                    {rule.name}
                  </Text>
                  {rule.description && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {rule.description}
                    </Text>
                  )}
                </Stack>
              </Table.Td>
              <Table.Td>
                {rule.domains === 'all' ? (
                  <Badge variant="light" color="blue" size="sm">
                    All Domains
                  </Badge>
                ) : (
                  <Text size="sm" c="dimmed">
                    {rule.domains.length} domain{rule.domains.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {rule.modules.slice(0, 2).map((moduleId) => (
                    <Badge key={moduleId} variant="dot" color="gray" size="xs">
                      {getModuleLabel(moduleId)}
                    </Badge>
                  ))}
                  {rule.modules.length > 2 && (
                    <Text size="xs" c="dimmed">
                      +{rule.modules.length - 2}
                    </Text>
                  )}
                </Group>
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {rule.channels.map((channel) => (
                    <Badge key={channel} variant="outline" color="gray" size="xs">
                      {channel}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Switch
                  checked={rule.is_active}
                  onChange={(e) => onToggle(rule.id!, e.currentTarget.checked)}
                  size="sm"
                />
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <Tooltip label="Edit rule">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      size="sm"
                      onClick={() => onEdit(rule)}
                    >
                      <IconEdit size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Menu shadow="md" width={150}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray" size="sm">
                        <IconDotsVertical size={14} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconCopy size={14} />}
                        onClick={() => onDuplicate(rule)}
                      >
                        Duplicate
                      </Menu.Item>
                      <Menu.Item
                        leftSection={
                          rule.is_active ? (
                            <IconPlayerPause size={14} />
                          ) : (
                            <IconPlayerPlay size={14} />
                          )
                        }
                        onClick={() => onToggle(rule.id!, !rule.is_active)}
                      >
                        {rule.is_active ? 'Pause' : 'Enable'}
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => onDelete(rule.id!)}
                      >
                        Delete
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function AlertsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('alerts');
  const [ruleModalOpened, { open: openRuleModal, close: closeRuleModal }] = useDisclosure(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);

  // Mock data (replace with real hooks later)
  const [alerts, setAlerts] = useState<Alert[]>(() => generateMockAlerts());
  const [rules, setRules] = useState<AlertRule[]>(() => generateMockRules());
  const isLoading = false;

  // Available domains for rule form
  const availableDomains = useMemo(() => {
    const domains = new Set(alerts.map((a) => a.domain));
    return Array.from(domains).map((d) => ({ value: d, label: d }));
  }, [alerts]);

  // Alert handlers
  const handleMarkRead = (ids: string[]) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        ids.includes(alert.id)
          ? { ...alert, status: 'read' as const, read_at: new Date().toISOString() }
          : alert
      )
    );
    notifications.show({
      title: 'Alerts Updated',
      message: `Marked ${ids.length} alert${ids.length !== 1 ? 's' : ''} as read`,
      color: 'blue',
    });
  };

  const handleMarkAllRead = () => {
    const unreadIds = alerts.filter((a) => a.status === 'unread').map((a) => a.id);
    handleMarkRead(unreadIds);
  };

  const handleDismiss = (ids: string[]) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        ids.includes(alert.id) ? { ...alert, status: 'dismissed' as const } : alert
      )
    );
    notifications.show({
      title: 'Alerts Dismissed',
      message: `Dismissed ${ids.length} alert${ids.length !== 1 ? 's' : ''}`,
      color: 'gray',
    });
  };

  const handleRefreshAlerts = () => {
    notifications.show({
      title: 'Refreshing Alerts',
      message: 'Checking for new alerts...',
      color: 'blue',
      loading: true,
      autoClose: 2000,
    });
  };

  // Rule handlers
  const handleCreateRule = () => {
    setEditingRule(null);
    openRuleModal();
  };

  const handleEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    openRuleModal();
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    notifications.show({
      title: 'Rule Deleted',
      message: 'Alert rule has been deleted',
      color: 'red',
    });
  };

  const handleToggleRule = (ruleId: string, active: boolean) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, is_active: active } : r))
    );
    notifications.show({
      title: active ? 'Rule Enabled' : 'Rule Paused',
      message: `Alert rule has been ${active ? 'enabled' : 'paused'}`,
      color: active ? 'green' : 'yellow',
    });
  };

  const handleDuplicateRule = (rule: AlertRule) => {
    const newRule: AlertRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      name: `${rule.name} (Copy)`,
      created_at: new Date().toISOString(),
    };
    setRules((prev) => [...prev, newRule]);
    notifications.show({
      title: 'Rule Duplicated',
      message: 'A copy of the rule has been created',
      color: 'blue',
    });
  };

  const handleSubmitRule = (rule: AlertRule) => {
    if (editingRule?.id) {
      // Update existing rule
      setRules((prev) =>
        prev.map((r) =>
          r.id === editingRule.id
            ? { ...rule, id: editingRule.id, updated_at: new Date().toISOString() }
            : r
        )
      );
      notifications.show({
        title: 'Rule Updated',
        message: 'Alert rule has been updated',
        color: 'green',
      });
    } else {
      // Create new rule
      const newRule: AlertRule = {
        ...rule,
        id: `rule-${Date.now()}`,
        created_at: new Date().toISOString(),
      };
      setRules((prev) => [...prev, newRule]);
      notifications.show({
        title: 'Rule Created',
        message: 'New alert rule has been created',
        color: 'green',
      });
    }
    closeRuleModal();
    setEditingRule(null);
  };

  // Stats
  const unreadCount = alerts.filter((a) => a.status === 'unread').length;
  const activeRulesCount = rules.filter((r) => r.is_active).length;

  return (
    <Container size="xl" py="md">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Stack gap="lg">
          {/* Header */}
          <Group justify="space-between">
            <div>
              <Text size="xl" fw={700}>
                Alerts
              </Text>
              <Text size="sm" c="dimmed">
                Stay informed about changes in your target companies
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleCreateRule}
            >
              Create Rule
            </Button>
          </Group>

          {/* Tabs */}
          <Paper
            radius="lg"
            style={{
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(100, 116, 139, 0.2)',
              overflow: 'hidden',
            }}
          >
            <Tabs value={activeTab} onChange={setActiveTab}>
              <Tabs.List
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                }}
              >
                <Tabs.Tab
                  value="alerts"
                  leftSection={<IconBell size={16} />}
                >
                  Alerts
                  {unreadCount > 0 && (
                    <Badge size="xs" variant="filled" color="red" ml={6}>
                      {unreadCount}
                    </Badge>
                  )}
                </Tabs.Tab>
                <Tabs.Tab
                  value="rules"
                  leftSection={<IconSettings size={16} />}
                >
                  Rules
                  <Badge size="xs" variant="light" color="gray" ml={6}>
                    {activeRulesCount} active
                  </Badge>
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="alerts" p="lg">
                <AlertCenter
                  alerts={alerts.filter((a) => a.status !== 'dismissed')}
                  isLoading={isLoading}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onDismiss={handleDismiss}
                  onRefresh={handleRefreshAlerts}
                />
              </Tabs.Panel>

              <Tabs.Panel value="rules" p="lg">
                <Stack gap="md">
                  <Group justify="space-between">
                    <div>
                      <Text size="lg" fw={600}>
                        Alert Rules
                      </Text>
                      <Text size="sm" c="dimmed">
                        Configure when and how you receive alerts
                      </Text>
                    </div>
                  </Group>

                  {rules.length === 0 ? (
                    <Paper
                      p="xl"
                      radius="md"
                      ta="center"
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(100, 116, 139, 0.2)',
                      }}
                    >
                      <IconSettings
                        size={48}
                        style={{ opacity: 0.3, marginBottom: 16 }}
                      />
                      <Text size="lg" fw={500} mb="xs">
                        No Alert Rules
                      </Text>
                      <Text size="sm" c="dimmed" mb="md">
                        Create your first rule to start receiving alerts
                      </Text>
                      <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleCreateRule}
                      >
                        Create Rule
                      </Button>
                    </Paper>
                  ) : (
                    <Paper
                      radius="md"
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(100, 116, 139, 0.2)',
                      }}
                    >
                      <RulesTable
                        rules={rules}
                        onEdit={handleEditRule}
                        onDelete={handleDeleteRule}
                        onToggle={handleToggleRule}
                        onDuplicate={handleDuplicateRule}
                      />
                    </Paper>
                  )}
                </Stack>
              </Tabs.Panel>
            </Tabs>
          </Paper>
        </Stack>
      </motion.div>

      {/* Rule Form Modal */}
      <Modal
        opened={ruleModalOpened}
        onClose={() => {
          closeRuleModal();
          setEditingRule(null);
        }}
        title={editingRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
        size="lg"
        centered
        styles={{
          header: { display: 'none' },
          body: { padding: 0 },
        }}
      >
        <AlertRuleForm
          initialValues={editingRule || undefined}
          availableDomains={availableDomains}
          onSubmit={handleSubmitRule}
          onCancel={() => {
            closeRuleModal();
            setEditingRule(null);
          }}
        />
      </Modal>
    </Container>
  );
}

export default AlertsPage;
