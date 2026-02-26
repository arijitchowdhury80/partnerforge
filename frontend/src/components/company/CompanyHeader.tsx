/**
 * CompanyHeader Component
 *
 * Header section for company detail view with logo placeholder,
 * company info, ICP score badge, and quick actions.
 */

import {
  Group,
  Stack,
  Text,
  Badge,
  Button,
  Avatar,
  ActionIcon,
  Tooltip,
  Paper,
  Skeleton,
  Menu,
  CopyButton,
} from '@mantine/core';
import {
  IconRefresh,
  IconDownload,
  IconBookmark,
  IconExternalLink,
  IconDotsVertical,
  IconCheck,
  IconCopy,
  IconShare,
  IconTrash,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';
import type { Company } from '@/types';

interface CompanyHeaderProps {
  company?: Company;
  isLoading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  onAddToList?: () => void;
  isRefreshing?: boolean;
}

// ICP Score color coding
function getScoreColor(score: number): string {
  if (score >= 80) return 'red';
  if (score >= 60) return 'orange';
  if (score >= 40) return 'yellow';
  return 'gray';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'HOT';
  if (score >= 60) return 'WARM';
  if (score >= 40) return 'COOL';
  return 'COLD';
}

// Format last enriched timestamp
function formatLastEnriched(timestamp?: string): string {
  if (!timestamp) return 'Never enriched';

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function CompanyHeader({
  company,
  isLoading = false,
  onRefresh,
  onExport,
  onAddToList,
  isRefreshing = false,
}: CompanyHeaderProps) {
  // Placeholder logo - first letter of company name or domain
  const logoLetter = company?.company_name?.[0]?.toUpperCase() ||
    company?.domain?.[0]?.toUpperCase() || '?';

  if (isLoading) {
    return (
      <Paper
        p="lg"
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <Group justify="space-between" align="flex-start">
          <Group gap="lg">
            <Skeleton circle height={72} />
            <Stack gap="xs">
              <Skeleton height={28} width={250} />
              <Skeleton height={16} width={180} />
              <Skeleton height={20} width={120} />
            </Stack>
          </Group>
          <Group gap="xs">
            <Skeleton height={36} width={100} />
            <Skeleton height={36} width={100} />
          </Group>
        </Group>
      </Paper>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Paper
        p="lg"
        radius="lg"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(100, 116, 139, 0.2)',
        }}
      >
        <Group justify="space-between" align="flex-start">
          {/* Company Info */}
          <Group gap="lg">
            {/* Logo Placeholder */}
            <Avatar
              size={72}
              radius="lg"
              color="blue"
              style={{
                background: 'linear-gradient(135deg, #5468FF, #003DFF)',
                fontSize: '1.75rem',
                fontWeight: 600,
              }}
            >
              {logoLetter}
            </Avatar>

            <Stack gap={4}>
              {/* Company Name & Ticker */}
              <Group gap="sm" align="center">
                <Text size="xl" fw={700} c="white">
                  {company?.company_name || company?.domain || 'Unknown Company'}
                </Text>
                {company?.ticker && (
                  <Badge
                    variant="light"
                    color="blue"
                    size="lg"
                    style={{ textTransform: 'none' }}
                  >
                    {company.exchange}:{company.ticker}
                  </Badge>
                )}
              </Group>

              {/* Domain & Industry */}
              <Group gap="md">
                <CopyButton value={company?.domain || ''}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied!' : 'Copy domain'}>
                      <Group
                        gap={4}
                        style={{ cursor: 'pointer' }}
                        onClick={copy}
                      >
                        <Text size="sm" c="dimmed">
                          {company?.domain}
                        </Text>
                        {copied ? (
                          <IconCheck size={14} color="var(--mantine-color-green-5)" />
                        ) : (
                          <IconCopy size={14} style={{ opacity: 0.5 }} />
                        )}
                      </Group>
                    </Tooltip>
                  )}
                </CopyButton>
                <Text size="sm" c="dimmed">|</Text>
                <Text size="sm" c="dimmed">
                  {company?.industry || 'Unknown Industry'}
                </Text>
                {company?.vertical && (
                  <>
                    <Text size="sm" c="dimmed">|</Text>
                    <Badge variant="outline" color="gray" size="sm">
                      {company.vertical}
                    </Badge>
                  </>
                )}
              </Group>

              {/* Location & Stats */}
              <Group gap="md" mt={4}>
                {company?.headquarters && (
                  <Text size="xs" c="dimmed">
                    {[
                      company.headquarters.city,
                      company.headquarters.state,
                      company.headquarters.country,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
                {company?.employee_count && (
                  <>
                    <Text size="xs" c="dimmed">|</Text>
                    <Text size="xs" c="dimmed">
                      {company.employee_count.toLocaleString()} employees
                    </Text>
                  </>
                )}
                {company?.store_count && (
                  <>
                    <Text size="xs" c="dimmed">|</Text>
                    <Text size="xs" c="dimmed">
                      {company.store_count.toLocaleString()} stores
                    </Text>
                  </>
                )}
              </Group>
            </Stack>
          </Group>

          {/* ICP Score & Actions */}
          <Stack align="flex-end" gap="md">
            {/* ICP Score Badge */}
            <Group gap="sm">
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Tooltip
                  label={`ICP Score: ${company?.icp_score || 0} / 100`}
                  position="left"
                >
                  <Paper
                    p="md"
                    radius="lg"
                    style={{
                      background: `linear-gradient(135deg, var(--mantine-color-${getScoreColor(
                        company?.icp_score || 0
                      )}-9), var(--mantine-color-${getScoreColor(
                        company?.icp_score || 0
                      )}-8))`,
                      border: `2px solid var(--mantine-color-${getScoreColor(
                        company?.icp_score || 0
                      )}-6)`,
                      minWidth: 90,
                      textAlign: 'center',
                    }}
                  >
                    <Text size="2rem" fw={700} c="white" lh={1}>
                      {company?.icp_score || 0}
                    </Text>
                    <Text size="xs" fw={600} c="white" opacity={0.9}>
                      {getScoreLabel(company?.icp_score || 0)}
                    </Text>
                  </Paper>
                </Tooltip>
              </motion.div>
            </Group>

            {/* Action Buttons */}
            <Group gap="xs">
              <Tooltip label="Refresh Intelligence">
                <Button
                  variant="light"
                  color="blue"
                  leftSection={<IconRefresh size={16} />}
                  onClick={onRefresh}
                  loading={isRefreshing}
                  size="sm"
                >
                  Refresh
                </Button>
              </Tooltip>

              <Tooltip label="Export Company Data">
                <Button
                  variant="light"
                  color="gray"
                  leftSection={<IconDownload size={16} />}
                  onClick={onExport}
                  size="sm"
                >
                  Export
                </Button>
              </Tooltip>

              <Tooltip label="Add to List">
                <ActionIcon
                  variant="light"
                  color="gray"
                  size="lg"
                  onClick={onAddToList}
                >
                  <IconBookmark size={18} />
                </ActionIcon>
              </Tooltip>

              <Tooltip label="Visit Website">
                <ActionIcon
                  variant="light"
                  color="gray"
                  size="lg"
                  component="a"
                  href={`https://${company?.domain}`}
                  target="_blank"
                >
                  <IconExternalLink size={18} />
                </ActionIcon>
              </Tooltip>

              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" size="lg">
                    <IconDotsVertical size={18} />
                  </ActionIcon>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>Actions</Menu.Label>
                  <Menu.Item leftSection={<IconShare size={14} />}>
                    Share Company
                  </Menu.Item>
                  <Menu.Item leftSection={<IconCopy size={14} />}>
                    Copy Link
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTrash size={14} />}
                    color="red"
                  >
                    Remove from List
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>

            {/* Last Enriched */}
            <Text size="xs" c="dimmed">
              Last enriched: {formatLastEnriched(company?.last_enriched)}
            </Text>
          </Stack>
        </Group>

        {/* Partner Technologies */}
        {company?.partner_tech && company.partner_tech.length > 0 && (
          <Group gap="xs" mt="md" pt="md" style={{ borderTop: '1px solid rgba(100, 116, 139, 0.2)' }}>
            <Text size="xs" c="dimmed" fw={500}>
              Partner Tech:
            </Text>
            {company.partner_tech.map((tech) => (
              <Badge key={tech} variant="dot" color="blue" size="sm">
                {tech}
              </Badge>
            ))}
          </Group>
        )}
      </Paper>
    </motion.div>
  );
}
