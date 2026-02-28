/**
 * ICPLandingPage - Data-Driven ICP Definition
 *
 * Dark theme, visualization-first design matching Dashboard/Galaxy
 * Pattern inspired by Product Sales & Realization dashboard
 */

import { useState, useEffect } from 'react';
import { Box, Text, Group, Paper, SimpleGrid, Stack, Badge, Tooltip, Loader, TextInput, Pagination, Notification } from '@mantine/core';
import { IconBrandAlgolia, IconQuote, IconExternalLink, IconSearch, IconCopy, IconCheck } from '@tabler/icons-react';
import { ICPButterflyChart } from '@/components/icp/ICPButterflyChart';
import { EvidenceFunnel } from '@/components/icp/EvidenceFunnel';
import { GalaxyBackground } from '@/components/common/GalaxyBackground';
import { evidenceLevels, techPlatforms, personas } from '@/data/icpData';
import { getQuotes, type ICPQuote } from '@/services/icpService';

// =============================================================================
// Tech Platform Pie Chart - Live data from galaxy_summary
// =============================================================================

const PIE_COLORS = [
  '#5468FF', // Algolia Purple
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

interface GalaxyData {
  galaxy: string;
  tech: string;
  company_count: number;
}

function TechPlatformChart() {
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [platformData, setPlatformData] = useState<{ name: string; count: number; category: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGalaxyData() {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/galaxy_summary?select=*`,
          { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
        );
        if (res.ok) {
          const data: GalaxyData[] = await res.json();
          // Get top techs from commerce and CMS galaxies
          const commerceData = data.filter(g => g.galaxy === 'commerce').map(g => ({ name: g.tech, count: g.company_count, category: 'Commerce' }));
          const cmsData = data.filter(g => g.galaxy === 'cms').map(g => ({ name: g.tech, count: g.company_count, category: 'CMS' }));
          const combined = [...commerceData, ...cmsData].sort((a, b) => b.count - a.count).slice(0, 8);
          setPlatformData(combined);
        }
      } catch (err) {
        console.error('Failed to fetch galaxy data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGalaxyData();
  }, []);

  const total = platformData.reduce((sum, p) => sum + p.count, 0);

  // Calculate pie segments
  const segments: { platform: typeof platformData[0]; startAngle: number; endAngle: number; color: string }[] = [];
  let currentAngle = -90; // Start from top

  platformData.forEach((platform, idx) => {
    const angle = total > 0 ? (platform.count / total) * 360 : 0;
    segments.push({
      platform,
      startAngle: currentAngle,
      endAngle: currentAngle + angle,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    });
    currentAngle += angle;
  });

  if (loading) {
    return (
      <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Text style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 4 }}>Tech Platform Distribution</Text>
        <Text style={{ fontSize: 18, color: '#94a3b8', marginBottom: 24 }}>Live data from Partner Tech Galaxy</Text>
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader color="#5468FF" size="xl" />
        </Box>
      </Box>
    );
  }

  if (segments.length === 0) {
    return (
      <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Text style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 4 }}>Tech Platform Distribution</Text>
        <Text style={{ fontSize: 18, color: '#94a3b8', marginBottom: 24 }}>Live data from Partner Tech Galaxy</Text>
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color: '#64748b' }}>No data available. Run the data import.</Text>
        </Box>
      </Box>
    );
  }

  // SVG arc path helper
  const describeArc = (startAngle: number, endAngle: number, outerRadius: number, innerRadius: number) => {
    const startOuter = polarToCartesian(outerRadius, startAngle);
    const endOuter = polarToCartesian(outerRadius, endAngle);
    const startInner = polarToCartesian(innerRadius, endAngle);
    const endInner = polarToCartesian(innerRadius, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${startInner.x} ${startInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${endInner.x} ${endInner.y}`,
      'Z',
    ].join(' ');
  };

  const polarToCartesian = (radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees * Math.PI) / 180;
    return {
      x: 100 + radius * Math.cos(angleInRadians),
      y: 100 + radius * Math.sin(angleInRadians),
    };
  };

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Text style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 4 }}>Tech Platform Distribution</Text>
      <Text style={{ fontSize: 18, color: '#94a3b8', marginBottom: 24 }}>Live data from Partner Tech Galaxy (CMS + Commerce)</Text>

      <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48 }}>
        {/* Large Interactive Donut Chart */}
        <Box style={{ position: 'relative', width: 320, height: 320, flexShrink: 0 }}>
          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
            {segments.map((seg, idx) => {
              const isHovered = hoveredSegment === idx;
              return (
                <path
                  key={idx}
                  d={describeArc(seg.startAngle, seg.endAngle - 0.5, isHovered ? 98 : 90, isHovered ? 45 : 50)}
                  fill={seg.color}
                  style={{
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    filter: isHovered ? 'brightness(1.2) drop-shadow(0 4px 12px rgba(0,0,0,0.3))' : 'none',
                    opacity: hoveredSegment !== null && !isHovered ? 0.5 : 1,
                  }}
                  onMouseEnter={() => setHoveredSegment(idx)}
                  onMouseLeave={() => setHoveredSegment(null)}
                />
              );
            })}
          </svg>
          {/* Center label - shows hovered segment or total */}
          <Box
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            {hoveredSegment !== null ? (
              <>
                <Text style={{ fontSize: 42, fontWeight: 700, color: segments[hoveredSegment].color, lineHeight: 1 }}>
                  {segments[hoveredSegment].platform.count}
                </Text>
                <Text style={{ fontSize: 16, color: '#94a3b8', marginTop: 4 }}>{segments[hoveredSegment].platform.name}</Text>
                <Text style={{ fontSize: 14, color: '#64748b' }}>{segments[hoveredSegment].platform.category}</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 48, fontWeight: 700, color: 'white', lineHeight: 1 }}>{total}</Text>
                <Text style={{ fontSize: 18, color: '#94a3b8', marginTop: 4 }}>Total</Text>
              </>
            )}
          </Box>
        </Box>

        {/* Interactive Legend */}
        <Stack gap={16} style={{ flex: 1 }}>
          {segments.map((seg, idx) => {
            const isHovered = hoveredSegment === idx;
            return (
              <Box
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isHovered ? `${seg.color}20` : 'transparent',
                  border: isHovered ? `2px solid ${seg.color}` : '2px solid transparent',
                }}
                onMouseEnter={() => setHoveredSegment(idx)}
                onMouseLeave={() => setHoveredSegment(null)}
              >
                <Box style={{ width: 20, height: 20, borderRadius: 6, background: seg.color, flexShrink: 0 }} />
                <Text style={{ fontSize: 18, color: isHovered ? 'white' : '#e2e8f0', fontWeight: isHovered ? 600 : 500, flex: 1 }}>
                  {seg.platform.name}
                </Text>
                <Text style={{ fontSize: 24, fontWeight: 700, color: isHovered ? seg.color : 'white' }}>
                  {seg.platform.count}
                </Text>
                <Text style={{ fontSize: 18, color: '#94a3b8', width: 60, textAlign: 'right' }}>
                  {((seg.platform.count / total) * 100).toFixed(0)}%
                </Text>
              </Box>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}

// =============================================================================
// Full-Width Buyer Personas Gallery - All details visible
// =============================================================================

function PersonaFullCard({ persona }: { persona: typeof personas[0] }) {
  return (
    <Box
      style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        border: `1px solid ${persona.color}40`,
        padding: 24,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with percentage */}
      <Group justify="space-between" mb="md">
        <Group gap="sm">
          <Box
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: persona.color,
            }}
          />
          <Text style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{persona.name}</Text>
        </Group>
        <Text style={{ fontSize: 28, fontWeight: 700, color: persona.color }}>{persona.percentage}%</Text>
      </Group>

      {/* Progress bar */}
      <Box style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, marginBottom: 20 }}>
        <Box
          style={{
            width: `${persona.percentage}%`,
            height: '100%',
            background: persona.color,
            borderRadius: 4,
          }}
        />
      </Box>

      {/* Job Titles */}
      <Text style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Typical Titles</Text>
      <Group gap="xs" mb="lg" wrap="wrap">
        {persona.titles.map((title) => (
          <Badge key={title} size="lg" variant="light" color="gray" style={{ fontSize: 14 }}>
            {title}
          </Badge>
        ))}
      </Group>

      {/* Key Priorities */}
      <Text style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Key Priorities</Text>
      <Group gap="xs" mb="lg" wrap="wrap">
        {persona.themes.map((theme) => (
          <Badge key={theme} size="lg" variant="outline" color="blue" style={{ fontSize: 14 }}>
            {theme}
          </Badge>
        ))}
      </Group>

      {/* Quote - grows to fill space */}
      <Box
        p="lg"
        style={{
          background: `${persona.color}15`,
          borderRadius: 10,
          borderLeft: `4px solid ${persona.color}`,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Group gap="xs" mb="sm">
          <IconQuote size={20} color={persona.color} />
          <Text style={{ fontSize: 16, fontWeight: 600, color: 'white' }}>Customer Voice</Text>
        </Group>
        <Text style={{ fontSize: 18, color: '#cbd5e1', fontStyle: 'italic', marginBottom: 12, flex: 1 }}>
          "{persona.sampleQuote}"
        </Text>
        <Group justify="space-between" align="flex-end">
          <Text style={{ fontSize: 16, color: '#94a3b8' }}>
            — {persona.sampleSpeaker}, {persona.sampleCompany}
          </Text>
          {persona.caseStudyUrl && (
            <a
              href={persona.caseStudyUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: persona.color,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Case Study <IconExternalLink size={16} />
            </a>
          )}
        </Group>
      </Box>
    </Box>
  );
}

function BuyerPersonasGallery() {
  const totalQuotes = evidenceLevels.find(e => e.id === 'quotes')?.count || 379;

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <div>
          <Text style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 4 }}>Buyer Personas</Text>
          <Text style={{ fontSize: 18, color: '#94a3b8' }}>
            Derived from {totalQuotes.toLocaleString()} customer quotes across {personas.length} key segments
          </Text>
        </div>
        <Badge size="xl" variant="light" color="violet" style={{ fontSize: 16, padding: '12px 20px' }}>
          {personas.reduce((sum, p) => sum + p.percentage, 0)}% of decision makers
        </Badge>
      </Group>

      <SimpleGrid cols={2} spacing="xl">
        {personas.map((persona) => (
          <PersonaFullCard key={persona.id} persona={persona} />
        ))}
      </SimpleGrid>
    </Box>
  );
}

// =============================================================================
// Customer Quotes Section - Fetches ALL quotes from database
// =============================================================================

function CustomerQuotesSection() {
  const [quotes, setQuotes] = useState<ICPQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const totalQuotes = evidenceLevels.find(e => e.id === 'quotes')?.count || 379;
  const QUOTES_PER_PAGE = 10;

  useEffect(() => {
    const fetchQuotes = async () => {
      setLoading(true);
      const data = await getQuotes();
      setQuotes(data);
      setLoading(false);
    };
    fetchQuotes();
  }, []);

  const filteredQuotes = quotes.filter(q =>
    q.quote_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.speaker_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredQuotes.length / QUOTES_PER_PAGE);
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * QUOTES_PER_PAGE,
    currentPage * QUOTES_PER_PAGE
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Copy quote to clipboard
  const copyQuoteToClipboard = async (quote: ICPQuote) => {
    const caseStudyUrl = `https://www.algolia.com/customers/${quote.company_name?.toLowerCase().replace(/\s+/g, '-') || 'customer'}`;
    const textToCopy = `"${quote.quote_text}"

— ${quote.speaker_name || 'Customer'}${quote.speaker_title ? `, ${quote.speaker_title}` : ''}
${quote.company_name || 'Company'}

Case Study: ${caseStudyUrl}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(quote.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <div>
          <Text style={{ fontSize: 32, fontWeight: 700, color: 'white', marginBottom: 4 }}>Customer Voices</Text>
          <Text style={{ fontSize: 18, color: '#94a3b8' }}>
            {totalQuotes.toLocaleString()} quotes from customers across industries. Click any quote to copy.
          </Text>
        </div>
        <Group gap="md">
          <TextInput
            placeholder="Search quotes..."
            leftSection={<IconSearch size={18} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            style={{ width: 300 }}
            styles={{
              input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 16 },
            }}
          />
          <a
            href="https://www.algolia.com/customers/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              background: '#003DFF',
              color: 'white',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            View All Case Studies <IconExternalLink size={18} />
          </a>
        </Group>
      </Group>

      {/* Quote count and pagination info */}
      <Group gap="md" mb="md" justify="space-between">
        <Group gap="md">
          <Badge size="lg" variant="light" color="violet" style={{ fontSize: 14 }}>
            Showing {paginatedQuotes.length} of {filteredQuotes.length} quotes (Page {currentPage}/{totalPages || 1})
          </Badge>
          {searchQuery && (
            <Badge size="lg" variant="outline" color="gray" style={{ fontSize: 14, cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
              Clear search ×
            </Badge>
          )}
        </Group>
      </Group>

      {/* Quote Grid with Pagination */}
      {loading ? (
        <Box style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Loader color="#5468FF" size="xl" />
        </Box>
      ) : (
        <>
          <SimpleGrid cols={2} spacing="xl" mb="xl">
            {paginatedQuotes.map((quote) => (
              <Box
                key={quote.id}
                p="xl"
                onClick={() => copyQuoteToClipboard(quote)}
                style={{
                  background: copiedId === quote.id ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                  borderRadius: 12,
                  border: copiedId === quote.id ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  if (copiedId !== quote.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.borderColor = '#5468FF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (copiedId !== quote.id) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }
                }}
              >
                <Group gap="sm" mb="lg" justify="space-between">
                  <Group gap="sm">
                    <IconQuote size={28} color="#5468FF" />
                    <Text style={{ fontSize: 18, fontWeight: 600, color: '#5468FF', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {quote.source || 'Customer Quote'}
                    </Text>
                  </Group>
                  {copiedId === quote.id ? (
                    <Group gap={6}>
                      <IconCheck size={22} color="#10b981" />
                      <Text style={{ fontSize: 18, color: '#10b981', fontWeight: 600 }}>Copied!</Text>
                    </Group>
                  ) : (
                    <IconCopy size={22} color="#64748b" />
                  )}
                </Group>
                <Text style={{ fontSize: 22, color: '#e2e8f0', fontStyle: 'italic', lineHeight: 1.6, marginBottom: 24 }}>
                  "{quote.quote_text}"
                </Text>
                <Group justify="space-between" align="flex-end">
                  <Text style={{ fontSize: 20, fontWeight: 600, color: 'white' }}>
                    {quote.speaker_name || 'Customer'}{quote.speaker_title ? `, ${quote.speaker_title}` : ''}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: 500, color: '#94a3b8' }}>{quote.company_name || 'Company'}</Text>
                </Group>
              </Box>
            ))}
          </SimpleGrid>

          {/* Empty state */}
          {filteredQuotes.length === 0 && (
            <Box style={{ textAlign: 'center', padding: 60 }}>
              <Text style={{ fontSize: 20, color: '#64748b' }}>
                {searchQuery ? 'No quotes match your search' : 'No quotes found'}
              </Text>
            </Box>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <Group justify="center" mt="xl">
              <Pagination
                total={totalPages}
                value={currentPage}
                onChange={setCurrentPage}
                size="lg"
                radius="md"
                styles={{
                  control: {
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: 16,
                    '&[data-active]': {
                      background: '#5468FF',
                      borderColor: '#5468FF',
                    },
                  },
                }}
              />
            </Group>
          )}
        </>
      )}
    </Box>
  );
}

// =============================================================================
// Main Page
// =============================================================================

export function ICPLandingPage() {
  return (
    <GalaxyBackground>
      {/* Content - Full Width */}
      <Box style={{ padding: 32, maxWidth: 1600, margin: '0 auto' }}>
        {/* Header */}
        <Group justify="space-between" mb="xl">
          <Group gap="lg">
            <IconBrandAlgolia size={56} color="#5468FF" />
            <div>
              <Text style={{ fontSize: 42, fontWeight: 700, color: 'white', lineHeight: 1.1 }}>Data-Derived ICP</Text>
              <Text style={{ fontSize: 20, color: '#94a3b8', marginTop: 4 }}>Algolia's Ideal Customer Profile from customer evidence</Text>
            </div>
          </Group>
        </Group>

        {/* Hero - Evidence Funnel with Clickable KPI Cards */}
        <Paper p="xl" mb="xl" className="galaxy-glass-panel">
          <EvidenceFunnel />
        </Paper>

        {/* Industry Analysis + Tech Platform side by side */}
        <SimpleGrid cols={2} spacing="xl" mb="xl" style={{ position: 'relative', zIndex: 10 }}>
          <Paper p="xl" className="galaxy-glass-panel" style={{ overflow: 'visible' }}>
            <ICPButterflyChart />
          </Paper>
          <Paper p="xl" className="galaxy-glass-panel">
            <TechPlatformChart />
          </Paper>
        </SimpleGrid>

        {/* Full-Width Buyer Personas Gallery - 2 columns for bigger cards */}
        <Paper p="xl" mb="xl" className="galaxy-glass-panel" style={{ position: 'relative', zIndex: 1 }}>
          <BuyerPersonasGallery />
        </Paper>

        {/* Customer Quotes Section - All quotes with scrollbar */}
        <Paper p="xl" className="galaxy-glass-panel">
          <CustomerQuotesSection />
        </Paper>
      </Box>
    </GalaxyBackground>
  );
}

export default ICPLandingPage;
