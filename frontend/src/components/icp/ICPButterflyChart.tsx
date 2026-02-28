/**
 * ICPButterflyChart - Industry Evidence with HoverCard dropdowns
 * Uses Mantine's HoverCard for consistent hover behavior
 */

import { useState, useEffect } from 'react';
import { Box, Text, Group, Badge, Table, ScrollArea, Loader, HoverCard } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { industries, type IndustryEvidence } from '@/data/icpData';
import { getCompanies, type ICPCompany } from '@/services/icpService';

function getConfidenceScore(industry: IndustryEvidence): number {
  const weights = { proofPoints: 4, stories: 3, quotes: 2, logos: 1 };
  const score = (
    (industry.proofPoints * weights.proofPoints) +
    (industry.stories * weights.stories) +
    (industry.quotes * weights.quotes) +
    (industry.logos * weights.logos * 0.1)
  );
  return Math.min(Math.round((score / 300) * 100), 100);
}

const sortedIndustries = [...industries].sort((a, b) => {
  const totalA = a.logos + a.quotes + a.stories + a.proofPoints;
  const totalB = b.logos + b.quotes + b.stories + b.proofPoints;
  return totalB - totalA;
});

const maxLogos = Math.max(...sortedIndustries.map(i => i.logos));
const maxScore = 100;

const CONFIDENCE_COLORS = { HIGH: '#10b981', MEDIUM: '#f59e0b', LOW: '#64748b' };

function IndustryDropdown({ industry }: { industry: IndustryEvidence }) {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<ICPCompany[]>([]);
  const score = getConfidenceScore(industry);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      const allCompanies = await getCompanies();
      const filtered = allCompanies.filter(c =>
        c.industry_raw?.toLowerCase().includes(industry.industry.toLowerCase().split('/')[0])
      );
      setCompanies(filtered);
      setLoading(false);
    };
    fetchData();
  }, [industry.industry]);

  // LIGHT background with DARK text for readability
  const tableStyles = {
    table: { background: '#ffffff' },
    tr: { borderBottom: '1px solid #e2e8f0', background: '#ffffff' },
    th: { color: '#1e293b', fontSize: 18, fontWeight: 600, background: '#f1f5f9', padding: '14px 16px' },
    td: { color: '#1e293b', fontSize: 18, padding: '16px', background: '#ffffff' },
  };

  return (
    <Box>
      {/* Stats - Light background */}
      <Group gap="xl" mb="md" p="md" style={{ background: '#f1f5f9', borderRadius: 8 }}>
        <Box><Text style={{ fontSize: 28, fontWeight: 700, color: '#5468FF' }}>{industry.logos}</Text><Text style={{ fontSize: 16, color: '#64748b' }}>Logos</Text></Box>
        <Box><Text style={{ fontSize: 28, fontWeight: 700, color: '#8b5cf6' }}>{industry.quotes}</Text><Text style={{ fontSize: 16, color: '#64748b' }}>Quotes</Text></Box>
        <Box><Text style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{industry.stories}</Text><Text style={{ fontSize: 16, color: '#64748b' }}>Stories</Text></Box>
        <Box><Text style={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}>{industry.proofPoints}</Text><Text style={{ fontSize: 16, color: '#64748b' }}>Proof Points</Text></Box>
        <Box><Text style={{ fontSize: 28, fontWeight: 700, color: CONFIDENCE_COLORS[industry.confidence] }}>{score}%</Text><Text style={{ fontSize: 16, color: '#64748b' }}>Strength</Text></Box>
      </Group>

      {loading ? (
        <Box style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader color="#5468FF" size="sm" /></Box>
      ) : (
        <ScrollArea h={180} type="auto" offsetScrollbars>
          <Table styles={tableStyles}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Company</Table.Th>
                <Table.Th>Use Case</Table.Th>
                <Table.Th>Region</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {companies.length > 0 ? companies.slice(0, 15).map((company) => (
                <Table.Tr key={company.id}>
                  <Table.Td style={{ fontWeight: 600 }}>{company.company_name}</Table.Td>
                  <Table.Td>{company.use_case || '-'}</Table.Td>
                  <Table.Td>{company.region || company.country || '-'}</Table.Td>
                </Table.Tr>
              )) : (
                <Table.Tr><Table.Td colSpan={3} style={{ textAlign: 'center', padding: 20, color: '#64748b', background: '#ffffff' }}>No companies found</Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Box>
  );
}

function IndustryRow({ industry }: { industry: IndustryEvidence }) {
  const score = getConfidenceScore(industry);
  const leftWidth = (industry.logos / maxLogos) * 100;
  const rightWidth = (score / maxScore) * 100;

  return (
    <HoverCard width={700} shadow="xl" openDelay={100} closeDelay={200} position="bottom" withinPortal>
      <HoverCard.Target>
        <Box
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 200px 1fr',
            alignItems: 'center',
            marginBottom: 8,
            padding: '12px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Box style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: 'white', minWidth: 50, textAlign: 'right' }}>
              {industry.logos.toLocaleString()}
            </Text>
            <Box style={{ width: `${leftWidth}%`, minWidth: 4, height: 32, background: 'linear-gradient(90deg, #3b82f6 0%, #5468FF 100%)', borderRadius: '4px 0 0 4px' }} />
          </Box>
          <Box style={{ textAlign: 'center', padding: '0 12px' }}>
            <Text style={{ fontSize: 20, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>{industry.industry}</Text>
          </Box>
          <Box style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Box style={{ width: `${rightWidth}%`, minWidth: 4, height: 32, background: `linear-gradient(90deg, ${CONFIDENCE_COLORS[industry.confidence]} 0%, ${CONFIDENCE_COLORS[industry.confidence]}cc 100%)`, borderRadius: '0 4px 4px 0' }} />
            <Text style={{ fontSize: 20, fontWeight: 700, color: CONFIDENCE_COLORS[industry.confidence], minWidth: 50 }}>{score}%</Text>
          </Box>
        </Box>
      </HoverCard.Target>
      <HoverCard.Dropdown style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <Group gap="md" mb="md">
          <Text style={{ fontSize: 22, fontWeight: 600, color: '#1e293b' }}>{industry.industry}</Text>
          <Badge size="lg" color={industry.confidence === 'HIGH' ? 'green' : industry.confidence === 'MEDIUM' ? 'yellow' : 'gray'} style={{ fontSize: 16 }}>{industry.confidence}</Badge>
        </Group>
        <IndustryDropdown industry={industry} />
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

export function ICPButterflyChart() {
  return (
    <Box>
      <Group justify="space-between" mb="md">
        <div>
          <Text style={{ fontSize: 26, fontWeight: 700, color: 'white', marginBottom: 4 }}>Industry Evidence Analysis</Text>
          <Text style={{ fontSize: 18, color: '#94a3b8' }}>Hover to explore companies</Text>
        </div>
        <Group gap="lg">
          <Group gap={8}><Box style={{ width: 16, height: 16, borderRadius: 4, background: '#5468FF' }} /><Text style={{ fontSize: 18, color: '#94a3b8' }}>Logos</Text></Group>
          <Group gap={8}><Box style={{ width: 16, height: 16, borderRadius: 4, background: '#10b981' }} /><Text style={{ fontSize: 18, color: '#94a3b8' }}>Strength</Text></Group>
        </Group>
      </Group>

      <Box style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Text style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>Count</Text>
        <Text style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>Industry</Text>
        <Text style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>Strength</Text>
      </Box>

      {sortedIndustries.map((industry) => (
        <IndustryRow key={industry.industry} industry={industry} />
      ))}
    </Box>
  );
}

export default ICPButterflyChart;
