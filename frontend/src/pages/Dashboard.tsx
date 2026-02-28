/**
 * Dashboard - Partner Intelligence BI Dashboard
 *
 * Visual dashboard with KPIs, galaxy breakdowns, cohort charts, and filters.
 */

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Box,
  SimpleGrid,
  ThemeIcon,
  Skeleton,
  Tooltip,
  Progress,
} from '@mantine/core';
import {
  IconDatabase,
  IconCode,
  IconShoppingCart,
  IconMail,
  IconTargetArrow,
  IconArrowRight,
  IconTrophy,
  IconFlame,
  IconLeaf,
  IconStack,
  IconChartPie,
  IconUsers,
  IconCloud,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { GalaxyBackground } from '../components/common/GalaxyBackground';

// =============================================================================
// Styles - Glassmorphism for galaxy background
// =============================================================================

const GLASS_CARD: React.CSSProperties = {
  backgroundColor: 'rgba(15, 23, 42, 0.85)',
  backdropFilter: 'blur(16px) saturate(180%)',
  WebkitBackdropFilter: 'blur(16px) saturate(180%)',
  borderRadius: '16px',
  padding: '24px',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderTop: '1px solid rgba(255, 255, 255, 0.2)',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1), 0 10px 20px rgba(0,0,0,0.15), 0 25px 50px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset',
};

const DARK_CARD: React.CSSProperties = {
  ...GLASS_CARD,
};

// =============================================================================
// Types
// =============================================================================

interface GalaxySummary {
  galaxy: string;
  tech: string;
  company_count: number;
}

interface CohortSummary {
  tech_cohort: string;
  company_count: number;
}

interface Stats {
  total: number;
  cms: number;
  commerce: number;
  martech: number;
  search: number;
  cloud: number;  // Hyperscaler Galaxy
  jackpot: number;
  high: number;
  medium: number;
  base: number;
  displacement: number;
  greenfield: number;
}

// =============================================================================
// API
// =============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

async function fetchStats(): Promise<Stats> {
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'count=exact',
    'Range': '0-0',
  };

  const queries = [
    { key: 'total', query: 'companies?select=domain' },
    { key: 'cms', query: 'companies?select=domain&cms_tech=not.is.null' },
    { key: 'commerce', query: 'companies?select=domain&commerce_tech=not.is.null' },
    { key: 'martech', query: 'companies?select=domain&martech_tech=not.is.null' },
    { key: 'search', query: 'companies?select=domain&search_tech=not.is.null' },
    { key: 'cloud', query: 'companies?select=domain&cloud_tech=not.is.null' },  // Hyperscaler Galaxy
    { key: 'jackpot', query: 'companies?select=domain&tech_cohort=eq.JACKPOT' },
    { key: 'high', query: 'companies?select=domain&tech_cohort=eq.HIGH' },
    { key: 'medium', query: 'companies?select=domain&tech_cohort=eq.MEDIUM' },
    { key: 'base', query: 'companies?select=domain&tech_cohort=eq.BASE' },
    { key: 'displacement', query: 'companies?select=domain&sales_play=eq.DISPLACEMENT' },
    { key: 'greenfield', query: 'companies?select=domain&sales_play=eq.GREENFIELD' },
  ];

  const results = await Promise.all(
    queries.map(q =>
      fetch(`${SUPABASE_URL}/rest/v1/${q.query}`, { headers })
        .then(r => ({ key: q.key, count: parseInt(r.headers.get('content-range')?.split('/')[1] || '0') }))
    )
  );

  const stats: any = {};
  results.forEach(r => { stats[r.key] = r.count; });
  return stats as Stats;
}

async function fetchGalaxySummary(): Promise<GalaxySummary[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/galaxy_summary?select=*`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

// =============================================================================
// Tech Logos (using colored badges as placeholder - can add real logos later)
// =============================================================================

const TECH_COLORS: Record<string, string> = {
  // CMS
  'AEM': '#fa0f00',
  'Contentful': '#2478cc',
  'Contentstack': '#6c5ce7',
  'Amplience': '#ff6b6b',
  'Sitecore': '#eb1f1f',
  // Commerce
  'SFCC': '#00a1e0',
  'Shopify+': '#7ab55c',
  'Magento': '#f26322',
  'BigCommerce': '#121118',
  'Commercetools': '#6359e9',
  'Spryker': '#29b6f6',
  // MarTech
  'SFMC': '#00a1e0',
  'Marketo': '#5c4c9f',
  'HubSpot': '#ff7a59',
  'Klaviyo': '#000000',
  // Search (Top competitors: Elastic, Bloomreach, Constructor, Coveo, SearchSpring, Yext)
  'Elastic': '#fed10a',
  'Bloomreach': '#002840',
  'Constructor': '#6366f1',
  'Coveo': '#f36f21',
  'SearchSpring': '#00b4d8',
  'Yext': '#0066cc',
  'Solr': '#d9411e',
  'Lucidworks': '#0066cc',
  // Hyperscaler/Cloud (AWS & Azure only - GCP is a competitor)
  'AWS': '#FF9900',
  'Azure': '#0078D4',
};

// =============================================================================
// Components
// =============================================================================

function KPICard({
  icon: Icon,
  value,
  label,
  color,
  onClick,
}: {
  icon: React.ElementType;
  value: number;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      style={{
        ...GLASS_CARD,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onClick={onClick}
    >
      <Group gap="md">
        <ThemeIcon size={50} radius="md" style={{ backgroundColor: color }}>
          <Icon size={26} color="white" />
        </ThemeIcon>
        <div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
            {value.toLocaleString()}
          </div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {label}
          </div>
        </div>
      </Group>
    </div>
  );
}

// Tech logo URLs - using Google favicon service (most reliable)
const TECH_LOGOS: Record<string, string> = {
  // CMS
  'AEM': 'https://www.google.com/s2/favicons?domain=adobe.com&sz=64',
  'Contentful': 'https://www.google.com/s2/favicons?domain=contentful.com&sz=64',
  'Contentstack': 'https://www.google.com/s2/favicons?domain=contentstack.com&sz=64',
  'Amplience': 'https://www.google.com/s2/favicons?domain=amplience.com&sz=64',
  'Sitecore': 'https://www.google.com/s2/favicons?domain=sitecore.com&sz=64',
  // Commerce
  'SFCC': 'https://www.google.com/s2/favicons?domain=salesforce.com&sz=64',
  'Shopify+': 'https://www.google.com/s2/favicons?domain=shopify.com&sz=64',
  'Magento': 'https://www.google.com/s2/favicons?domain=magento.com&sz=64',
  'BigCommerce': 'https://www.google.com/s2/favicons?domain=bigcommerce.com&sz=64',
  'Commercetools': 'https://www.google.com/s2/favicons?domain=commercetools.com&sz=64',
  'Spryker': 'https://www.google.com/s2/favicons?domain=spryker.com&sz=64',
  // MarTech
  'SFMC': 'https://www.google.com/s2/favicons?domain=salesforce.com&sz=64',
  'Marketo': 'https://www.google.com/s2/favicons?domain=marketo.com&sz=64',
  'HubSpot': 'https://www.google.com/s2/favicons?domain=hubspot.com&sz=64',
  'Klaviyo': 'https://www.google.com/s2/favicons?domain=klaviyo.com&sz=64',
  // Search (Top competitors: Elastic, Bloomreach, Constructor, Coveo, SearchSpring, Yext)
  'Elastic': 'https://www.google.com/s2/favicons?domain=elastic.co&sz=64',
  'Bloomreach': 'https://www.google.com/s2/favicons?domain=bloomreach.com&sz=64',
  'Constructor': 'https://www.google.com/s2/favicons?domain=constructor.io&sz=64',
  'Coveo': 'https://www.google.com/s2/favicons?domain=coveo.com&sz=64',
  'SearchSpring': 'https://www.google.com/s2/favicons?domain=searchspring.com&sz=64',
  'Yext': 'https://www.google.com/s2/favicons?domain=yext.com&sz=64',
  'Solr': 'https://www.google.com/s2/favicons?domain=solr.apache.org&sz=64',
  'Lucidworks': 'https://www.google.com/s2/favicons?domain=lucidworks.com&sz=64',
  'Doofinder': 'https://www.google.com/s2/favicons?domain=doofinder.com&sz=64',
  'Searchanise': 'https://www.google.com/s2/favicons?domain=searchanise.io&sz=64',
  'AddSearch': 'https://www.google.com/s2/favicons?domain=addsearch.com&sz=64',
  'Cludo': 'https://www.google.com/s2/favicons?domain=cludo.com&sz=64',
  // Cloud
  'AWS': 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64',
  'Azure': 'https://www.google.com/s2/favicons?domain=azure.microsoft.com&sz=64',
};

function TechLogo({ tech, color }: { tech: string; color: string }) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = TECH_LOGOS[tech];
  const bgColor = TECH_COLORS[tech] || color;

  if (logoUrl && !imgError) {
    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 6,
          backgroundColor: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          flexShrink: 0,
        }}
      >
        <img
          src={logoUrl}
          alt={tech}
          style={{ width: 26, height: 26, objectFit: 'contain' }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback to colored initial
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: bgColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 18,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {tech.charAt(0).toUpperCase()}
    </div>
  );
}

function GalaxyCard({
  title,
  icon: Icon,
  color,
  techData,
  onClick,
}: {
  title: string;
  icon: React.ElementType;
  color: string;
  techData: { tech: string; count: number }[];
  onClick?: () => void;
}) {
  // Calculate total from ALL techData items (not just displayed ones)
  const total = techData.reduce((sum, item) => sum + item.count, 0);
  const displayedItems = techData.slice(0, 5);
  const hiddenCount = techData.length - 5;

  return (
    <div style={{ ...DARK_CARD, cursor: onClick ? 'pointer' : 'default', padding: '20px' }} onClick={onClick}>
      {/* Header */}
      <Group gap="sm" mb="md">
        <ThemeIcon size={44} radius="md" style={{ backgroundColor: color }}>
          <Icon size={24} color="white" />
        </ThemeIcon>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>{title}</div>
      </Group>

      {/* Total */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{total.toLocaleString()}</div>
      </div>

      {/* Tech breakdown with logos */}
      <Stack gap={8}>
        {displayedItems.map((item) => (
          <div key={item.tech} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <TechLogo tech={item.tech} color={color} />
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#e2e8f0', whiteSpace: 'nowrap' }}>{item.tech}</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{item.count.toLocaleString()}</span>
          </div>
        ))}
        {hiddenCount > 0 && (
          <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
            +{hiddenCount} more
          </div>
        )}
      </Stack>
    </div>
  );
}

function CohortChart({ stats, onCohortClick }: { stats: Stats; onCohortClick?: (cohort: string) => void }) {
  const [hoveredCohort, setHoveredCohort] = useState<string | null>(null);
  const total = stats.jackpot + stats.high + stats.medium + stats.base;
  const cohorts = [
    { label: 'JACKPOT', value: stats.jackpot, color: '#10b981', desc: 'CMS + Commerce + MarTech/Search' },
    { label: 'HIGH', value: stats.high, color: '#3b82f6', desc: 'CMS + Commerce' },
    { label: 'MEDIUM', value: stats.medium, color: '#f59e0b', desc: 'Premium Commerce only' },
    { label: 'BASE', value: stats.base, color: '#64748b', desc: 'Any partner tech' },
  ];

  const hoveredData = hoveredCohort ? cohorts.find(c => c.label === hoveredCohort) : null;

  // Custom SVG donut with minimum segment visibility
  const size = 220;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Calculate segments with minimum 3% visibility for small segments
  const MIN_PERCENT = 3;
  let segments: { label: string; value: number; percent: number; visualPercent: number; color: string; offset: number }[] = [];
  let usedPercent = 0;

  // First pass: identify segments that need minimum boost
  const rawPercents = cohorts.map(c => total > 0 ? (c.value / total) * 100 : 0);
  const needsBoost = rawPercents.map(p => p > 0 && p < MIN_PERCENT);
  const boostCount = needsBoost.filter(Boolean).length;
  const boostTotal = boostCount * MIN_PERCENT - rawPercents.filter((p, i) => needsBoost[i]).reduce((a, b) => a + b, 0);

  // Second pass: redistribute from large segments
  let currentOffset = 0;
  cohorts.forEach((c, i) => {
    const rawPercent = rawPercents[i];
    let visualPercent = rawPercent;

    if (rawPercent > 0 && rawPercent < MIN_PERCENT) {
      visualPercent = MIN_PERCENT; // Boost small segments
    } else if (rawPercent >= MIN_PERCENT && boostTotal > 0) {
      // Reduce large segments proportionally
      const largeTotal = rawPercents.filter((p, j) => !needsBoost[j]).reduce((a, b) => a + b, 0);
      visualPercent = rawPercent - (boostTotal * (rawPercent / largeTotal));
    }

    segments.push({
      label: c.label,
      value: c.value,
      percent: rawPercent,
      visualPercent,
      color: c.color,
      offset: currentOffset,
    });
    currentOffset += visualPercent;
  });

  // SVG arc path for donut segment
  const describeArc = (startPercent: number, endPercent: number, r: number) => {
    const startAngle = (startPercent / 100) * 360 - 90;
    const endAngle = (endPercent / 100) * 360 - 90;
    const start = polarToCartesian(center, center, r, endAngle);
    const end = polarToCartesian(center, center, r, startAngle);
    const largeArc = endPercent - startPercent > 50 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  return (
    <div style={GLASS_CARD}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '24px' }}>
        <IconChartPie size={24} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
        Tech Cohort Distribution
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
        {/* Custom SVG Donut Chart */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            {/* Background circle */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={strokeWidth}
            />
            {/* Segments */}
            {segments.map((seg, i) => {
              const isHovered = hoveredCohort === seg.label;
              const startPercent = seg.offset;
              const endPercent = seg.offset + seg.visualPercent;

              if (seg.visualPercent <= 0) return null;

              return (
                <path
                  key={seg.label}
                  d={describeArc(startPercent, endPercent, radius)}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 8 : strokeWidth}
                  strokeLinecap="round"
                  style={{
                    transition: 'all 0.2s ease',
                    opacity: hoveredCohort && !isHovered ? 0.4 : 1,
                    filter: isHovered ? 'brightness(1.2) drop-shadow(0 0 8px ' + seg.color + ')' : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredCohort(seg.label)}
                  onMouseLeave={() => setHoveredCohort(null)}
                  onClick={() => onCohortClick?.(seg.label)}
                />
              );
            })}
          </svg>
          {/* Center label */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {hoveredData ? (
              <>
                <div style={{ fontSize: '32px', fontWeight: 700, color: hoveredData.color, lineHeight: 1 }}>
                  {hoveredData.value.toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginTop: 4 }}>
                  {hoveredData.label}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>
                  {total.toLocaleString()}
                </div>
                <div style={{ fontSize: '16px', color: '#94a3b8', marginTop: 4 }}>Total</div>
              </>
            )}
          </div>
        </div>

        {/* Compact Legend */}
        <div style={{ flex: 1 }}>
          {cohorts.map((c) => (
            <div
              key={c.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                marginBottom: '8px',
                borderRadius: '10px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: hoveredCohort === c.label ? `${c.color}25` : 'rgba(255,255,255,0.03)',
                border: hoveredCohort === c.label ? `2px solid ${c.color}` : '2px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={() => setHoveredCohort(c.label)}
              onMouseLeave={() => setHoveredCohort(null)}
              onClick={() => onCohortClick?.(c.label)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '4px', backgroundColor: c.color }} />
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>{c.label}</div>
                  <div style={{ fontSize: '14px', color: '#94a3b8' }}>{c.desc}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: hoveredCohort === c.label ? c.color : '#ffffff' }}>
                  {c.value.toLocaleString()}
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>
                  {total > 0 ? ((c.value / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SalesPlayChart({ stats, onPlayClick }: { stats: Stats; onPlayClick?: (play: string) => void }) {
  const [hoveredPlay, setHoveredPlay] = useState<string | null>(null);
  const total = stats.displacement + stats.greenfield;
  const plays = [
    { label: 'DISPLACEMENT', value: stats.displacement, color: '#ef4444', desc: 'Has competitor search', icon: IconFlame },
    { label: 'GREENFIELD', value: stats.greenfield, color: '#10b981', desc: 'No search yet', icon: IconLeaf },
  ];

  return (
    <div style={GLASS_CARD}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '24px' }}>
        <IconTargetArrow size={24} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
        Sales Play Distribution
      </div>

      <Stack gap="lg">
        {plays.map((p) => {
          const percent = total > 0 ? (p.value / total) * 100 : 0;
          const isHovered = hoveredPlay === p.label;
          return (
            <div
              key={p.label}
              style={{
                padding: '20px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                backgroundColor: isHovered ? `${p.color}20` : 'rgba(255,255,255,0.03)',
                border: isHovered ? `2px solid ${p.color}` : '2px solid rgba(255,255,255,0.1)',
              }}
              onMouseEnter={() => setHoveredPlay(p.label)}
              onMouseLeave={() => setHoveredPlay(null)}
              onClick={() => onPlayClick?.(p.label)}
            >
              <Group justify="space-between" mb="md">
                <Group gap="md">
                  <ThemeIcon size={48} radius="md" style={{ backgroundColor: p.color }}>
                    <p.icon size={26} />
                  </ThemeIcon>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: isHovered ? p.color : '#ffffff' }}>{p.label}</div>
                    <div style={{ fontSize: '14px', color: '#94a3b8' }}>{p.desc}</div>
                  </div>
                </Group>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '32px', fontWeight: 700, color: isHovered ? p.color : '#ffffff' }}>{p.value.toLocaleString()}</div>
                  <div style={{ fontSize: '16px', color: '#94a3b8' }}>{percent.toFixed(1)}%</div>
                </div>
              </Group>
              <Progress
                value={percent}
                size="xl"
                radius="xl"
                color={p.color}
                styles={{ root: { backgroundColor: 'rgba(255,255,255,0.1)' } }}
              />
            </div>
          );
        })}
      </Stack>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [galaxyData, setGalaxyData] = useState<GalaxySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsResult, galaxyResult] = await Promise.all([
          fetchStats(),
          fetchGalaxySummary(),
        ]);
        setStats(statsResult);
        setGalaxyData(galaxyResult);
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Group galaxy data by type
  const cmsData = galaxyData.filter(g => g.galaxy === 'cms').map(g => ({ tech: g.tech, count: g.company_count }));
  const commerceData = galaxyData.filter(g => g.galaxy === 'commerce').map(g => ({ tech: g.tech, count: g.company_count }));
  const martechData = galaxyData.filter(g => g.galaxy === 'martech').map(g => ({ tech: g.tech, count: g.company_count }));
  const searchData = galaxyData.filter(g => g.galaxy === 'search').map(g => ({ tech: g.tech, count: g.company_count }));
  const cloudData = galaxyData.filter(g => g.galaxy === 'cloud').map(g => ({ tech: g.tech, count: g.company_count }));

  return (
    <GalaxyBackground>
      <Container size="xl" py="lg">
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <Title order={1} style={{ color: '#ffffff', fontSize: '32px' }}>
            Partner Intelligence Dashboard
          </Title>
          <Button
            size="lg"
            rightSection={<IconArrowRight size={20} />}
            variant="gradient"
            gradient={{ from: '#003DFF', to: '#5468FF' }}
            onClick={() => navigate('/galaxy')}
          >
            Explore Galaxy
          </Button>
        </Group>

        {/* Galaxy Cards - Main KPI display with tech breakdowns */}
        <div style={{ marginBottom: '32px' }}>
          <Group justify="space-between" mb="xl">
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff' }}>
              Partner Tech Galaxies
            </div>
            <Group gap="md">
              <Badge size="xl" variant="filled" color="blue" style={{ fontSize: 18, padding: '12px 20px', fontWeight: 700 }}>
                {stats?.total.toLocaleString() || 0} Total Companies
              </Badge>
            </Group>
          </Group>
          {loading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} height={280} radius="md" />)}
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
              <GalaxyCard
                title="CMS"
                icon={IconCode}
                color="#6366f1"
                techData={cmsData}
                onClick={() => navigate('/galaxy?filter=cms')}
              />
              <GalaxyCard
                title="Commerce"
                icon={IconShoppingCart}
                color="#3b82f6"
                techData={commerceData}
                onClick={() => navigate('/galaxy?filter=commerce')}
              />
              <GalaxyCard
                title="MarTech"
                icon={IconMail}
                color="#10b981"
                techData={martechData}
                onClick={() => navigate('/galaxy?filter=martech')}
              />
              <GalaxyCard
                title="Hyperscalers"
                icon={IconCloud}
                color="#FF9900"
                techData={cloudData}
                onClick={() => navigate('/galaxy?filter=cloud')}
              />
              <GalaxyCard
                title="Search"
                icon={IconTargetArrow}
                color="#ef4444"
                techData={searchData}
                onClick={() => navigate('/galaxy?filter=search')}
              />
            </SimpleGrid>
          )}
        </div>

        {/* Charts Row */}
        {loading ? (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Skeleton height={380} radius="md" />
            <Skeleton height={380} radius="md" />
          </SimpleGrid>
        ) : stats && (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <CohortChart stats={stats} onCohortClick={(cohort) => navigate(`/galaxy?cohort=${cohort}`)} />
            <SalesPlayChart stats={stats} onPlayClick={(play) => navigate(`/galaxy?play=${play}`)} />
          </SimpleGrid>
        )}

        {/* Call to Action */}
        {stats && stats.jackpot > 0 && (
          <div
            style={{
              marginTop: '24px',
              padding: '24px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              textAlign: 'center',
            }}
          >
            <Group justify="center" gap="md">
              <IconTrophy size={32} />
              <div>
                <div style={{ fontSize: '24px', fontWeight: 700 }}>
                  {stats.jackpot} JACKPOT Targets Ready
                </div>
                <div style={{ fontSize: '16px', opacity: 0.9 }}>
                  Companies with CMS + Commerce + MarTech/Search - Full stack displacement opportunities
                </div>
              </div>
              <Button
                size="lg"
                variant="white"
                color="green"
                rightSection={<IconArrowRight size={20} />}
                onClick={() => navigate('/galaxy?cohort=JACKPOT')}
              >
                View JACKPOT List
              </Button>
            </Group>
          </div>
        )}
      </Container>
    </GalaxyBackground>
  );
}

export default Dashboard;
