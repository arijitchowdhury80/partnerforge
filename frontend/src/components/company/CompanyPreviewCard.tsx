/**
 * CompanyPreviewCard - Hover Preview
 *
 * Shows quick company info on hover. Appears near cursor.
 */

import { Paper, Group, Stack, Text, Badge, Progress, Divider, Avatar } from '@mantine/core';
import { IconFlame, IconTrendingUp, IconSnowflake, IconWorld, IconBuilding } from '@tabler/icons-react';
import type { Company } from '@/types';

const ALGOLIA_BLUE = '#003DFF';
const GRAY_500 = '#64748b';
const GRAY_700 = '#334155';

const STATUS_CONFIG = {
  hot: { color: 'red', icon: IconFlame, label: 'Hot Lead' },
  warm: { color: 'orange', icon: IconTrendingUp, label: 'Warm Lead' },
  cold: { color: 'gray', icon: IconSnowflake, label: 'Cold Lead' },
};

interface CompanyPreviewCardProps {
  company: Company;
}

export function CompanyPreviewCard({ company }: CompanyPreviewCardProps) {
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
    <Paper
      shadow="xl"
      p="md"
      radius="md"
      style={{
        width: 320,
        background: 'white',
        border: '1px solid #e2e8f0',
      }}
    >
      {/* Header */}
      <Group gap="sm" mb="sm">
        <Avatar
          src={`https://logo.clearbit.com/${company.domain}`}
          size={40}
          radius="md"
        >
          {company.company_name?.charAt(0) || '?'}
        </Avatar>
        <div style={{ flex: 1 }}>
          <Text size="sm" fw={600} c={GRAY_700} lineClamp={1}>
            {company.company_name}
          </Text>
          <Text size="xs" c={GRAY_500}>
            {company.domain}
          </Text>
        </div>
        <Badge size="sm" color={status.color} variant="light" leftSection={<StatusIcon size={12} />}>
          {status.label}
        </Badge>
      </Group>

      <Divider my="xs" />

      {/* Score */}
      <Stack gap={4} mb="sm">
        <Group justify="space-between">
          <Text size="xs" c={GRAY_500}>ICP Score</Text>
          <Text size="sm" fw={600} c={company.icp_score >= 80 ? '#dc2626' : company.icp_score >= 40 ? '#ea580c' : GRAY_500}>
            {company.icp_score}/100
          </Text>
        </Group>
        <Progress
          value={company.icp_score}
          size="sm"
          radius="xl"
          color={company.icp_score >= 80 ? 'red' : company.icp_score >= 40 ? 'orange' : 'gray'}
        />
      </Stack>

      {/* Quick Stats */}
      <Group gap="lg" mb="sm">
        <div>
          <Text size="xs" c={GRAY_500}>Traffic</Text>
          <Text size="sm" fw={500}>{formatTraffic(company.sw_monthly_visits)}/mo</Text>
        </div>
        <div>
          <Text size="xs" c={GRAY_500}>Revenue</Text>
          <Text size="sm" fw={500}>{formatRevenue(company.revenue)}</Text>
        </div>
        <div>
          <Text size="xs" c={GRAY_500}>Vertical</Text>
          <Text size="sm" fw={500} lineClamp={1}>{company.vertical || 'Unknown'}</Text>
        </div>
      </Group>

      {/* Partner Tech */}
      {company.partner_tech && company.partner_tech.length > 0 && (
        <>
          <Text size="xs" c={GRAY_500} mb={4}>Partner Technologies</Text>
          <Group gap={4}>
            {company.partner_tech.slice(0, 3).map((tech) => (
              <Badge key={tech} size="xs" variant="light" color="blue">
                {tech}
              </Badge>
            ))}
            {company.partner_tech.length > 3 && (
              <Badge size="xs" variant="light" color="gray">
                +{company.partner_tech.length - 3}
              </Badge>
            )}
          </Group>
        </>
      )}

      {/* Footer hint */}
      <Divider my="xs" />
      <Text size="xs" c={GRAY_500} ta="center">
        Click to open full details →
      </Text>
    </Paper>
  );
}
