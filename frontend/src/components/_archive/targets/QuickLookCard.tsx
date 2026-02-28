/**
 * QuickLookCard - Inline Summary Preview
 *
 * Shows key stats in an expandable row without opening the full drawer.
 * Two-tier detail system:
 * - Quick Look (this): Inline summary for fast scanning
 * - Detail Look: Full drawer for deep dive (triggered by "View Details")
 *
 * Features smooth slide-down animation when appearing.
 */

import { useRef, useEffect, useState } from 'react';
import { Group, Stack, Text, Badge, Button, SimpleGrid, Paper, Tooltip, Progress, Divider } from '@mantine/core';
import {
  IconExternalLink,
  IconChartBar,
  IconCurrencyDollar,
  IconBuildingSkyscraper,
  IconMapPin,
  IconUsers,
  IconTrendingUp,
  IconFlame,
  IconSnowflake,
  IconZoomIn,
  IconRefresh,
  IconChevronUp,
} from '@tabler/icons-react';
import type { Company } from '@/types';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import {
  AdobeLogo,
  AmplienceLogo,
  SprykerLogo,
  ShopifyLogo,
  ElasticsearchLogo,
  AllPartnersLogo,
} from '@/components/common/PartnerLogos';
import { COLORS, STATUS_MAP, type StatusKey } from '@/lib/constants';
import { ScoreBreakdown } from '@/components/company/ScoreBreakdown';
import { calculateCompositeScore, getStatusFromCompositeScore } from '@/services/scoring';

interface QuickLookCardProps {
  company: Company;
  onViewDetails: () => void;
  onClose: () => void;
  onEnrich?: (domain: string) => void | Promise<void>;
}

function formatNumber(num: number | undefined | null): string {
  if (!num) return '—';
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(0)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return num.toString();
}

function formatTraffic(visits: number | undefined): string {
  if (!visits) return '—';
  if (visits >= 1e6) return `${(visits / 1e6).toFixed(1)}M/mo`;
  if (visits >= 1e3) return `${(visits / 1e3).toFixed(0)}K/mo`;
  return `${visits}/mo`;
}

function getTechLogo(tech: string) {
  const t = tech.toLowerCase();
  if (t.includes('adobe') || t.includes('aem')) return AdobeLogo;
  if (t.includes('amplience')) return AmplienceLogo;
  if (t.includes('spryker')) return SprykerLogo;
  if (t.includes('shopify')) return ShopifyLogo;
  if (t.includes('elastic')) return ElasticsearchLogo;
  return AllPartnersLogo;
}

export function QuickLookCard({ company, onViewDetails, onClose, onEnrich }: QuickLookCardProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  // Calculate composite score
  const compositeScore = calculateCompositeScore(company);
  const derivedStatus = getStatusFromCompositeScore(compositeScore.total);

  // Measure content height and animate in
  useEffect(() => {
    if (contentRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      setHeight(contentHeight);
      // Small delay to trigger animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, []);

  // Use shared STATUS_MAP from constants with icon lookup
  const statusIcons = {
    hot: IconFlame,
    warm: IconTrendingUp,
    cold: IconSnowflake,
  };
  const statusDef = STATUS_MAP[derivedStatus as StatusKey] || STATUS_MAP.cold;
  const status = {
    color: statusDef.bgColor,
    bg: derivedStatus === 'hot' ? '#fef2f2' : derivedStatus === 'warm' ? '#fff7ed' : '#f8fafc',
    icon: statusIcons[derivedStatus as StatusKey] || IconSnowflake,
    label: statusDef.label,
  };
  const StatusIcon = status.icon;

  // Check if data is missing (needs enrichment)
  const needsEnrichment = !company.sw_monthly_visits && !company.revenue;

  return (
    <div
      style={{
        overflow: 'hidden',
        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-out',
        height: isVisible ? height : 0,
        opacity: isVisible ? 1 : 0,
      }}
    >
      <div ref={contentRef}>
        <Paper
          p="md"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            borderTop: `3px solid ${status.color}`,
            borderLeft: `1px solid ${COLORS.GRAY_200}`,
            borderRight: `1px solid ${COLORS.GRAY_200}`,
            borderBottom: `1px solid ${COLORS.GRAY_200}`,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          <Group justify="space-between" mb="md">
            {/* Company Identity */}
            <Group gap="md">
              <CompanyLogo domain={company.domain} companyName={company.company_name} size="md" radius="md" />
              <div>
                <Group gap="xs">
                  <Text size="lg" fw={700} c={COLORS.GRAY_900}>
                    {company.company_name || company.domain}
                  </Text>
                  <Badge size="sm" color={status.color.replace('#', '')} variant="light" leftSection={<StatusIcon size={12} />}>
                    {status.label}
                  </Badge>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c={COLORS.GRAY_500}>{company.domain}</Text>
                  {company.vertical && (
                    <>
                      <Text size="sm" c={COLORS.GRAY_400}>•</Text>
                      <Text size="sm" c={COLORS.GRAY_500}>{company.vertical}</Text>
                    </>
                  )}
                </Group>
              </div>
            </Group>

            {/* Close button */}
            <Tooltip label="Collapse preview">
              <Button
                variant="subtle"
                size="sm"
                color="gray"
                onClick={onClose}
                style={{ padding: 8 }}
              >
                <IconChevronUp size={18} />
              </Button>
            </Tooltip>
          </Group>

          {/* Composite Score Breakdown (replaces simple ICP score) */}
          <ScoreBreakdown company={company} variant="compact" />

          {/* Key Stats Grid */}
          <SimpleGrid cols={4} spacing="md" mt="md" mb="md">
            <Paper p="sm" withBorder style={{ borderColor: COLORS.GRAY_200 }}>
              <Group gap="xs" mb={4}>
                <IconChartBar size={14} color={COLORS.GRAY_500} />
                <Text size="xs" c={COLORS.GRAY_500} fw={600}>Traffic</Text>
              </Group>
              <Text size="md" fw={700} c={COLORS.GRAY_900}>
                {formatTraffic(company.sw_monthly_visits)}
              </Text>
            </Paper>

            <Paper p="sm" withBorder style={{ borderColor: COLORS.GRAY_200 }}>
              <Group gap="xs" mb={4}>
                <IconCurrencyDollar size={14} color={COLORS.GRAY_500} />
                <Text size="xs" c={COLORS.GRAY_500} fw={600}>Revenue</Text>
              </Group>
              <Text size="md" fw={700} c={COLORS.GRAY_900}>
                {formatNumber(company.revenue)}
              </Text>
            </Paper>

            <Paper p="sm" withBorder style={{ borderColor: COLORS.GRAY_200 }}>
              <Group gap="xs" mb={4}>
                <IconMapPin size={14} color={COLORS.GRAY_500} />
                <Text size="xs" c={COLORS.GRAY_500} fw={600}>Location</Text>
              </Group>
              <Text size="md" fw={700} c={COLORS.GRAY_900} lineClamp={1}>
                {company.headquarters?.country || company.headquarters?.city || '—'}
              </Text>
            </Paper>

            <Paper p="sm" withBorder style={{ borderColor: COLORS.GRAY_200 }}>
              <Group gap="xs" mb={4}>
                <IconBuildingSkyscraper size={14} color={COLORS.GRAY_500} />
                <Text size="xs" c={COLORS.GRAY_500} fw={600}>Type</Text>
              </Group>
              <Text size="md" fw={700} c={COLORS.GRAY_900}>
                {company.is_public ? 'Public' : 'Private'}
                {company.ticker && ` (${company.ticker})`}
              </Text>
            </Paper>
          </SimpleGrid>

          {/* Tech Stack */}
          <Paper p="sm" withBorder style={{ borderColor: COLORS.GRAY_200 }} mb="md">
            <Text size="xs" c={COLORS.GRAY_500} fw={600} mb="xs">Partner Technologies</Text>
            <Group gap="sm">
              {company.partner_tech?.length ? (
                company.partner_tech.map((tech) => {
                  const Logo = getTechLogo(tech);
                  return (
                    <Tooltip key={tech} label={tech} withArrow>
                      <Badge
                        size="lg"
                        variant="light"
                        color="blue"
                        leftSection={<Logo size={16} />}
                        styles={{ root: { fontWeight: 600, padding: '8px 12px' } }}
                      >
                        {tech.split(' ')[0]}
                      </Badge>
                    </Tooltip>
                  );
                })
              ) : (
                <Text size="sm" c={COLORS.GRAY_400}>No partner tech detected</Text>
              )}
              {company.current_search && (
                <Badge size="lg" variant="light" color="red" styles={{ root: { fontWeight: 600 } }}>
                  Search: {company.current_search}
                </Badge>
              )}
            </Group>
          </Paper>

          {/* Actions */}
          <Group justify="space-between">
            <Group gap="xs">
              <Button
                variant="light"
                size="sm"
                leftSection={<IconExternalLink size={14} />}
                component="a"
                href={`https://${company.domain}`}
                target="_blank"
              >
                Visit Site
              </Button>
              {onEnrich && (
                <Tooltip label={needsEnrichment ? "Fetch traffic, revenue, and competitor data" : "Refresh enrichment data"}>
                  <Button
                    variant={needsEnrichment ? "filled" : "light"}
                    color={needsEnrichment ? "blue" : "gray"}
                    size="sm"
                    leftSection={<IconRefresh size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEnrich(company.domain);
                    }}
                  >
                    {needsEnrichment ? 'Enrich Now' : 'Refresh'}
                  </Button>
                </Tooltip>
              )}
            </Group>

            <Button
              variant="gradient"
              gradient={{ from: COLORS.ALGOLIA_NEBULA_BLUE, to: COLORS.ALGOLIA_PURPLE }}
              size="sm"
              leftSection={<IconZoomIn size={16} />}
              onClick={onViewDetails}
            >
              Deep Dive
            </Button>
          </Group>
        </Paper>
      </div>
    </div>
  );
}

export default QuickLookCard;
