/**
 * Dashboard - Intelligence Brief Landing
 *
 * Premium landing experience showing pipeline health and top opportunities.
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

// =============================================================================
// Styles - Explicit inline styles to override global CSS
// =============================================================================

const STYLES = {
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
  } as React.CSSProperties,
  textWhite: { color: '#ffffff' } as React.CSSProperties,
  textGray: { color: '#94a3b8' } as React.CSSProperties,
  textGreen: { color: '#10b981' } as React.CSSProperties,
};

// =============================================================================
// Types
// =============================================================================

interface PipelineStats {
  galaxy: number;
  whale: number;
  crossbeam: number;
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
    'Prefer': 'count=exact',
    'Range': '0-0',
  };

  const [galaxyCount, whaleCount, crossbeamCount, jackpotCount, displacementCount] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain`, { headers })
      .then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/whale_composite?select=domain`, { headers })
      .then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/crossbeam_overlaps?select=domain`, { headers })
      .then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain&tech_cohort=eq.JACKPOT`, { headers })
      .then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=domain&sales_play=eq.DISPLACEMENT`, { headers })
      .then(r => parseInt(r.headers.get('content-range')?.split('/')[1] || '0')),
  ]);

  return { galaxy: galaxyCount, whale: whaleCount, crossbeam: crossbeamCount, jackpot: jackpotCount, displacement: displacementCount };
}

async function fetchTopOpportunities(): Promise<TopOpportunity[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/companies?select=domain,company_name,tech_cohort,sales_play,cms_tech,commerce_tech,martech_tech,search_tech&or=(tech_cohort.eq.JACKPOT,tech_cohort.eq.HIGH)&order=tech_cohort.asc&limit=5`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

// =============================================================================
// Components
// =============================================================================

function JourneyCard({
  label,
  value,
  color,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ElementType;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Paper
      p="xl"
      radius="lg"
      onClick={onClick}
      style={{
        ...STYLES.card,
        cursor: onClick ? 'pointer' : 'default',
        border: active ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.15)',
        backgroundColor: active ? `${color}20` : 'rgba(15, 23, 42, 0.85)',
        textAlign: 'center',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      className="dashboard-card"
    >
      <ThemeIcon size={56} radius="xl" style={{ backgroundColor: color, margin: '0 auto 16px' }}>
        <Icon size={28} color="white" />
      </ThemeIcon>
      <Text size="2.5rem" fw={700} style={{ ...STYLES.textWhite, lineHeight: 1 }}>
        {value.toLocaleString()}
      </Text>
      <Text size="lg" mt="sm" style={STYLES.textGray}>
        {label}
      </Text>
    </Paper>
  );
}

function PipelineBar({
  label,
  value,
  total,
  color,
  icon: Icon,
  onClick,
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
      className="dashboard-card"
    >
      <Group justify="space-between" mb={12}>
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" style={{ backgroundColor: color }}>
            <Icon size={18} color="white" />
          </ThemeIcon>
          <Text size="lg" fw={500} style={STYLES.textWhite}>{label}</Text>
        </Group>
        <Group gap="sm">
          <Text size="xl" fw={700} style={STYLES.textWhite}>{value.toLocaleString()}</Text>
          <Text size="md" style={STYLES.textGray}>({percent.toFixed(1)}%)</Text>
        </Group>
      </Group>
      <Progress
        value={percent}
        size="xl"
        radius="xl"
        color={color}
        styles={{
          root: { backgroundColor: 'rgba(255,255,255,0.1)', height: 12 },
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
      p="xl"
      radius="lg"
      style={{
        ...STYLES.card,
        backgroundColor: isJackpot ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.85)',
        border: isJackpot ? '2px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255,255,255,0.15)',
      }}
    >
      <Group justify="space-between" mb="md">
        <Group gap="md">
          <ThemeIcon size={48} radius="xl" color={isJackpot ? 'green' : 'blue'}>
            <IconBuildingSkyscraper size={24} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={700} style={STYLES.textWhite}>
              {opportunity.domain}
            </Text>
            {opportunity.company_name && (
              <Text size="md" style={STYLES.textGray}>{opportunity.company_name}</Text>
            )}
          </div>
        </Group>
        <Group gap="sm">
          <Badge size="lg" color={isJackpot ? 'green' : 'blue'}>
            {opportunity.tech_cohort}
          </Badge>
          <Badge size="lg" color={isDisplacement ? 'red' : 'teal'} variant="outline">
            {opportunity.sales_play}
          </Badge>
        </Group>
      </Group>

      <Group gap="sm" mb="md">
        {techStack.map((tech, i) => (
          <Badge key={i} size="lg" variant="light" color="gray">
            {tech}
          </Badge>
        ))}
      </Group>

      <Text size="md" style={STYLES.textGray}>
        {isJackpot && isDisplacement && '→ Full stack with competitor search. Prime displacement target.'}
        {isJackpot && !isDisplacement && '→ Full stack, no search yet. Greenfield opportunity.'}
        {!isJackpot && isDisplacement && '→ Has competitor search. Displacement opportunity.'}
        {!isJackpot && !isDisplacement && '→ Strong partner tech presence.'}
      </Text>
    </Paper>
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
            background: 'linear-gradient(180deg, rgba(15,23,42,0.75) 0%, rgba(15,23,42,0.95) 100%)',
          }}
        />
      </Box>

      {/* Content */}
      <Container size="lg" py="xl" pos="relative" style={{ zIndex: 1 }}>
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <div>
            <Text size="lg" style={STYLES.textGray}>{today}</Text>
            <Title order={1} mt="xs" style={{ color: '#ffffff', fontSize: '2.5rem' }}>
              Partner Intelligence Brief
            </Title>
          </div>
          <Button
            size="lg"
            rightSection={<IconArrowRight size={20} />}
            variant="gradient"
            gradient={{ from: '#003DFF', to: '#5468FF' }}
            onClick={() => navigate('/galaxy')}
          >
            Enter Galaxy
          </Button>
        </Group>

        {/* Hero Stat */}
        <Paper p="xl" radius="lg" mb="xl" style={{ ...STYLES.card, textAlign: 'center' }}>
          {loading ? (
            <Skeleton height={150} radius="md" />
          ) : (
            <>
              <Group justify="center" gap="sm" mb="lg">
                <IconSparkles size={28} color="#10b981" />
                <Text size="xl" style={STYLES.textGray}>Ready for Outreach</Text>
              </Group>
              <Text
                style={{
                  fontSize: '5rem',
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                }}
              >
                {stats?.jackpot || 0}
              </Text>
              <Text size="xl" fw={600} mt="md" style={STYLES.textWhite}>
                JACKPOT Targets
              </Text>
              <Group justify="center" gap="xs" mt="sm">
                <IconTrendingUp size={18} color="#10b981" />
                <Text size="md" style={STYLES.textGreen}>High-value opportunities</Text>
              </Group>
              <Text size="lg" mt="lg" style={STYLES.textGray}>
                Companies with CMS + Commerce + MarTech/Search
              </Text>
            </>
          )}
        </Paper>

        {/* Journey Steps */}
        <Text size="xl" fw={600} mb="lg" style={STYLES.textWhite}>
          Pipeline Journey
        </Text>
        <SimpleGrid cols={{ base: 2, md: 4 }} mb="xl">
          <JourneyCard
            label="Galaxy"
            value={stats?.galaxy || 0}
            color="#5468FF"
            icon={IconPlanet}
            onClick={() => navigate('/galaxy')}
          />
          <JourneyCard
            label="Whales"
            value={stats?.whale || 0}
            color="#f59e0b"
            icon={IconFlame}
            onClick={() => navigate('/whale')}
          />
          <JourneyCard
            label="Warm Intros"
            value={stats?.crossbeam || 0}
            color="#14b8a6"
            icon={IconUsers}
            onClick={() => navigate('/crossbeam')}
          />
          <JourneyCard
            label="JACKPOT"
            value={stats?.jackpot || 0}
            color="#10b981"
            icon={IconTarget}
            active
          />
        </SimpleGrid>

        {/* Pipeline Health */}
        <Paper p="xl" radius="lg" mb="xl" style={STYLES.card}>
          <Text size="xl" fw={600} mb="xl" style={STYLES.textWhite}>
            Pipeline Health
          </Text>

          {loading ? (
            <Stack gap="xl">
              <Skeleton height={60} radius="md" />
              <Skeleton height={60} radius="md" />
              <Skeleton height={60} radius="md" />
            </Stack>
          ) : (
            <Stack gap="xl">
              <PipelineBar
                label="Partner Tech Galaxy"
                value={stats?.galaxy || 0}
                total={stats?.galaxy || 1}
                color="#5468FF"
                icon={IconPlanet}
                onClick={() => navigate('/galaxy')}
              />
              <PipelineBar
                label="Demandbase + Zoominfo"
                value={stats?.whale || 0}
                total={stats?.galaxy || 1}
                color="#f59e0b"
                icon={IconFlame}
                onClick={() => navigate('/whale')}
              />
              <PipelineBar
                label="Crossbeam Overlap"
                value={stats?.crossbeam || 0}
                total={stats?.galaxy || 1}
                color="#14b8a6"
                icon={IconUsers}
                onClick={() => navigate('/crossbeam')}
              />
              <PipelineBar
                label="Displacement Targets"
                value={stats?.displacement || 0}
                total={stats?.galaxy || 1}
                color="#ef4444"
                icon={IconRocket}
              />
            </Stack>
          )}
        </Paper>

        {/* Top Opportunities */}
        <Paper p="xl" radius="lg" style={STYLES.card}>
          <Group justify="space-between" mb="xl">
            <Text size="xl" fw={600} style={STYLES.textWhite}>
              Top Opportunities
            </Text>
            <Button
              variant="subtle"
              color="gray"
              rightSection={<IconArrowRight size={18} />}
              onClick={() => navigate('/galaxy')}
              styles={{ root: { color: '#94a3b8' } }}
            >
              View All
            </Button>
          </Group>

          {loading ? (
            <Stack gap="lg">
              <Skeleton height={140} radius="md" />
              <Skeleton height={140} radius="md" />
            </Stack>
          ) : opportunities.length > 0 ? (
            <Stack gap="lg">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.domain} opportunity={opp} />
              ))}
            </Stack>
          ) : (
            <Text size="lg" ta="center" py="xl" style={STYLES.textGray}>
              No JACKPOT or HIGH cohort targets yet. Keep building your galaxy!
            </Text>
          )}
        </Paper>
      </Container>

      {/* Hover styles */}
      <style>{`
        .dashboard-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </Box>
  );
}

export default Dashboard;
