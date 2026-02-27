/**
 * Intelligence Accordions for Company Drawer
 *
 * Deep-dive expandable sections for:
 * - Traffic: Demographics, sources, countries, devices
 * - Financials: 3-year revenue, margins, ROI projections
 * - Tech Stack: All technologies categorized
 * - Signals: Hiring, exec quotes, investor intel
 * - Strategic: Case studies, displacement angles
 */

import {
  Accordion,
  Group,
  Stack,
  Text,
  Badge,
  Progress,
  Paper,
  SimpleGrid,
  ThemeIcon,
  Anchor,
  RingProgress,
  Divider,
  List,
  Box,
  Tooltip,
} from '@mantine/core';
import {
  IconWorld,
  IconCurrencyDollar,
  IconCode,
  IconBell,
  IconTarget,
  IconTrendingUp,
  IconTrendingDown,
  IconUsers,
  IconDeviceDesktop,
  IconDeviceMobile,
  IconMapPin,
  IconBriefcase,
  IconQuote,
  IconFileAnalytics,
  IconChartBar,
  IconBuildingSkyscraper,
  IconAlertTriangle,
  IconCheck,
  IconSearch,
  IconShoppingCart,
  IconCloud,
  IconChartPie,
} from '@tabler/icons-react';
import type {
  TrafficData,
  FinancialData,
  TechStackData,
  HiringData,
  ExecutiveData,
  InvestorData,
  CompetitorData,
  CaseStudyMatch,
} from '@/types';
import { COLORS } from '@/lib/constants';

// =============================================================================
// Color Constants - Use shared COLORS from @/lib/constants
// =============================================================================

const ALGOLIA_BLUE = COLORS.ALGOLIA_NEBULA_BLUE;
const TEXT_DARK = COLORS.GRAY_900;
const TEXT_MUTED = COLORS.GRAY_500;
const BG_WHITE = COLORS.ALGOLIA_WHITE;
const BG_ALT = COLORS.GRAY_50;

// =============================================================================
// Traffic Accordion
// =============================================================================

interface TrafficAccordionProps {
  data?: TrafficData;
  monthlyVisits?: number;
}

export function TrafficAccordion({ data, monthlyVisits }: TrafficAccordionProps) {
  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If no detailed data, show what we have
  if (!data) {
    return (
      <Accordion.Item value="traffic">
        <Accordion.Control icon={<IconWorld size={20} color={ALGOLIA_BLUE} />}>
          <Group justify="space-between" style={{ flex: 1 }}>
            <Text fw={600} c={TEXT_DARK}>Traffic Intelligence</Text>
            <Badge variant="filled" color="blue" size="lg">
              {monthlyVisits ? formatNumber(monthlyVisits) : 'N/A'} visits/mo
            </Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Paper p="md" bg={BG_ALT} radius="md">
            <Text c={TEXT_MUTED} ta="center">
              Enrich this company to see detailed traffic analytics including demographics,
              traffic sources, top countries, and device breakdown.
            </Text>
          </Paper>
        </Accordion.Panel>
      </Accordion.Item>
    );
  }

  const trendColor = data.monthly_visits_trend >= 0 ? 'green' : 'red';
  const TrendIcon = data.monthly_visits_trend >= 0 ? IconTrendingUp : IconTrendingDown;

  return (
    <Accordion.Item value="traffic">
      <Accordion.Control icon={<IconWorld size={20} color={ALGOLIA_BLUE} />}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={600} c={TEXT_DARK}>Traffic Intelligence</Text>
          <Group gap="xs">
            <Badge variant="filled" color="blue" size="lg">
              {formatNumber(data.monthly_visits)} visits/mo
            </Badge>
            <Badge variant="light" color={trendColor} leftSection={<TrendIcon size={12} />}>
              {data.monthly_visits_trend >= 0 ? '+' : ''}{data.monthly_visits_trend.toFixed(1)}%
            </Badge>
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          {/* Engagement Metrics */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Engagement Metrics</Text>
            <SimpleGrid cols={3}>
              <MetricBox
                label="Bounce Rate"
                value={`${data.bounce_rate.toFixed(1)}%`}
                color={data.bounce_rate < 40 ? 'green' : data.bounce_rate < 60 ? 'yellow' : 'red'}
              />
              <MetricBox
                label="Pages/Visit"
                value={data.pages_per_visit.toFixed(1)}
                color={data.pages_per_visit > 3 ? 'green' : 'yellow'}
              />
              <MetricBox
                label="Avg Duration"
                value={formatDuration(data.avg_visit_duration)}
                color={data.avg_visit_duration > 120 ? 'green' : 'yellow'}
              />
            </SimpleGrid>
          </Paper>

          {/* Traffic Sources */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Traffic Sources</Text>
            <Stack gap="xs">
              {data.traffic_sources.map((source) => (
                <Group key={source.source} justify="space-between">
                  <Group gap="xs">
                    <SourceIcon source={source.source} />
                    <Text size="sm" c={TEXT_DARK} tt="capitalize">{source.source}</Text>
                  </Group>
                  <Group gap="xs">
                    <Progress
                      value={source.percentage}
                      size="lg"
                      w={100}
                      radius="xl"
                      color={getSourceColor(source.source)}
                    />
                    <Text size="sm" fw={600} w={45} ta="right">{source.percentage.toFixed(1)}%</Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Paper>

          {/* Top Countries */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Top Countries</Text>
            <SimpleGrid cols={2}>
              {data.top_countries.slice(0, 6).map((country) => (
                <Group key={country.country_code} justify="space-between">
                  <Group gap="xs">
                    <Text size="lg">{getFlagEmoji(country.country_code)}</Text>
                    <Text size="sm" c={TEXT_DARK}>{country.country}</Text>
                  </Group>
                  <Badge variant="light" color="gray">{country.percentage.toFixed(1)}%</Badge>
                </Group>
              ))}
            </SimpleGrid>
          </Paper>

          {/* Device Distribution */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Device Distribution</Text>
            <Group justify="center" gap="xl">
              <DeviceRing
                icon={IconDeviceDesktop}
                label="Desktop"
                value={data.device_distribution.desktop}
                color="blue"
              />
              <DeviceRing
                icon={IconDeviceMobile}
                label="Mobile"
                value={data.device_distribution.mobile}
                color="green"
              />
              <DeviceRing
                icon={IconDeviceMobile}
                label="Tablet"
                value={data.device_distribution.tablet}
                color="orange"
              />
            </Group>
          </Paper>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// =============================================================================
// Financials Accordion
// =============================================================================

interface FinancialsAccordionProps {
  data?: FinancialData;
  revenue?: number;
  ticker?: string;
  isPublic?: boolean;
}

export function FinancialsAccordion({ data, revenue, ticker, isPublic }: FinancialsAccordionProps) {
  const formatCurrency = (n: number) => {
    if (n >= 1000000000) return `$${(n / 1000000000).toFixed(1)}B`;
    if (n >= 1000000) return `$${(n / 1000000).toFixed(0)}M`;
    return `$${n.toLocaleString()}`;
  };

  if (!data) {
    return (
      <Accordion.Item value="financials">
        <Accordion.Control icon={<IconCurrencyDollar size={20} color={ALGOLIA_BLUE} />}>
          <Group justify="space-between" style={{ flex: 1 }}>
            <Text fw={600} c={TEXT_DARK}>Financial Intelligence</Text>
            <Group gap="xs">
              {revenue && <Badge variant="filled" color="green" size="lg">{formatCurrency(revenue)}</Badge>}
              {isPublic && ticker && <Badge variant="light" color="violet">{ticker}</Badge>}
            </Group>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Paper p="md" bg={BG_ALT} radius="md">
            <Text c={TEXT_MUTED} ta="center">
              {isPublic
                ? 'Enrich to see 3-year revenue trends, margins, and ROI projections from SEC filings.'
                : 'Private company - limited financial data available. Revenue estimates from market intelligence.'}
            </Text>
          </Paper>
        </Accordion.Panel>
      </Accordion.Item>
    );
  }

  const latestRevenue = data.revenue[data.revenue.length - 1];
  const marginColor = data.margin_zone === 'green' ? 'green' : data.margin_zone === 'yellow' ? 'yellow' : 'red';

  return (
    <Accordion.Item value="financials">
      <Accordion.Control icon={<IconCurrencyDollar size={20} color={ALGOLIA_BLUE} />}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={600} c={TEXT_DARK}>Financial Intelligence</Text>
          <Group gap="xs">
            <Badge variant="filled" color="green" size="lg">
              {formatCurrency(latestRevenue.value)} rev
            </Badge>
            {data.ticker && <Badge variant="light" color="violet">{data.ticker}</Badge>}
            <Badge variant="light" color={marginColor}>
              {data.margin_zone.toUpperCase()} margin
            </Badge>
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          {/* 3-Year Revenue Trend */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">3-Year Revenue Trend</Text>
            <Stack gap="xs">
              {data.revenue.map((year, idx) => (
                <Group key={year.year} justify="space-between">
                  <Text size="sm" c={TEXT_DARK} fw={500}>{year.year}</Text>
                  <Group gap="xs">
                    <Progress
                      value={(year.value / Math.max(...data.revenue.map(r => r.value))) * 100}
                      size="lg"
                      w={150}
                      radius="xl"
                      color="green"
                    />
                    <Text size="sm" fw={600} w={80} ta="right">{formatCurrency(year.value)}</Text>
                    {year.yoy_change !== undefined && (
                      <Badge
                        size="sm"
                        variant="light"
                        color={year.yoy_change >= 0 ? 'green' : 'red'}
                      >
                        {year.yoy_change >= 0 ? '+' : ''}{year.yoy_change.toFixed(1)}%
                      </Badge>
                    )}
                  </Group>
                </Group>
              ))}
            </Stack>
          </Paper>

          {/* Profitability */}
          {data.net_income && data.net_income.length > 0 && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Profitability</Text>
              <SimpleGrid cols={2}>
                <MetricBox
                  label="Net Income"
                  value={formatCurrency(data.net_income[data.net_income.length - 1].value)}
                  color={data.net_income[data.net_income.length - 1].value > 0 ? 'green' : 'red'}
                />
                {data.ebitda_margin && (
                  <MetricBox
                    label="EBITDA Margin"
                    value={`${data.ebitda_margin.toFixed(1)}%`}
                    color={marginColor}
                  />
                )}
              </SimpleGrid>
            </Paper>
          )}

          {/* Market Data */}
          {(data.stock_price || data.market_cap) && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Market Data</Text>
              <SimpleGrid cols={2}>
                {data.stock_price && (
                  <MetricBox label="Stock Price" value={`$${data.stock_price.toFixed(2)}`} color="blue" />
                )}
                {data.market_cap && (
                  <MetricBox label="Market Cap" value={formatCurrency(data.market_cap)} color="violet" />
                )}
              </SimpleGrid>
            </Paper>
          )}

          {/* ROI Projections */}
          {data.roi_estimate && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Algolia ROI Projections</Text>
              <Text size="xs" c={TEXT_MUTED} mb="md">
                Based on {formatCurrency(data.roi_estimate.addressable_revenue)} addressable e-commerce revenue
              </Text>
              <SimpleGrid cols={3}>
                <Paper p="sm" bg={BG_ALT} radius="md" ta="center">
                  <Text size="xs" c={TEXT_MUTED}>Conservative</Text>
                  <Text size="lg" fw={700} c="green">{formatCurrency(data.roi_estimate.conservative)}</Text>
                </Paper>
                <Paper p="sm" bg={BG_ALT} radius="md" ta="center">
                  <Text size="xs" c={TEXT_MUTED}>Moderate</Text>
                  <Text size="lg" fw={700} c="blue">{formatCurrency(data.roi_estimate.moderate)}</Text>
                </Paper>
                <Paper p="sm" bg={BG_ALT} radius="md" ta="center">
                  <Text size="xs" c={TEXT_MUTED}>Aggressive</Text>
                  <Text size="lg" fw={700} c="violet">{formatCurrency(data.roi_estimate.aggressive)}</Text>
                </Paper>
              </SimpleGrid>
            </Paper>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// =============================================================================
// Tech Stack Accordion
// =============================================================================

interface TechStackAccordionProps {
  data?: TechStackData;
  partnerTech?: string[];
  currentSearch?: string;
}

export function TechStackAccordion({ data, partnerTech, currentSearch }: TechStackAccordionProps) {
  if (!data) {
    return (
      <Accordion.Item value="techstack">
        <Accordion.Control icon={<IconCode size={20} color={ALGOLIA_BLUE} />}>
          <Group justify="space-between" style={{ flex: 1 }}>
            <Text fw={600} c={TEXT_DARK}>Tech Stack</Text>
            <Group gap="xs">
              {partnerTech && partnerTech.length > 0 && (
                <Badge variant="filled" color="green">{partnerTech[0]}</Badge>
              )}
              {currentSearch && (
                <Badge variant="filled" color="red">{currentSearch}</Badge>
              )}
            </Group>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            {partnerTech && partnerTech.length > 0 && (
              <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
                <Text fw={600} size="sm" c={TEXT_DARK} mb="sm">Partner Technologies</Text>
                <Group gap="xs">
                  {partnerTech.map((tech) => (
                    <Badge key={tech} size="lg" variant="light" color="green">{tech}</Badge>
                  ))}
                </Group>
              </Paper>
            )}
            {currentSearch && (
              <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
                <Text fw={600} size="sm" c={TEXT_DARK} mb="sm">Current Search Provider</Text>
                <Group gap="xs">
                  <Badge size="lg" variant="filled" color="red">{currentSearch}</Badge>
                  <Text size="xs" c={TEXT_MUTED}>Displacement opportunity</Text>
                </Group>
              </Paper>
            )}
            <Paper p="md" bg={BG_ALT} radius="md">
              <Text c={TEXT_MUTED} ta="center">
                Enrich to see full technology stack from BuiltWith including CMS, e-commerce platform, analytics, CDN, and more.
              </Text>
            </Paper>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    );
  }

  // Group technologies by category
  const techByCategory: Record<string, typeof data.technologies> = {};
  data.technologies.forEach((tech) => {
    if (!techByCategory[tech.category]) {
      techByCategory[tech.category] = [];
    }
    techByCategory[tech.category].push(tech);
  });

  return (
    <Accordion.Item value="techstack">
      <Accordion.Control icon={<IconCode size={20} color={ALGOLIA_BLUE} />}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={600} c={TEXT_DARK}>Tech Stack</Text>
          <Group gap="xs">
            <Badge variant="light" color="gray">{data.technologies.length} technologies</Badge>
            {data.search_provider && (
              <Badge variant="filled" color="red">{data.search_provider}</Badge>
            )}
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          {/* Key Technologies */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Key Technologies</Text>
            <SimpleGrid cols={2}>
              {data.cms && <TechItem icon={IconFileAnalytics} label="CMS" value={data.cms} />}
              {data.ecommerce_platform && <TechItem icon={IconShoppingCart} label="E-Commerce" value={data.ecommerce_platform} />}
              {data.search_provider && <TechItem icon={IconSearch} label="Search" value={data.search_provider} color="red" />}
              {data.cdn && <TechItem icon={IconCloud} label="CDN" value={data.cdn} />}
            </SimpleGrid>
          </Paper>

          {/* Partner Tech */}
          {data.partner_tech_detected.length > 0 && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="sm">Partner Technologies Detected</Text>
              <Group gap="xs">
                {data.partner_tech_detected.map((tech) => (
                  <Badge key={tech} size="lg" variant="light" color="green">{tech}</Badge>
                ))}
              </Group>
            </Paper>
          )}

          {/* Analytics */}
          {data.analytics && data.analytics.length > 0 && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="sm">Analytics & Tracking</Text>
              <Group gap="xs">
                {data.analytics.map((tool) => (
                  <Badge key={tool} variant="outline" color="blue">{tool}</Badge>
                ))}
                {data.tag_managers?.map((tm) => (
                  <Badge key={tm} variant="outline" color="violet">{tm}</Badge>
                ))}
              </Group>
            </Paper>
          )}

          {/* Full Tech Stack by Category */}
          <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
            <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Full Technology Stack</Text>
            <Accordion variant="contained">
              {Object.entries(techByCategory).map(([category, techs]) => (
                <Accordion.Item key={category} value={category}>
                  <Accordion.Control>
                    <Group justify="space-between">
                      <Text size="sm">{category}</Text>
                      <Badge size="sm" variant="light">{techs.length}</Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Group gap="xs">
                      {techs.map((tech) => (
                        <Badge key={tech.name} variant="outline" color="gray">{tech.name}</Badge>
                      ))}
                    </Group>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Paper>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// =============================================================================
// Signals Accordion (Hiring, Exec Quotes, Investor Intel)
// =============================================================================

interface SignalsAccordionProps {
  hiring?: HiringData;
  executive?: ExecutiveData;
  investor?: InvestorData;
  // Fallback fields from basic enrichment
  execQuote?: string;
  execName?: string;
  execTitle?: string;
}

export function SignalsAccordion({ hiring, executive, investor, execQuote, execName, execTitle }: SignalsAccordionProps) {
  const hasData = hiring || executive || investor || execQuote;

  if (!hasData) {
    return (
      <Accordion.Item value="signals">
        <Accordion.Control icon={<IconBell size={20} color={ALGOLIA_BLUE} />}>
          <Group justify="space-between" style={{ flex: 1 }}>
            <Text fw={600} c={TEXT_DARK}>Buying Signals</Text>
            <Badge variant="light" color="gray">No signals yet</Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Paper p="md" bg={BG_ALT} radius="md">
            <Text c={TEXT_MUTED} ta="center">
              Enrich to discover buying signals including hiring activity, executive quotes from earnings calls,
              and investor intelligence from SEC filings.
            </Text>
          </Paper>
        </Accordion.Panel>
      </Accordion.Item>
    );
  }

  const signalCount = (hiring ? 1 : 0) + (executive?.quotes?.length || (execQuote ? 1 : 0)) + (investor?.risk_factors?.length || 0);

  return (
    <Accordion.Item value="signals">
      <Accordion.Control icon={<IconBell size={20} color={ALGOLIA_BLUE} />}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={600} c={TEXT_DARK}>Buying Signals</Text>
          <Group gap="xs">
            <Badge variant="filled" color="orange">{signalCount} signals</Badge>
            {hiring && hiring.signal_strength !== 'none' && (
              <Badge variant="light" color="green">Hiring</Badge>
            )}
          </Group>
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          {/* Hiring Signals */}
          {hiring && hiring.signal_strength !== 'none' && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <Group gap="xs">
                  <ThemeIcon size="lg" variant="light" color="green">
                    <IconBriefcase size={18} />
                  </ThemeIcon>
                  <Text fw={600} size="sm" c={TEXT_DARK}>Hiring Activity</Text>
                </Group>
                <Badge color={hiring.signal_strength === 'strong' ? 'green' : hiring.signal_strength === 'moderate' ? 'yellow' : 'gray'}>
                  {hiring.signal_strength.toUpperCase()} signal
                </Badge>
              </Group>
              <SimpleGrid cols={3} mb="md">
                <MetricBox label="Total Openings" value={hiring.total_openings.toString()} color="blue" />
                <MetricBox label="VP/Director" value={(hiring.tier_breakdown.tier_1_vp + hiring.tier_breakdown.tier_2_director).toString()} color="violet" />
                <MetricBox label="IC Roles" value={hiring.tier_breakdown.tier_3_ic.toString()} color="gray" />
              </SimpleGrid>
              {hiring.relevant_jobs.length > 0 && (
                <>
                  <Text size="xs" fw={600} c={TEXT_MUTED} mb="xs">Relevant Openings</Text>
                  <Stack gap="xs">
                    {hiring.relevant_jobs.slice(0, 5).map((job, idx) => (
                      <Group key={idx} justify="space-between">
                        <Anchor href={job.url} target="_blank" size="sm" c={ALGOLIA_BLUE}>
                          {job.title}
                        </Anchor>
                        <Badge size="xs" variant="light">Tier {job.tier}</Badge>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          )}

          {/* Executive Quotes */}
          {(executive?.quotes?.length || execQuote) && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Group gap="xs" mb="md">
                <ThemeIcon size="lg" variant="light" color="violet">
                  <IconQuote size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm" c={TEXT_DARK}>In Their Own Words</Text>
              </Group>
              <Stack gap="md">
                {executive?.quotes ? (
                  executive.quotes.slice(0, 3).map((quote, idx) => (
                    <Paper key={idx} p="sm" bg={BG_ALT} radius="md">
                      <Text size="sm" c={TEXT_DARK} fs="italic" mb="xs">"{quote.quote}"</Text>
                      <Group justify="space-between">
                        <Text size="xs" c={TEXT_MUTED}>— {quote.speaker}, {quote.title}</Text>
                        <Badge size="xs" variant="light" color="blue">{quote.maps_to_algolia}</Badge>
                      </Group>
                    </Paper>
                  ))
                ) : execQuote && (
                  <Paper p="sm" bg={BG_ALT} radius="md">
                    <Text size="sm" c={TEXT_DARK} fs="italic" mb="xs">"{execQuote}"</Text>
                    <Text size="xs" c={TEXT_MUTED}>— {execName}, {execTitle}</Text>
                  </Paper>
                )}
              </Stack>
            </Paper>
          )}

          {/* Investor Intelligence */}
          {investor && (investor.risk_factors?.length || investor.earnings_highlights?.length) && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Group gap="xs" mb="md">
                <ThemeIcon size="lg" variant="light" color="orange">
                  <IconFileAnalytics size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm" c={TEXT_DARK}>Investor Intelligence</Text>
              </Group>

              {investor.risk_factors && investor.risk_factors.length > 0 && (
                <>
                  <Text size="xs" fw={600} c={TEXT_MUTED} mb="xs">Risk Factors (Algolia-Relevant)</Text>
                  <Stack gap="xs" mb="md">
                    {investor.risk_factors.filter(rf => rf.relevance_to_algolia !== 'low').slice(0, 3).map((rf, idx) => (
                      <Group key={idx} gap="xs">
                        <IconAlertTriangle size={14} color={rf.relevance_to_algolia === 'high' ? '#dc2626' : '#ea580c'} />
                        <Text size="sm" c={TEXT_DARK}>{rf.description}</Text>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}

              {investor.earnings_highlights && investor.earnings_highlights.length > 0 && (
                <>
                  <Text size="xs" fw={600} c={TEXT_MUTED} mb="xs">Recent Earnings Highlights</Text>
                  <Stack gap="xs">
                    {investor.earnings_highlights.slice(0, 2).map((eh, idx) => (
                      <Paper key={idx} p="sm" bg={BG_ALT} radius="md">
                        <Text size="xs" fw={600} c={TEXT_DARK} mb="xs">{eh.quarter}</Text>
                        <List size="xs" c={TEXT_MUTED}>
                          {eh.key_points.slice(0, 3).map((point, pidx) => (
                            <List.Item key={pidx}>{point}</List.Item>
                          ))}
                        </List>
                      </Paper>
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// =============================================================================
// Strategic Accordion (Competitors, Case Studies, Displacement)
// =============================================================================

interface StrategicAccordionProps {
  competitors?: CompetitorData;
  caseStudies?: CaseStudyMatch[];
  displacementAngle?: string;
}

export function StrategicAccordion({ competitors, caseStudies, displacementAngle }: StrategicAccordionProps) {
  const hasData = competitors || caseStudies || displacementAngle;

  if (!hasData) {
    return (
      <Accordion.Item value="strategic">
        <Accordion.Control icon={<IconTarget size={20} color={ALGOLIA_BLUE} />}>
          <Group justify="space-between" style={{ flex: 1 }}>
            <Text fw={600} c={TEXT_DARK}>Strategic Intelligence</Text>
            <Badge variant="light" color="gray">Not enriched</Badge>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Paper p="md" bg={BG_ALT} radius="md">
            <Text c={TEXT_MUTED} ta="center">
              Enrich to see competitive landscape, matched case studies, and displacement strategy recommendations.
            </Text>
          </Paper>
        </Accordion.Panel>
      </Accordion.Item>
    );
  }

  return (
    <Accordion.Item value="strategic">
      <Accordion.Control icon={<IconTarget size={20} color={ALGOLIA_BLUE} />}>
        <Group justify="space-between" style={{ flex: 1 }}>
          <Text fw={600} c={TEXT_DARK}>Strategic Intelligence</Text>
          {competitors && (
            <Badge variant="light" color="blue">{competitors.competitors.length} competitors analyzed</Badge>
          )}
        </Group>
      </Accordion.Control>
      <Accordion.Panel>
        <Stack gap="md">
          {/* Displacement Angle */}
          {displacementAngle && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Group gap="xs" mb="sm">
                <ThemeIcon size="lg" variant="light" color="red">
                  <IconTarget size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm" c={TEXT_DARK}>Displacement Strategy</Text>
              </Group>
              <Text size="sm" c={TEXT_DARK}>{displacementAngle}</Text>
            </Paper>
          )}

          {/* Competitive Landscape */}
          {competitors && competitors.competitors.length > 0 && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Competitive Landscape</Text>
              <Stack gap="xs">
                {competitors.competitors.slice(0, 5).map((comp, idx) => (
                  <Group key={idx} justify="space-between">
                    <Group gap="xs">
                      <Text size="sm" c={TEXT_DARK}>{comp.company_name}</Text>
                      <Text size="xs" c={TEXT_MUTED}>({comp.domain})</Text>
                    </Group>
                    <Group gap="xs">
                      <Badge size="xs" variant="light">{(comp.similarity_score * 100).toFixed(0)}% similar</Badge>
                      {comp.using_algolia ? (
                        <Badge size="xs" variant="filled" color="green">Uses Algolia</Badge>
                      ) : comp.search_provider && (
                        <Badge size="xs" variant="outline" color="gray">{comp.search_provider}</Badge>
                      )}
                    </Group>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Case Studies */}
          {caseStudies && caseStudies.length > 0 && (
            <Paper p="md" bg={BG_WHITE} radius="md" withBorder>
              <Text fw={600} size="sm" c={TEXT_DARK} mb="md">Matched Case Studies</Text>
              <Stack gap="sm">
                {caseStudies.slice(0, 3).map((cs, idx) => (
                  <Paper key={idx} p="sm" bg={BG_ALT} radius="md">
                    <Group justify="space-between" mb="xs">
                      <Text size="sm" fw={600} c={TEXT_DARK}>{cs.company_name}</Text>
                      <Badge size="xs" color="blue">{cs.industry}</Badge>
                    </Group>
                    <Text size="xs" c={TEXT_MUTED} mb="xs">{cs.use_case}</Text>
                    <Group gap="xs">
                      {cs.key_metrics.slice(0, 2).map((metric, midx) => (
                        <Badge key={midx} size="xs" variant="light" color="green">{metric}</Badge>
                      ))}
                    </Group>
                    <Anchor href={cs.url} target="_blank" size="xs" c={ALGOLIA_BLUE} mt="xs">
                      View case study →
                    </Anchor>
                  </Paper>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  );
}

// =============================================================================
// Helper Components
// =============================================================================

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Paper p="sm" bg={BG_ALT} radius="md" ta="center">
      <Text size="xs" c={TEXT_MUTED}>{label}</Text>
      <Text size="lg" fw={700} c={color === 'green' ? '#16a34a' : color === 'red' ? '#dc2626' : color === 'yellow' ? '#ca8a04' : color === 'blue' ? ALGOLIA_BLUE : color === 'violet' ? '#7c3aed' : TEXT_DARK}>
        {value}
      </Text>
    </Paper>
  );
}

function SourceIcon({ source }: { source: string }) {
  const iconProps = { size: 16, color: TEXT_MUTED };
  switch (source) {
    case 'search': return <IconSearch {...iconProps} />;
    case 'direct': return <IconWorld {...iconProps} />;
    case 'social': return <IconUsers {...iconProps} />;
    case 'referral': return <IconWorld {...iconProps} />;
    case 'mail': return <IconWorld {...iconProps} />;
    case 'paid': return <IconCurrencyDollar {...iconProps} />;
    default: return <IconWorld {...iconProps} />;
  }
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'search': return 'blue';
    case 'direct': return 'green';
    case 'social': return 'pink';
    case 'referral': return 'orange';
    case 'mail': return 'violet';
    case 'paid': return 'red';
    default: return 'gray';
  }
}

function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function DeviceRing({ icon: Icon, label, value, color }: { icon: typeof IconDeviceDesktop; label: string; value: number; color: string }) {
  return (
    <Stack align="center" gap="xs">
      <RingProgress
        size={80}
        thickness={8}
        roundCaps
        sections={[{ value, color }]}
        label={
          <ThemeIcon size={32} variant="light" color={color} radius="xl">
            <Icon size={18} />
          </ThemeIcon>
        }
      />
      <Text size="sm" c={TEXT_DARK}>{label}</Text>
      <Text size="lg" fw={700} c={color === 'blue' ? ALGOLIA_BLUE : color === 'green' ? '#16a34a' : '#ea580c'}>
        {value.toFixed(0)}%
      </Text>
    </Stack>
  );
}

function TechItem({ icon: Icon, label, value, color = 'blue' }: { icon: typeof IconCode; label: string; value: string; color?: string }) {
  return (
    <Group gap="sm">
      <ThemeIcon size="md" variant="light" color={color}>
        <Icon size={14} />
      </ThemeIcon>
      <div>
        <Text size="xs" c={TEXT_MUTED}>{label}</Text>
        <Text size="sm" fw={600} c={TEXT_DARK}>{value}</Text>
      </div>
    </Group>
  );
}
