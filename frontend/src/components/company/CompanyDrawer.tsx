/**
 * CompanyDrawer - Slide-over Panel
 *
 * Full company detail view in a drawer from the right.
 * Shows all intelligence data, partner tech, scores, etc.
 */

import {
  Drawer,
  Group,
  Stack,
  Text,
  Badge,
  Progress,
  Divider,
  Avatar,
  Button,
  Tabs,
  Paper,
  Anchor,
  ThemeIcon,
  SimpleGrid,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
  IconWorld,
  IconBuilding,
  IconExternalLink,
  IconRefresh,
  IconChartBar,
  IconUsers,
  IconCode,
  IconCurrencyDollar,
  IconMapPin,
  IconCalendar,
  IconPin,
  IconPinnedOff,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { Company } from '@/types';
import { CompanyLogo } from '@/components/ui/CompanyLogo';

const ALGOLIA_BLUE = '#003DFF';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';
const GRAY_900 = '#0f172a';

const STATUS_CONFIG = {
  hot: { color: 'red', icon: IconFlame, label: 'Hot Lead', bg: '#fef2f2' },
  warm: { color: 'orange', icon: IconTrendingUp, label: 'Warm Lead', bg: '#fff7ed' },
  cold: { color: 'gray', icon: IconSnowflake, label: 'Cold Lead', bg: '#f8fafc' },
};

interface CompanyDrawerProps {
  company: Company | null;
  opened: boolean;
  onClose: () => void;
  onEnrich?: (domain: string) => void;
}

export function CompanyDrawer({ company, opened, onClose, onEnrich }: CompanyDrawerProps) {
  const [isPinned, setIsPinned] = useState(false);

  if (!company) return null;

  const status = STATUS_CONFIG[company.status] || STATUS_CONFIG.cold;
  const StatusIcon = status.icon;

  const formatTraffic = (visits?: number) => {
    if (!visits) return 'N/A';
    if (visits >= 1000000) return `${(visits / 1000000).toFixed(1)}M`;
    if (visits >= 1000) return `${(visits / 1000).toFixed(0)}K`;
    return visits.toString();
  };

  const formatRevenue = (revenue?: number) => {
    if (!revenue) return 'N/A';
    if (revenue >= 1000000000) return `$${(revenue / 1000000000).toFixed(1)}B`;
    if (revenue >= 1000000) return `$${(revenue / 1000000).toFixed(0)}M`;
    return `$${revenue.toLocaleString()}`;
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="lg"
      title={null}
      padding={0}
      closeOnClickOutside={!isPinned}
      withOverlay={!isPinned}
      lockScroll={!isPinned}
      trapFocus={!isPinned}
      styles={{
        content: {
          background: GRAY_50,
          boxShadow: isPinned ? '-4px 0 20px rgba(0,0,0,0.15)' : undefined,
        },
        header: { display: 'none' },
        body: { padding: 0, height: '100%' },
      }}
    >
      {/* Pinned indicator banner */}
      {isPinned && (
        <div
          style={{
            background: ALGOLIA_BLUE,
            color: 'white',
            padding: '6px 20px',
            fontSize: 12,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <IconPin size={14} />
          <span>Pinned — Click anywhere on the page to continue researching</span>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: 'white',
          borderBottom: `1px solid ${GRAY_200}`,
          padding: 20,
          position: 'sticky',
          top: isPinned ? 0 : 0,
          zIndex: 10,
        }}
      >
        <Group justify="space-between" mb="md">
          <Group gap="md">
            <CompanyLogo
              domain={company.domain}
              companyName={company.company_name}
              size={56}
              radius="md"
            />
            <div>
              <Text size="lg" fw={600} c={GRAY_900}>
                {company.company_name}
              </Text>
              <Group gap="xs">
                <Anchor
                  href={`https://${company.domain}`}
                  target="_blank"
                  size="sm"
                  c={ALGOLIA_BLUE}
                >
                  {company.domain}
                </Anchor>
                <IconExternalLink size={14} color={ALGOLIA_BLUE} />
              </Group>
            </div>
          </Group>
          <Group gap="xs">
            <Badge
              size="lg"
              color={status.color}
              variant="light"
              leftSection={<StatusIcon size={14} />}
            >
              {status.label}
            </Badge>
            <Tooltip label={isPinned ? 'Unpin drawer' : 'Pin drawer for side-by-side view'}>
              <ActionIcon
                variant={isPinned ? 'filled' : 'light'}
                color="blue"
                size="lg"
                onClick={() => setIsPinned(!isPinned)}
              >
                {isPinned ? <IconPinnedOff size={18} /> : <IconPin size={18} />}
              </ActionIcon>
            </Tooltip>
            <ActionIcon variant="light" color="gray" size="lg" onClick={onClose}>
              ✕
            </ActionIcon>
          </Group>
        </Group>

        {/* Score Bar */}
        <Paper p="md" radius="md" style={{ background: status.bg }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600} c={GRAY_900}>ICP Score</Text>
            <Text size="xl" fw={700} c={company.icp_score >= 80 ? '#dc2626' : company.icp_score >= 40 ? '#ea580c' : GRAY_700}>
              {company.icp_score}/100
            </Text>
          </Group>
          <Progress
            value={company.icp_score}
            size="lg"
            radius="xl"
            color={company.icp_score >= 80 ? 'red' : company.icp_score >= 40 ? 'orange' : 'gray'}
          />
        </Paper>
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        <Tabs defaultValue="overview" variant="outline">
          <Tabs.List mb="md">
            <Tabs.Tab value="overview" leftSection={<IconBuilding size={14} />}>
              Overview
            </Tabs.Tab>
            <Tabs.Tab value="tech" leftSection={<IconCode size={14} />}>
              Tech Stack
            </Tabs.Tab>
            <Tabs.Tab value="signals" leftSection={<IconChartBar size={14} />}>
              Signals
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview">
            <Stack gap="md">
              {/* Quick Stats */}
              <SimpleGrid cols={2} spacing="md">
                <StatCard
                  icon={IconWorld}
                  label="Monthly Traffic"
                  value={`${formatTraffic(company.sw_monthly_visits)}`}
                  source="SimilarWeb"
                  sourceUrl={`https://similarweb.com/website/${company.domain}`}
                />
                <StatCard
                  icon={IconCurrencyDollar}
                  label="Revenue"
                  value={formatRevenue(company.revenue)}
                  source="Estimated"
                />
                <StatCard
                  icon={IconUsers}
                  label="Employees"
                  value={company.employee_count?.toLocaleString() || 'N/A'}
                />
                <StatCard
                  icon={IconCalendar}
                  label="Founded"
                  value={company.founded_year?.toString() || 'N/A'}
                />
              </SimpleGrid>

              {/* Location */}
              {company.headquarters && (
                <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
                  <Group gap="sm">
                    <ThemeIcon size="lg" variant="light" color="blue">
                      <IconMapPin size={18} />
                    </ThemeIcon>
                    <div>
                      <Text size="xs" c={GRAY_700} fw={500}>Headquarters</Text>
                      <Text size="sm" fw={500} c={GRAY_900}>
                        {[company.headquarters.city, company.headquarters.state, company.headquarters.country]
                          .filter(Boolean)
                          .join(', ')}
                      </Text>
                    </div>
                  </Group>
                </Paper>
              )}

              {/* Industry */}
              <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
                <Text size="xs" c={GRAY_700} fw={500} mb="xs">Industry & Vertical</Text>
                <Group gap="xs">
                  <Badge variant="light" color="blue">{company.industry || 'Unknown'}</Badge>
                  <Badge variant="light" color="violet">{company.vertical || 'Unknown'}</Badge>
                  {company.sub_vertical && (
                    <Badge variant="light" color="grape">{company.sub_vertical}</Badge>
                  )}
                </Group>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="tech">
            <Stack gap="md">
              {/* Partner Technologies */}
              <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
                <Text size="sm" fw={600} mb="sm" c={GRAY_900}>Partner Technologies</Text>
                {company.partner_tech && company.partner_tech.length > 0 ? (
                  <Group gap="xs">
                    {company.partner_tech.map((tech) => (
                      <Badge key={tech} size="lg" variant="light" color="green">
                        {tech}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text size="sm" c={GRAY_700}>No partner technologies detected</Text>
                )}
                <Divider my="sm" />
                <Anchor
                  href={`https://builtwith.com/${company.domain}`}
                  target="_blank"
                  size="xs"
                  c={ALGOLIA_BLUE}
                >
                  View full tech stack on BuiltWith →
                </Anchor>
              </Paper>

              {/* Current Search */}
              {company.current_search && (
                <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
                  <Text size="sm" fw={600} mb="xs" c={GRAY_900}>Current Search Provider</Text>
                  <Badge size="lg" variant="filled" color="red">
                    {company.current_search}
                  </Badge>
                  <Text size="xs" c={GRAY_700} mt="xs">
                    Displacement opportunity for Algolia
                  </Text>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="signals">
            <Stack gap="md">
              {/* Scores Breakdown */}
              <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
                <Text size="sm" fw={600} mb="md" c={GRAY_900}>Score Breakdown</Text>
                <Stack gap="sm">
                  <ScoreRow label="ICP Score" value={company.icp_score} max={100} />
                  <ScoreRow label="Signal Score" value={company.signal_score} max={100} />
                  <ScoreRow label="Priority Score" value={company.priority_score} max={100} />
                </Stack>
              </Paper>

              {/* Enrichment Status */}
              <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={600} c={GRAY_900}>Enrichment Status</Text>
                  <Badge
                    variant="light"
                    color={company.enrichment_level === 'full' ? 'green' : 'yellow'}
                  >
                    {company.enrichment_level || 'Basic'}
                  </Badge>
                </Group>
                {company.last_enriched && (
                  <Text size="xs" c={GRAY_700}>
                    Last enriched: {new Date(company.last_enriched).toLocaleDateString()}
                  </Text>
                )}
                <Button
                  variant="light"
                  color="blue"
                  size="xs"
                  mt="sm"
                  leftSection={<IconRefresh size={14} />}
                  onClick={() => onEnrich?.(company.domain)}
                >
                  Refresh Data
                </Button>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Footer Actions */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'white',
          borderTop: `1px solid ${GRAY_200}`,
          padding: 16,
        }}
      >
        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={onClose}>
            Close
          </Button>
          <Group gap="xs">
            <Button
              variant="light"
              color="blue"
              leftSection={<IconExternalLink size={14} />}
              component="a"
              href={`https://${company.domain}`}
              target="_blank"
            >
              Visit Website
            </Button>
            <Button
              variant="filled"
              color="blue"
              onClick={() => {
                // Future: Open in full page view or add to campaign
              }}
            >
              Add to Campaign
            </Button>
          </Group>
        </Group>
      </div>
    </Drawer>
  );
}

// Helper components
function StatCard({
  icon: Icon,
  label,
  value,
  source,
  sourceUrl,
}: {
  icon: typeof IconWorld;
  label: string;
  value: string;
  source?: string;
  sourceUrl?: string;
}) {
  return (
    <Paper p="md" radius="md" withBorder style={{ background: 'white' }}>
      <Group gap="sm">
        <ThemeIcon size="lg" variant="light" color="blue">
          <Icon size={18} />
        </ThemeIcon>
        <div style={{ flex: 1 }}>
          <Text size="xs" c={GRAY_700} fw={500}>{label}</Text>
          <Text size="lg" fw={600} c={GRAY_900}>{value}</Text>
          {source && (
            sourceUrl ? (
              <Anchor href={sourceUrl} target="_blank" size="xs" c={ALGOLIA_BLUE}>
                {source} →
              </Anchor>
            ) : (
              <Text size="xs" c={GRAY_500}>{source}</Text>
            )
          )}
        </div>
      </Group>
    </Paper>
  );
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = (value / max) * 100;
  const color = percentage >= 80 ? 'red' : percentage >= 40 ? 'orange' : 'gray';

  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Text size="sm" c={GRAY_900}>{label}</Text>
        <Text size="sm" fw={600} c={GRAY_900}>{value}/{max}</Text>
      </Group>
      <Progress value={percentage} size="sm" radius="xl" color={color} />
    </div>
  );
}
