/**
 * CompanyDrawer - Intelligence Research Panel
 *
 * Deep-dive company view with expandable accordion sections.
 * When pinned, allows side-by-side research with the main list.
 *
 * Sections:
 * - Header: Company info, ICP score, pin/close
 * - Traffic: Demographics, sources, countries, devices
 * - Financials: 3-year revenue, margins, ROI projections
 * - Tech Stack: All technologies categorized
 * - Signals: Hiring, exec quotes, investor intel
 * - Strategic: Competitors, case studies, displacement
 */

import {
  Drawer,
  Group,
  Stack,
  Text,
  Badge,
  Progress,
  Paper,
  Anchor,
  ThemeIcon,
  SimpleGrid,
  ActionIcon,
  Tooltip,
  Button,
  Accordion,
  ScrollArea,
  Divider,
} from '@mantine/core';
import {
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
  IconExternalLink,
  IconRefresh,
  IconPin,
  IconPinnedOff,
  IconMapPin,
  IconUsers,
  IconCalendar,
  IconBuilding,
  IconBuildingSkyscraper,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { Company, TrafficData, FinancialData, TechStackData, HiringData, ExecutiveData, InvestorData, CompetitorData, CaseStudyMatch } from '@/types';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import {
  TrafficAccordion,
  FinancialsAccordion,
  TechStackAccordion,
  SignalsAccordion,
  StrategicAccordion,
} from './IntelligenceAccordions';
import { COLORS } from '@/lib/constants';

// =============================================================================
// Status Config - uses shared COLORS
// =============================================================================

const STATUS_CONFIG = {
  hot: { color: 'red', icon: IconFlame, label: 'Hot Lead', bg: '#fef2f2' },
  warm: { color: 'orange', icon: IconTrendingUp, label: 'Warm Lead', bg: '#fff7ed' },
  cold: { color: 'gray', icon: IconSnowflake, label: 'Cold Lead', bg: COLORS.GRAY_50 },
};

// =============================================================================
// Extended Company with Intelligence Data
// =============================================================================

interface CompanyWithIntelligence extends Company {
  // Deep enrichment data (populated when fully enriched)
  traffic_data?: TrafficData;
  financial_data?: FinancialData;
  tech_stack_data?: TechStackData;
  hiring_data?: HiringData;
  executive_data?: ExecutiveData;
  investor_data?: InvestorData;
  competitor_data?: CompetitorData;
  case_studies?: CaseStudyMatch[];
  // Fallback fields from basic enrichment
  exec_quote?: string;
  exec_name?: string;
  exec_title?: string;
  displacement_angle?: string;
}

// =============================================================================
// Props
// =============================================================================

interface CompanyDrawerProps {
  company: CompanyWithIntelligence | null;
  opened: boolean;
  onClose: () => void;
  onEnrich?: (domain: string) => void;
}

// =============================================================================
// Main Component
// =============================================================================

export function CompanyDrawer({ company, opened, onClose, onEnrich }: CompanyDrawerProps) {
  const [isPinned, setIsPinned] = useState(false);
  // Default to first accordion open, more open when pinned
  const [openAccordions, setOpenAccordions] = useState<string[]>(['traffic']);

  if (!company) return null;

  const status = STATUS_CONFIG[company.status] || STATUS_CONFIG.cold;
  const StatusIcon = status.icon;

  const handlePinToggle = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    // When pinned, open multiple sections for research
    if (newPinned) {
      setOpenAccordions(['traffic', 'financials', 'techstack']);
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size="xl"
      title={null}
      padding={0}
      closeOnClickOutside={!isPinned}
      withOverlay={!isPinned}
      lockScroll={!isPinned}
      trapFocus={!isPinned}
      styles={{
        content: {
          background: COLORS.GRAY_50,
          boxShadow: isPinned ? '-8px 0 30px rgba(0,0,0,0.2)' : undefined,
        },
        header: { display: 'none' },
        body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Pinned Mode Banner */}
      {isPinned && (
        <div
          style={{
            background: `linear-gradient(135deg, ${COLORS.ALGOLIA_NEBULA_BLUE} 0%, #5468ff 100%)`,
            color: 'white',
            padding: '10px 20px',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Group gap="xs">
            <IconPin size={16} />
            <span>Research Mode — Expand sections below for deep insights</span>
          </Group>
          <Badge variant="white" color="blue" size="sm">
            {company.enrichment_level === 'full' ? 'Fully Enriched' : 'Basic Data'}
          </Badge>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          background: 'white',
          borderBottom: `1px solid ${COLORS.GRAY_200}`,
          padding: 20,
          flexShrink: 0,
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
              <Text size="lg" fw={600} c={COLORS.GRAY_900}>
                {company.company_name}
              </Text>
              <Group gap="xs">
                <Anchor
                  href={`https://${company.domain}`}
                  target="_blank"
                  size="sm"
                  c={COLORS.ALGOLIA_NEBULA_BLUE}
                >
                  {company.domain}
                </Anchor>
                <IconExternalLink size={14} color={COLORS.ALGOLIA_NEBULA_BLUE} />
                {company.ticker && (
                  <Badge variant="light" color="violet" size="sm">{company.ticker}</Badge>
                )}
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
            <Tooltip label={isPinned ? 'Unpin drawer' : 'Pin for deep research'}>
              <ActionIcon
                variant={isPinned ? 'filled' : 'light'}
                color="blue"
                size="lg"
                onClick={handlePinToggle}
              >
                {isPinned ? <IconPinnedOff size={18} /> : <IconPin size={18} />}
              </ActionIcon>
            </Tooltip>
            <ActionIcon variant="light" color="gray" size="lg" onClick={onClose}>
              ✕
            </ActionIcon>
          </Group>
        </Group>

        {/* ICP Score */}
        <Paper p="md" radius="md" style={{ background: status.bg }}>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={600} c={COLORS.GRAY_900}>ICP Score</Text>
            <Text size="xl" fw={700} c={company.icp_score >= 80 ? '#dc2626' : company.icp_score >= 40 ? '#ea580c' : COLORS.GRAY_700}>
              {company.icp_score}/100
            </Text>
          </Group>
          <Progress
            value={company.icp_score}
            size="lg"
            radius="xl"
            color={company.icp_score >= 80 ? 'red' : company.icp_score >= 40 ? 'orange' : 'gray'}
          />
          <Group mt="sm" gap="lg">
            <Group gap={4}>
              <Text size="xs" c={COLORS.GRAY_500}>Signal:</Text>
              <Text size="xs" fw={600} c={COLORS.GRAY_900}>{company.signal_score || 0}</Text>
            </Group>
            <Group gap={4}>
              <Text size="xs" c={COLORS.GRAY_500}>Priority:</Text>
              <Text size="xs" fw={600} c={COLORS.GRAY_900}>{company.priority_score || 0}</Text>
            </Group>
          </Group>
        </Paper>

        {/* Quick Info Row */}
        <SimpleGrid cols={4} mt="md" spacing="xs">
          <QuickStat icon={IconBuilding} label="Industry" value={company.industry || 'Unknown'} />
          <QuickStat icon={IconMapPin} label="HQ" value={company.headquarters?.country || 'Unknown'} />
          <QuickStat icon={IconUsers} label="Employees" value={formatNumber(company.employee_count)} />
          <QuickStat icon={IconCalendar} label="Founded" value={company.founded_year?.toString() || 'N/A'} />
        </SimpleGrid>
      </div>

      {/* Scrollable Accordion Content */}
      <ScrollArea style={{ flex: 1 }} p="md">
        <Accordion
          multiple
          value={openAccordions}
          onChange={setOpenAccordions}
          variant="separated"
          radius="md"
          styles={{
            item: {
              backgroundColor: 'white',
              border: `1px solid ${COLORS.GRAY_200}`,
              '&[data-active]': {
                backgroundColor: 'white',
              },
            },
            control: {
              padding: '16px',
              '&:hover': {
                backgroundColor: COLORS.GRAY_50,
              },
            },
            panel: {
              padding: '0 16px 16px 16px',
            },
          }}
        >
          {/* Traffic Intelligence */}
          <TrafficAccordion
            data={company.traffic_data}
            monthlyVisits={company.sw_monthly_visits}
          />

          {/* Financial Intelligence */}
          <FinancialsAccordion
            data={company.financial_data}
            revenue={company.revenue}
            ticker={company.ticker}
            isPublic={company.is_public}
          />

          {/* Tech Stack */}
          <TechStackAccordion
            data={company.tech_stack_data}
            partnerTech={company.partner_tech}
            currentSearch={company.current_search}
          />

          {/* Buying Signals */}
          <SignalsAccordion
            hiring={company.hiring_data}
            executive={company.executive_data}
            investor={company.investor_data}
            execQuote={company.exec_quote}
            execName={company.exec_name}
            execTitle={company.exec_title}
          />

          {/* Strategic Intelligence */}
          <StrategicAccordion
            competitors={company.competitor_data}
            caseStudies={company.case_studies}
            displacementAngle={company.displacement_angle}
          />
        </Accordion>

        {/* Enrichment CTA */}
        {company.enrichment_level !== 'full' && (
          <Paper p="lg" mt="md" radius="md" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #e8f0fe 100%)', border: `1px solid ${COLORS.ALGOLIA_NEBULA_BLUE}20` }}>
            <Group justify="space-between">
              <div>
                <Text fw={600} c={COLORS.GRAY_900} mb={4}>Unlock Full Intelligence</Text>
                <Text size="sm" c={COLORS.GRAY_500}>
                  Enrich to see detailed traffic analytics, 3-year financials, hiring signals, executive quotes, and more.
                </Text>
              </div>
              <Button
                variant="filled"
                color="blue"
                leftSection={<IconRefresh size={16} />}
                onClick={() => onEnrich?.(company.domain)}
              >
                Enrich Now
              </Button>
            </Group>
          </Paper>
        )}

        {/* Last Enriched */}
        {company.last_enriched && (
          <Text size="xs" c={COLORS.GRAY_500} ta="center" mt="md">
            Last enriched: {new Date(company.last_enriched).toLocaleDateString()}
          </Text>
        )}
      </ScrollArea>

      {/* Footer Actions */}
      <div
        style={{
          background: 'white',
          borderTop: `1px solid ${COLORS.GRAY_200}`,
          padding: 16,
          flexShrink: 0,
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
              variant="light"
              leftSection={<IconRefresh size={14} />}
              onClick={() => onEnrich?.(company.domain)}
            >
              Refresh
            </Button>
            <Button
              variant="filled"
              color="blue"
            >
              Add to Campaign
            </Button>
          </Group>
        </Group>
      </div>
    </Drawer>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function QuickStat({ icon: Icon, label, value }: { icon: typeof IconBuilding; label: string; value: string }) {
  return (
    <Paper p="xs" radius="md" bg="white" withBorder>
      <Group gap={6}>
        <ThemeIcon size="sm" variant="light" color="gray">
          <Icon size={12} />
        </ThemeIcon>
        <div>
          <Text size="xs" c={COLORS.GRAY_500}>{label}</Text>
          <Text size="xs" fw={600} c={COLORS.GRAY_900} lineClamp={1}>{value}</Text>
        </div>
      </Group>
    </Paper>
  );
}

function formatNumber(n?: number): string {
  if (!n) return 'N/A';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString();
}
