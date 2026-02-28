/**
 * Dashboard - Intelligence Brief Landing
 *
 * Premium landing experience showing pipeline health and top opportunities.
 * Hybrid of Option C (Intelligence Brief) with Option A (Mission Control) visuals.
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  Badge,
  Button,
  Progress,
  Box,
  SimpleGrid,
  ThemeIcon,
  Divider,
  Skeleton,
} from '@mantine/core';
import {
  IconFlame,
  IconRocket,
  IconTrendingUp,
  IconUsers,
  IconPlanet,
  IconTarget,
  IconArrowRight,
  IconSparkles,
  IconBuildingSkyscraper,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '../lib/constants';

// =============================================================================
// Types
// =============================================================================

interface PipelineStats {
  galaxy: number;
  whale: number;
  crossbeam: number;
  hot: number;
  jackpot: number;
  displacement: number;
}

interface TopOpportunity {
  domain: string;
  company_name: string | null;
  tech_cohort: string;
  sales_play: string;
  cms_tech: string | null;
  commerce_tech: string | null;
  martech_tech: string | null;
  search_tech: string | null;
}

// =============================================================================
// API
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

async function fetchPipelineStats(): Promise<PipelineStats> {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  const [galaxyRes, whaleRes, crossbeamRes, jackpotRes, displacementRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain`, { headers, method: 'HEAD' }),
    fetch(`${SUPABASE_URL}/rest/v1/whale_composite?select=domain`, { headers, method: 'HEAD' }),
    fetch(`${SUPABASE_URL}/rest/v1/crossbeam_overlaps?select=domain`, { headers, method: 'HEAD' }),
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain&tech_cohort=eq.JACKPOT`, { headers, method: 'HEAD' }),
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain&sales_play=eq.DISPLACEMENT`, { headers, method: 'HEAD' }),
  ]);

  // Parse counts from content-range headers
  const getCount = (res: Response) => {
    const range = res.headers.get('content-range');
    return range ? parseInt(range.split('/')[1]) || 0 : 0;
  };

  // For proper counts, we need exact count
  const [galaxyCount, whaleCount, crossbeamCount, jackpotCount, displacementCount] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain`, {
      headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
    }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/whale_composite?select=domain`, {
      headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
    }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/crossbeam_overlaps?select=domain`, {
      headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
    }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain&tech_cohort=eq.JACKPOT`, {
      headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
    }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain&sales_play=eq.DISPLACEMENT`, {
      headers: { ...headers, 'Prefer': 'count=exact', 'Range': '0-0' }
    }).then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
  ]);

  return {
    galaxy: galaxyCount,
    whale: whaleCount,
    crossbeam: crossbeamCount,
    hot: jackpotCount, // Using JACKPOT as "hot" for now
    jackpot: jackpotCount,
    displacement: displacementCount,
  };
}

async function fetchTopOpportunities(): Promise<TopOpportunity[]> {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  };

  // Get JACKPOT companies first, then HIGH cohort
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?select=domain,company_name,tech_cohort,sales_play,cms_tech,commerce_tech,martech_tech,search_tech&or=(tech_cohort.eq.JACKPOT,tech_cohort.eq.HIGH)&order=tech_cohort.asc&limit=5`,
    { headers }
  );

  if (!res.ok) return [];
  return res.json();
}

// =============================================================================
// Components
// =============================================================================

function HeroStat({ value, label, trend }: { value: number; label: string; trend?: string }) {
  return (
    <Box ta="center">
      <Text
        size="4rem"
        fw={700}
        variant="gradient"
        gradient={{ from: '#10b981', to: '#3b82f6', deg: 135 }}
        style={{ lineHeight: 1 }}
      >
        {value.toLocaleString()}
      </Text>
      <Text size="xl" c="white" fw={500} mt="xs">
        {label}
      </Text>
      {trend && (
        <Group gap={4} justify="center" mt={4}>
          <IconTrendingUp size={16} color="#10b981" />
          <Text size="sm" c="green.4">{trend}</Text>
        </Group>
      )}
    </Box>
  );
}

function PipelineBar({
  label,
  value,
  total,
  color,
  icon: Icon,
  onClick
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const percent = total > 0 ? (value / total) * 100 : 0;

  return (
    <Box
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      className={onClick ? 'hover-lift' : ''}
    >
      <Group justify="space-between" mb={8}>
        <Group gap="sm">
          <ThemeIcon size="md" color={color} variant="light">
            <Icon size={16} />
          </ThemeIcon>
          <Text size="md" fw={500} c="white">{label}</Text>
        </Group>
        <Group gap="xs">
          <Text size="lg" fw={700} c="white">{value.toLocaleString()}</Text>
          <Text size="sm" c="dimmed">({percent.toFixed(1)}%)</Text>
        </Group>
      </Group>
      <Progress
        value={percent}
        size="lg"
        radius="xl"
        color={color}
        styles={{
          root: { backgroundColor: 'rgba(255,255,255,0.1)' },
        }}
      />
    </Box>
  );
}

function OpportunityCard({ opportunity }: { opportunity: TopOpportunity }) {
  const techStack = [
    opportunity.cms_tech,
    opportunity.commerce_tech,
    opportunity.martech_tech,
    opportunity.search_tech,
  ].filter(Boolean);

  const isJackpot = opportunity.tech_cohort === 'JACKPOT';
  const isDisplacement = opportunity.sales_play === 'DISPLACEMENT';

  return (
    <Paper
      p="lg"
      radius="md"
      style={{
        backgroundColor: isJackpot ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
        border: isJackpot ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Group justify="space-between" mb="sm">
        <Group gap="sm">
          <ThemeIcon
            size="lg"
            radius="xl"
            color={isJackpot ? 'green' : 'blue'}
            variant="filled"
          >
            <IconBuildingSkyscraper size={18} />
          </ThemeIcon>
          <div>
            <Text size="lg" fw={600} c="white">
              {opportunity.domain}
            </Text>
            {opportunity.company_name && (
              <Text size="sm" c="dimmed">{opportunity.company_name}</Text>
            )}
          </div>
        </Group>
        <Group gap="xs">
          <Badge
            size="lg"
            color={isJackpot ? 'green' : 'blue'}
            variant="filled"
          >
            {opportunity.tech_cohort}
          </Badge>
          <Badge
            size="lg"
            color={isDisplacement ? 'red' : 'teal'}
            variant="outline"
          >
            {opportunity.sales_play}
          </Badge>
        </Group>
      </Group>

      <Group gap="xs" mb="md">
        {techStack.map((tech, i) => (
          <Badge key={i} size="md" variant="light" color="gray">
            {tech}
          </Badge>
        ))}
      </Group>

      <Text size="md" c="gray.4">
        {isJackpot && isDisplacement && '→ Full stack with competitor search. Prime displacement target.'}
        {isJackpot && !isDisplacement && '→ Full stack, no search yet. Greenfield opportunity.'}
        {!isJackpot && isDisplacement && '→ Has competitor search. Displacement opportunity.'}
        {!isJackpot && !isDisplacement && '→ Strong partner tech presence.'}
      </Text>
    </Paper>
  );
}

function JourneyStep({
  step,
  label,
  value,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  step: number;
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
      }}
      className="hover-lift"
    >
      <Paper
        p="xl"
        radius="lg"
        style={{
          backgroundColor: active ? `${color}20` : 'rgba(255,255,255,0.05)',
          border: active ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}
      >
        <ThemeIcon size={48} radius="xl" color={color} variant="light" mb="md" mx="auto">
          <Icon size={24} />
        </ThemeIcon>
        <Text size="2rem" fw={700} c="white" style={{ lineHeight: 1 }}>
          {value.toLocaleString()}
        </Text>
        <Text size="lg" c="dimmed" mt="xs">
          {label}
        </Text>
      </Paper>
    </Box>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [opportunities, setOpportunities] = useState<TopOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsResult, oppsResult] = await Promise.all([
          fetchPipelineStats(),
          fetchTopOpportunities(),
        ]);
        setStats(statsResult);
        setOpportunities(oppsResult);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <Box pos="relative" style={{ minHeight: '100vh' }}>
      {/* Galaxy Background */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          backgroundImage: 'url(/images/milky-way.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.7) 0%, rgba(15,23,42,0.9) 100%)',
          }}
        />
      </Box>

      {/* Content */}
      <Container size="lg" py="xl" pos="relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Text size="lg" c="dimmed">{today}</Text>
            <Title order={1} c="white" mt="xs">
              Partner Intelligence Brief
            </Title>
          </div>
          <Button
            size="lg"
            rightSection={<IconArrowRight size={18} />}
            variant="gradient"
            gradient={{ from: COLORS.ALGOLIA_NEBULA_BLUE, to: COLORS.ALGOLIA_PURPLE }}
            onClick={() => navigate('/galaxy')}
          >
            Enter Galaxy
          </Button>
        </Group>

        {/* Hero Stat */}
        <Paper
          p="xl"
          radius="lg"
          mb="xl"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
          }}
        >
          {loading ? (
            <Skeleton height={120} radius="md" />
          ) : (
            <>
              <Group justify="center" gap={4} mb="md">
                <IconSparkles size={24} color="#10b981" />
                <Text size="lg" c="dimmed">Ready for Outreach</Text>
              </Group>
              <HeroStat
                value={stats?.jackpot || 0}
                label="JACKPOT Targets"
                trend={stats?.jackpot && stats.jackpot > 0 ? "High-value opportunities" : undefined}
              />
              <Text size="md" c="dimmed" mt="lg">
                Companies with CMS + Commerce + MarTech/Search
              </Text>
            </>
          )}
        </Paper>

        {/* Journey Steps */}
        <Text size="xl" fw={600} c="white" mb="lg">
          Pipeline Journey
        </Text>
        <SimpleGrid cols={{ base: 2, md: 4 }} mb="xl">
          <JourneyStep
            step={1}
            label="Galaxy"
            value={stats?.galaxy || 0}
            color={COLORS.ALGOLIA_PURPLE}
            icon={IconPlanet}
            onClick={() => navigate('/galaxy')}
          />
          <JourneyStep
            step={2}
            label="Whales"
            value={stats?.whale || 0}
            color="#f59e0b"
            icon={IconFlame}
            onClick={() => navigate('/whale')}
          />
          <JourneyStep
            step={3}
            label="Warm Intros"
            value={stats?.crossbeam || 0}
            color="#14b8a6"
            icon={IconUsers}
            onClick={() => navigate('/crossbeam')}
          />
          <JourneyStep
            step={4}
            label="JACKPOT"
            value={stats?.jackpot || 0}
            color="#10b981"
            icon={IconTarget}
            active
          />
        </SimpleGrid>

        {/* Pipeline Health */}
        <Paper
          p="xl"
          radius="lg"
          mb="xl"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Text size="xl" fw={600} c="white" mb="xl">
            Pipeline Health
          </Text>

          {loading ? (
            <Stack gap="lg">
              <Skeleton height={50} radius="md" />
              <Skeleton height={50} radius="md" />
              <Skeleton height={50} radius="md" />
            </Stack>
          ) : (
            <Stack gap="xl">
              <PipelineBar
                label="Partner Tech Galaxy"
                value={stats?.galaxy || 0}
                total={stats?.galaxy || 1}
                color={COLORS.ALGOLIA_PURPLE}
                icon={IconPlanet}
                onClick={() => navigate('/galaxy')}
              />
              <PipelineBar
                label="Whale Composite (Intent + Qualification)"
                value={stats?.whale || 0}
                total={stats?.galaxy || 1}
                color="#f59e0b"
                icon={IconFlame}
                onClick={() => navigate('/whale')}
              />
              <PipelineBar
                label="Crossbeam Overlap (Warm Intros)"
                value={stats?.crossbeam || 0}
                total={stats?.galaxy || 1}
                color="#14b8a6"
                icon={IconUsers}
                onClick={() => navigate('/crossbeam')}
              />
              <PipelineBar
                label="Displacement Targets (Competitor Search)"
                value={stats?.displacement || 0}
                total={stats?.galaxy || 1}
                color="#ef4444"
                icon={IconRocket}
              />
            </Stack>
          )}
        </Paper>

        {/* Top Opportunities */}
        <Paper
          p="xl"
          radius="lg"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Group justify="space-between" mb="xl">
            <Text size="xl" fw={600} c="white">
              Top Opportunities
            </Text>
            <Button
              variant="subtle"
              color="gray"
              rightSection={<IconArrowRight size={16} />}
              onClick={() => navigate('/galaxy')}
            >
              View All
            </Button>
          </Group>

          {loading ? (
            <Stack gap="md">
              <Skeleton height={120} radius="md" />
              <Skeleton height={120} radius="md" />
            </Stack>
          ) : opportunities.length > 0 ? (
            <Stack gap="md">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.domain} opportunity={opp} />
              ))}
            </Stack>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No JACKPOT or HIGH cohort targets yet. Keep building your galaxy!
            </Text>
          )}
        </Paper>
      </Container>

      {/* Global styles */}
      <style>{`
        .hover-lift:hover {
          transform: translateY(-2px);
          transition: transform 0.2s ease;
        }
      `}</style>
    </Box>
  );
}

export default Dashboard;
