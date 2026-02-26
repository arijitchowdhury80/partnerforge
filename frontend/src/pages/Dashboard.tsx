/**
 * Dashboard Page - Algolia Brand
 *
 * Clean, professional design matching Algolia's brand aesthetic.
 * Light theme with Algolia Blue (#003DFF) accents.
 */

import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Container,
  Text,
  Group,
  Paper,
  Badge,
  Loader,
  Button,
  ThemeIcon,
  Select,
  Box,
  Notification,
} from '@mantine/core';
import {
  IconMinus,
  IconEqual,
  IconTarget,
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
  IconCheck,
  IconX,
  IconRefresh,
} from '@tabler/icons-react';

// Note: getCompanies removed - now using allTargetsData for full client-side filtering
import { enrichCompany, type EnrichmentProgress } from '@/services/enrichment';
import { getTargets, type DisplacementTarget } from '@/services/supabase';
import { TargetList } from '@/components/targets/TargetList';
import { ViewModeToggle, DistributionGrid, AccountDrillDown, type ViewMode } from '@/components/dashboard';
import { usePartner, getSelectionTechName } from '@/contexts/PartnerContext';
import { AlgoliaLogo } from '@/components/common/AlgoliaLogo';
import { getPartnerLogo } from '@/components/common/PartnerLogos';
import type { Company } from '@/types';
import { COLORS } from '@/lib/constants';

// Column filter type for TargetList
interface ColumnFilter {
  column: string;
  values: string[];
}

export function Dashboard() {
  const { selectedPartner, selection, selectPartner, selectProduct, partners } = usePartner();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

  // Enrichment state
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentProgress | null>(null);

  // Check if a specific partner is selected (not "All Partners")
  const hasPartnerSelected = selection.partner.key !== 'all';

  // Get proper tech name for filtering (moved up so queries can use it)
  const partnerTechName = getSelectionTechName(selection);

  // View mode for distribution grid (Partner/Product/Vertical/Account)
  const [viewMode, setViewMode] = useState<ViewMode>('product');

  // Drill-down state for when a cell is clicked
  const [drillDown, setDrillDown] = useState<{
    opened: boolean;
    title: string;
    targets: DisplacementTarget[];
  }>({
    opened: false,
    title: '',
    targets: [],
  });

  // PERFORMANCE: All targets for distribution grid - only fetch when partner selected
  const { data: allTargetsData, isLoading: targetsLoading } = useQuery({
    queryKey: ['allTargets', partnerTechName],
    queryFn: async () => {
      const result = await getTargets({
        limit: 5000,
        partner: partnerTechName,
      });
      return result.targets;
    },
    enabled: hasPartnerSelected, // Only fetch when a specific partner is selected
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // NOTE: Removed uniquePartners query - use static PARTNERS list for empty state
  // This avoids an unnecessary network request on initial load

  // Handle column filter changes from TargetList
  const handleColumnFilterChange = (column: string, values: string[]) => {
    setColumnFilters(prev => {
      const existing = prev.filter(f => f.column !== column);
      if (values.length > 0) {
        return [...existing, { column, values }];
      }
      return existing;
    });
    // Reset to page 1 when filters change
    setPage(1);
  };

  // Calculate stats from filtered allTargetsData (not global stats)
  const filteredStats = useMemo(() => {
    if (!allTargetsData) return { total: 0, hot: 0, warm: 0, cold: 0 };
    let hot = 0, warm = 0, cold = 0;
    allTargetsData.forEach(t => {
      const score = t.icp_score || 0;
      if (score >= 80) hot++;
      else if (score >= 40) warm++;
      else cold++;
    });
    return { total: allTargetsData.length, hot, warm, cold };
  }, [allTargetsData]);

  const { total, hot: hotCount, warm: warmCount, cold: coldCount } = filteredStats;

  // Convert DisplacementTarget to Company format for TargetList
  const allCompaniesFromTargets = useMemo((): Company[] => {
    if (!allTargetsData) return [];
    return allTargetsData.map(t => {
      const icpScore = t.icp_score || 0;

      // Parse JSON fields for full enrichment data
      let competitorData = undefined;
      let caseStudies = undefined;
      let techStackData = undefined;

      try {
        if (t.competitors_json) {
          const competitors = JSON.parse(t.competitors_json);
          competitorData = {
            domain: t.domain,
            competitors: competitors,
          };
        }
      } catch { /* ignore parse errors */ }

      try {
        if (t.case_studies_json) {
          caseStudies = JSON.parse(t.case_studies_json);
        }
      } catch { /* ignore parse errors */ }

      try {
        if (t.tech_stack_json) {
          const techStack = JSON.parse(t.tech_stack_json);
          techStackData = {
            domain: t.domain,
            technologies: Object.entries(techStack).flatMap(([category, techs]) =>
              Array.isArray(techs) ? techs.map((name: string) => ({ name, category })) : []
            ),
            partner_tech_detected: techStack.cms?.filter((c: string) =>
              ['amplience', 'adobe', 'spryker', 'bloomreach'].some(p => c.toLowerCase().includes(p))
            ) || [],
            search_provider: t.current_search || undefined,
            cms: t.cms || techStack.cms?.[0],
            ecommerce_platform: t.ecommerce_platform || techStack.ecommerce?.[0],
            cdn: t.cdn || techStack.cdn?.[0],
          };
        }
      } catch { /* ignore parse errors */ }

      return {
        domain: t.domain,
        company_name: t.company_name || t.domain,
        ticker: t.ticker || undefined,
        is_public: t.is_public || false,
        headquarters: {
          city: '',
          state: '',
          country: t.country || '',
        },
        industry: t.vertical || '', // Use vertical as industry
        vertical: t.vertical || '',
        icp_score: icpScore,
        signal_score: icpScore, // Default to ICP score
        priority_score: icpScore, // Default to ICP score
        status: icpScore >= 80 ? 'hot' : icpScore >= 40 ? 'warm' : 'cold',
        partner_tech: t.partner_tech ? [t.partner_tech] : [],
        last_enriched: t.last_enriched || undefined,
        sw_monthly_visits: t.sw_monthly_visits || undefined,
        revenue: t.revenue || undefined,
        current_search: t.current_search || undefined,
        enrichment_level: t.enrichment_level || undefined,
        // Full enrichment data for drawer
        competitor_data: competitorData,
        case_studies: caseStudies,
        tech_stack_data: techStackData,
        exec_quote: t.exec_quote || undefined,
        exec_name: t.exec_name || undefined,
        exec_title: t.exec_title || undefined,
        displacement_angle: t.displacement_angle || undefined,
      };
    });
  }, [allTargetsData]);

  // Apply client-side filtering based on column filters - ON ALL DATA
  const filteredCompanies = useMemo(() => {
    if (!allCompaniesFromTargets.length) return [];

    let filtered = allCompaniesFromTargets;

    // Apply column filters
    if (columnFilters.length > 0) {
      filtered = filtered.filter(company => {
        return columnFilters.every(filter => {
          if (filter.values.length === 0) return true;

          if (filter.column === 'status') {
            return filter.values.includes(company.status);
          }
          if (filter.column === 'vertical') {
            return filter.values.includes(company.vertical || '');
          }
          if (filter.column === 'partner_tech') {
            // Match if any of the company's techs are in the filter
            return company.partner_tech?.some(tech => filter.values.includes(tech)) || false;
          }
          return true;
        });
      });
    }

    return filtered;
  }, [allCompaniesFromTargets, columnFilters]);

  // Client-side pagination
  const PAGE_SIZE = 50;
  const paginatedCompanies = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCompanies.slice(start, start + PAGE_SIZE);
  }, [filteredCompanies, page]);

  const clientPagination = useMemo(() => ({
    page,
    limit: PAGE_SIZE,
    total: filteredCompanies.length,
    total_pages: Math.ceil(filteredCompanies.length / PAGE_SIZE),
  }), [filteredCompanies.length, page]);

  // Handle grid cell click - opens drill-down drawer
  const handleGridCellClick = (rowKey: string, colKey: string, targets: DisplacementTarget[]) => {
    const title = viewMode === 'vertical'
      ? `${rowKey} - ${colKey}`
      : `${rowKey} in ${colKey}`;
    setDrillDown({
      opened: true,
      title,
      targets,
    });
  };

  // Handle target selection from drill-down
  const handleSelectTarget = (domain: string) => {
    // Navigate to target detail page
    window.location.href = `/company/${domain}`;
  };

  // Close drill-down drawer
  const closeDrillDown = () => {
    setDrillDown(prev => ({ ...prev, opened: false }));
  };

  // Handle company enrichment - THIS IS THE CALLBACK FOR "Enrich Now" BUTTON
  const handleEnrichCompany = useCallback(async (domain: string) => {
    console.log(`[Dashboard] Starting enrichment for ${domain}`);

    try {
      const result = await enrichCompany(domain, (progress) => {
        setEnrichmentStatus(progress);
      });

      if (result.success) {
        // Invalidate queries to refresh the data
        queryClient.invalidateQueries({ queryKey: ['allTargets'] });
        queryClient.invalidateQueries({ queryKey: ['companies'] });

        // Show success for 3 seconds then clear
        setTimeout(() => setEnrichmentStatus(null), 3000);
      } else {
        // Show error for 5 seconds then clear
        setTimeout(() => setEnrichmentStatus(null), 5000);
      }
    } catch (err) {
      setEnrichmentStatus({
        domain,
        status: 'error',
        message: `Enrichment failed: ${err}`,
      });
      setTimeout(() => setEnrichmentStatus(null), 5000);
    }
  }, [queryClient]);

  return (
    <div style={{ background: COLORS.GRAY_50, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Sticky Header Section */}
      <div style={{ flexShrink: 0, background: COLORS.GRAY_50, paddingTop: 24, paddingBottom: 0 }}>
        <Container size="xl">
        {/* Enrichment Status Notification */}
        {enrichmentStatus && (
          <Notification
            icon={
              enrichmentStatus.status === 'complete' ? <IconCheck size={18} /> :
              enrichmentStatus.status === 'error' ? <IconX size={18} /> :
              <IconRefresh size={18} className="animate-spin" />
            }
            color={
              enrichmentStatus.status === 'complete' ? 'green' :
              enrichmentStatus.status === 'error' ? 'red' :
              'blue'
            }
            title={`Enriching ${enrichmentStatus.domain}`}
            onClose={() => setEnrichmentStatus(null)}
            mb="lg"
            style={{
              position: 'fixed',
              top: 80,
              right: 20,
              zIndex: 1000,
              width: 350,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            {enrichmentStatus.message}
          </Notification>
        )}

        {/* Header with Partner Selection */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Paper
            p="lg"
            radius="lg"
            mb="xl"
            style={{
              background: 'white',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: `1px solid ${COLORS.GRAY_200}`,
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
              <div>
                <Text size="sm" c={COLORS.GRAY_500} fw={500} tt="uppercase" mb={4}>
                  Partner Intelligence
                </Text>
                <Text size="xl" fw={700} c={COLORS.GRAY_900}>
                  Displacement Targets
                </Text>
                <Text size="sm" c={COLORS.GRAY_500} mt={4}>
                  Select a partner to see their tech stack targets minus Algolia customers
                </Text>
              </div>

              {/* Partner Selection Only - Products shown in Distribution Grid below */}
              <Select
                label="Partner"
                placeholder="Select partner..."
                value={selection.partner.key === 'all' ? null : selection.partner.key}
                onChange={(value) => {
                  if (value) {
                    const partner = partners.find(p => p.key === value);
                    if (partner) selectPartner(partner);
                  } else {
                    // Clear selection
                    selectPartner(partners[0]); // All Partners
                  }
                }}
                data={partners.filter(p => p.key !== 'all').map(p => ({
                  value: p.key,
                  label: p.name,
                }))}
                w={220}
                size="md"
                clearable
                styles={{
                  input: {
                    backgroundColor: '#ffffff',
                    borderColor: COLORS.GRAY_200,
                    color: COLORS.GRAY_900,
                    fontSize: '14px',
                  },
                  label: {
                    color: COLORS.GRAY_700,
                    fontWeight: 600,
                    marginBottom: 4,
                  },
                  dropdown: {
                    backgroundColor: '#ffffff',
                    borderColor: COLORS.GRAY_200,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  },
                  option: {
                    color: COLORS.GRAY_900,
                    fontSize: '14px',
                    padding: '10px 14px',
                    '&[data-selected]': {
                      backgroundColor: COLORS.ALGOLIA_NEBULA_BLUE,
                      color: '#ffffff',
                    },
                    '&[data-hovered]': {
                      backgroundColor: COLORS.GRAY_100,
                      color: COLORS.GRAY_900,
                    },
                  },
                }}
              />
            </Group>

            {/* Formula Display - only show when partner selected */}
            {hasPartnerSelected && (
              <Box mt="lg" pt="lg" style={{ borderTop: `1px solid ${COLORS.GRAY_200}` }}>
                <FormulaDisplay partnerName={selectedPartner.name} partnerKey={selectedPartner.key} />
              </Box>
            )}
          </Paper>
        </motion.div>
        </Container>
      </div>

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 24 }}>
        <Container size="xl">

        {/* Empty State - when no partner selected */}
        {!hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Paper
              p="xl"
              radius="lg"
              mb="xl"
              style={{
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: `1px solid ${COLORS.GRAY_200}`,
                textAlign: 'center',
              }}
            >
              <ThemeIcon size={64} radius="xl" variant="light" color="blue" mx="auto" mb="lg">
                <IconTarget size={32} />
              </ThemeIcon>
              <Text size="xl" fw={600} c={COLORS.GRAY_900} mb="xs">
                Select a Partner to Get Started
              </Text>
              <Text size="md" c={COLORS.GRAY_500} mb="lg" maw={500} mx="auto">
                Choose a partner from the dropdown above to see displacement targets.
                We'll show you companies using their tech stack who aren't using Algolia yet.
              </Text>
              <Group justify="center" gap="md" wrap="wrap">
                {/* Use static partners list - no network request needed */}
                {partners.filter(p => p.key !== 'all').map(partner => {
                  const Logo = getPartnerLogo(partner.key);
                  return (
                    <Button
                      key={partner.key}
                      variant="light"
                      leftSection={<Logo size={18} />}
                      onClick={() => selectPartner(partner)}
                      size="md"
                    >
                      {partner.name}
                    </Button>
                  );
                })}
              </Group>
            </Paper>
          </motion.div>
        )}

        {/* Distribution Section - Multi-Dimensional Grid (only when partner selected) */}
        {hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Paper
              p="lg"
              radius="lg"
              mb="xl"
              style={{
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: `1px solid ${COLORS.GRAY_200}`,
              }}
            >
              <Group justify="space-between" mb="lg">
                <Group gap="lg">
                  <div>
                    <Text fw={600} c={COLORS.GRAY_900} size="lg">Target Distribution</Text>
                    <Text size="sm" c={COLORS.GRAY_500}>
                      {viewMode === 'partner' && 'By partner and vertical'}
                      {viewMode === 'product' && 'By product and vertical'}
                      {viewMode === 'vertical' && 'By vertical and ICP tier'}
                      {viewMode === 'account' && 'All accounts'}
                    </Text>
                  </div>
                  {/* Compact stats badges */}
                  <Group gap="xs">
                    <Badge size="lg" variant="filled" color="blue" styles={{ root: { fontWeight: 700 } }}>
                      {total.toLocaleString()} Total
                    </Badge>
                    <Badge size="md" variant="filled" color="red" leftSection={<IconFlame size={12} />} styles={{ root: { fontWeight: 600 } }}>
                      {hotCount} Hot
                    </Badge>
                    <Badge size="md" variant="filled" color="orange" leftSection={<IconTrendingUp size={12} />} styles={{ root: { fontWeight: 600 } }}>
                      {warmCount} Warm
                    </Badge>
                    <Badge size="md" variant="filled" color="gray" leftSection={<IconSnowflake size={12} />} styles={{ root: { fontWeight: 600 } }}>
                      {coldCount} Cold
                    </Badge>
                  </Group>
                </Group>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </Group>

              {allTargetsData ? (
                <DistributionGrid
                  viewMode={viewMode}
                  targets={allTargetsData}
                  onCellClick={handleGridCellClick}
                  selectedPartner={selection.partner}
                  onEnrichCompany={handleEnrichCompany}
                />
              ) : (
                <div className="flex justify-center py-8">
                  <Loader color={COLORS.ALGOLIA_NEBULA_BLUE} size="sm" />
                </div>
              )}
            </Paper>
          </motion.div>
        )}

        {/* Account Drill-Down Drawer */}
        <AccountDrillDown
          opened={drillDown.opened}
          onClose={closeDrillDown}
          title={drillDown.title}
          targets={drillDown.targets}
          onSelectTarget={handleSelectTarget}
        />

        {/* Targets Table (only when partner selected) */}
        {hasPartnerSelected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Paper
              p="lg"
              radius="lg"
              style={{
                background: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: `1px solid ${COLORS.GRAY_200}`,
              }}
            >
              <Group justify="space-between" mb="lg">
                <div>
                  <Text fw={600} c={COLORS.GRAY_900} size="lg">All Targets</Text>
                  <Text size="sm" c={COLORS.GRAY_500}>Click Status column to filter by Hot/Warm/Cold</Text>
                </div>
              </Group>

              <TargetList
                companies={paginatedCompanies}
                allCompanies={allCompaniesFromTargets}
                isLoading={targetsLoading}
                pagination={clientPagination}
                onPageChange={setPage}
                columnFilters={columnFilters}
                onColumnFilterChange={handleColumnFilterChange}
                onEnrichCompany={handleEnrichCompany}
              />
            </Paper>
          </motion.div>
        )}
        </Container>
      </div>
    </div>
  );
}

// Formula Display - compact
interface FormulaDisplayProps {
  partnerName: string;
  partnerKey: string;
}

function FormulaDisplay({ partnerName, partnerKey }: FormulaDisplayProps) {
  const PartnerLogo = getPartnerLogo(partnerKey);

  return (
    <Group gap="sm" style={{ background: COLORS.GRAY_100, padding: '8px 16px', borderRadius: 8 }}>
      <Group gap={6}>
        <PartnerLogo size={20} />
        <Text size="sm" fw={500} c={COLORS.GRAY_700}>{partnerName}</Text>
      </Group>
      <IconMinus size={14} style={{ color: COLORS.GRAY_500 }} />
      <Group gap={6}>
        <AlgoliaLogo size={20} />
        <Text size="sm" fw={500} c={COLORS.GRAY_700}>Algolia Customers</Text>
      </Group>
      <IconEqual size={14} style={{ color: COLORS.GRAY_500 }} />
      <Badge color="blue" variant="filled" size="sm" styles={{ root: { color: '#fff' } }}>TARGETS</Badge>
    </Group>
  );
}

export default Dashboard;
