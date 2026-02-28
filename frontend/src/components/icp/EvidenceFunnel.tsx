/**
 * EvidenceFunnel - KPI Cards with HoverCard dropdowns
 * Uses Mantine's HoverCard for consistent hover behavior
 */

import { useState, useEffect } from 'react';
import { Box, Text, Group, Table, ScrollArea, Badge, Loader, HoverCard } from '@mantine/core';
import { IconUsers, IconQuote, IconFileText, IconTarget, IconExternalLink } from '@tabler/icons-react';
import { evidenceLevels } from '@/data/icpData';
import { getQuotes, getCompanies, type ICPQuote, type ICPCompany } from '@/services/icpService';

interface EvidenceType {
  id: string;
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  color: string;
}

function EvidenceTable({ evidenceType }: { evidenceType: EvidenceType }) {
  const [loading, setLoading] = useState(true);
  const [quotes, setQuotes] = useState<ICPQuote[]>([]);
  const [companies, setCompanies] = useState<ICPCompany[]>([]);

  useEffect(() => {
    setLoading(true);
    const fetchData = async () => {
      if (evidenceType.id === 'quotes') {
        const data = await getQuotes();
        setQuotes(data);
      } else if (evidenceType.id === 'logos') {
        const data = await getCompanies();
        setCompanies(data);
      } else if (evidenceType.id === 'stories') {
        const data = await getCompanies({ evidenceTier: 'GOLD' });
        setCompanies(data.filter(c => c.story_url));
      } else if (evidenceType.id === 'proofpoints') {
        const data = await getCompanies({ evidenceTier: 'GOLD' });
        setCompanies(data);
      }
      setLoading(false);
    };
    fetchData();
  }, [evidenceType.id]);

  if (loading) {
    return (
      <Box style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Loader color={evidenceType.color} size="md" />
      </Box>
    );
  }

  // LIGHT background with DARK text for readability
  const tableStyles = {
    table: { background: '#ffffff' },
    tr: { borderBottom: '1px solid #e2e8f0', background: '#ffffff' },
    th: { color: '#1e293b', fontSize: 18, fontWeight: 600, background: '#f1f5f9', padding: '14px 16px' },
    td: { color: '#1e293b', fontSize: 18, padding: '16px', background: '#ffffff' },
  };

  return (
    <ScrollArea h={280} type="auto" offsetScrollbars>
      {evidenceType.id === 'quotes' ? (
        <Table styles={tableStyles}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '55%' }}>Quote</Table.Th>
              <Table.Th>Speaker</Table.Th>
              <Table.Th>Company</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {quotes.slice(0, 30).map((quote) => (
              <Table.Tr key={quote.id}>
                <Table.Td style={{ fontStyle: 'italic', fontSize: 18, lineHeight: 1.5 }}>"{quote.quote_text}"</Table.Td>
                <Table.Td>
                  <Text style={{ fontWeight: 600, fontSize: 18 }}>{quote.speaker_name || '-'}</Text>
                  <Text style={{ fontSize: 16, color: '#94a3b8' }}>{quote.speaker_title || ''}</Text>
                </Table.Td>
                <Table.Td style={{ fontWeight: 500, fontSize: 18 }}>{quote.company_name || '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Table styles={tableStyles}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Company</Table.Th>
              <Table.Th>Industry</Table.Th>
              <Table.Th>Region</Table.Th>
              {(evidenceType.id === 'stories' || evidenceType.id === 'proofpoints') && (
                <>
                  <Table.Th>Tier</Table.Th>
                  <Table.Th>Story</Table.Th>
                </>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {companies.slice(0, 30).map((company) => (
              <Table.Tr key={company.id}>
                <Table.Td style={{ fontWeight: 600 }}>{company.company_name}</Table.Td>
                <Table.Td>{company.industry_raw || '-'}</Table.Td>
                <Table.Td>{company.region || company.country || '-'}</Table.Td>
                {(evidenceType.id === 'stories' || evidenceType.id === 'proofpoints') && (
                  <>
                    <Table.Td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 12px',
                          borderRadius: 6,
                          background: company.evidence_tier === 'GOLD' ? '#f59e0b' : company.evidence_tier === 'SILVER' ? '#64748b' : '#ea580c',
                          color: 'white',
                          fontWeight: 600,
                          fontSize: 14,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {company.evidence_tier}
                      </span>
                    </Table.Td>
                    <Table.Td>
                      {company.story_url ? (
                        <a href={company.story_url} target="_blank" rel="noopener noreferrer" style={{ color: '#5468FF', display: 'flex', alignItems: 'center', gap: 4 }}>
                          View <IconExternalLink size={14} />
                        </a>
                      ) : '-'}
                    </Table.Td>
                  </>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </ScrollArea>
  );
}

function KPICard({ item }: { item: EvidenceType }) {
  const Icon = item.icon;

  return (
    <HoverCard width={700} shadow="xl" openDelay={100} closeDelay={200} position="bottom" withinPortal>
      <HoverCard.Target>
        <Box
          style={{
            flex: 1,
            minWidth: 120,
            padding: 16,
            background: `linear-gradient(135deg, ${item.color}08 0%, ${item.color}03 100%)`,
            border: `2px solid ${item.color}30`,
            borderRadius: 10,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = item.color;
            e.currentTarget.style.background = `linear-gradient(135deg, ${item.color}15 0%, ${item.color}08 100%)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${item.color}30`;
            e.currentTarget.style.background = `linear-gradient(135deg, ${item.color}08 0%, ${item.color}03 100%)`;
          }}
        >
          <Box p="xs" style={{ background: `${item.color}20`, borderRadius: 8, border: `1px solid ${item.color}40` }}>
            <Icon size={20} color={item.color} />
          </Box>
          <Text style={{ fontSize: 24, fontWeight: 700, color: 'white', lineHeight: 1 }}>
            {item.value.toLocaleString()}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>
            {item.label}
          </Text>
        </Box>
      </HoverCard.Target>
      <HoverCard.Dropdown style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <Group gap="md" mb="md">
          <Icon size={24} color={item.color} />
          <Text style={{ fontSize: 22, fontWeight: 600, color: '#1e293b' }}>{item.label}</Text>
          <Badge size="lg" color="gray" variant="light" style={{ fontSize: 16 }}>{item.value.toLocaleString()} total</Badge>
        </Group>
        <EvidenceTable evidenceType={item} />
      </HoverCard.Dropdown>
    </HoverCard>
  );
}

export function EvidenceFunnel() {
  const getCount = (id: string) => evidenceLevels.find(e => e.id === id)?.count || 0;

  const evidenceTypes: EvidenceType[] = [
    { id: 'logos', label: 'Customer Logos', value: getCount('logos'), icon: IconUsers, color: '#5468FF' },
    { id: 'quotes', label: 'Customer Quotes', value: getCount('quotes'), icon: IconQuote, color: '#8b5cf6' },
    { id: 'stories', label: 'Case Studies', value: getCount('stories'), icon: IconFileText, color: '#f59e0b' },
    { id: 'proofpoints', label: 'Proof Points', value: getCount('proofpoints'), icon: IconTarget, color: '#10b981' },
  ];

  return (
    <Box>
      <Text style={{ fontSize: 20, fontWeight: 600, color: 'white', marginBottom: 4 }}>
        Customer Evidence Summary
      </Text>
      <Text style={{ fontSize: 14, color: '#94a3b8', marginBottom: 16 }}>
        Hover over any card to explore the data
      </Text>
      <Group grow gap="md">
        {evidenceTypes.map((item) => (
          <KPICard key={item.id} item={item} />
        ))}
      </Group>
    </Box>
  );
}

export default EvidenceFunnel;
