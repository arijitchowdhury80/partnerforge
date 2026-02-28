/**
 * AccountDrillDown - Slide-over Drawer for Distribution Grid Cells
 *
 * Shows actual accounts when a cell in the distribution grid is clicked.
 * Features: search, ICP tier filter, selection checkboxes, export to CSV.
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer,
  Group,
  Stack,
  Text,
  Badge,
  Avatar,
  ActionIcon,
  TextInput,
  Checkbox,
  Button,
  ScrollArea,
  Divider,
  Tooltip,
  Chip,
} from '@mantine/core';
import {
  IconSearch,
  IconX,
  IconDownload,
  IconExternalLink,
  IconFlame,
  IconTrendingUp,
  IconSnowflake,
  IconBriefcase,
  IconChecks,
} from '@tabler/icons-react';
import type { DisplacementTarget } from '@/services/supabase';

// Colors
const ALGOLIA_BLUE = '#003DFF';
const GRAY_50 = '#f8fafc';
const GRAY_100 = '#f1f5f9';
const GRAY_200 = '#e2e8f0';
const GRAY_300 = '#cbd5e1';
const GRAY_400 = '#94a3b8';
const GRAY_500 = '#64748b';
const GRAY_600 = '#475569';
const GRAY_700 = '#334155';
const GRAY_800 = '#1e293b';
const GRAY_900 = '#0f172a';

// ICP Tier configuration
const ICP_TIERS = {
  hot: { color: '#dc2626', bg: '#fef2f2', icon: IconFlame, label: 'HOT' },
  warm: { color: '#ea580c', bg: '#fff7ed', icon: IconTrendingUp, label: 'WARM' },
  cold: { color: '#64748b', bg: '#f8fafc', icon: IconSnowflake, label: 'COLD' },
} as const;

type IcpTier = 'hot' | 'warm' | 'cold' | 'all';

// Get ICP tier from score
function getIcpTier(score: number | null): 'hot' | 'warm' | 'cold' {
  if (!score) return 'cold';
  if (score >= 80) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

// Format traffic numbers
function formatTraffic(visits: number | null): string {
  if (!visits) return '-';
  if (visits >= 1000000) return `${(visits / 1000000).toFixed(1)}M`;
  if (visits >= 1000) return `${(visits / 1000).toFixed(0)}K`;
  return visits.toString();
}

export interface AccountDrillDownProps {
  opened: boolean;
  onClose: () => void;
  title: string;  // e.g., "AEM Targets in Automotive"
  targets: DisplacementTarget[];
  onSelectTarget: (domain: string) => void;
}

export function AccountDrillDown({
  opened,
  onClose,
  title,
  targets,
  onSelectTarget,
}: AccountDrillDownProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTier, setSelectedTier] = useState<IcpTier>('all');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());

  // Filter targets based on search and tier
  const filteredTargets = useMemo(() => {
    let result = targets;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.domain.toLowerCase().includes(query) ||
          (t.company_name?.toLowerCase().includes(query) ?? false)
      );
    }

    // Filter by ICP tier
    if (selectedTier !== 'all') {
      result = result.filter((t) => getIcpTier(t.icp_score) === selectedTier);
    }

    // Sort by ICP score descending
    return result.sort((a, b) => (b.icp_score ?? 0) - (a.icp_score ?? 0));
  }, [targets, searchQuery, selectedTier]);

  // Toggle selection for a domain
  const toggleSelection = useCallback((domain: string) => {
    setSelectedDomains((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(domain)) {
        newSet.delete(domain);
      } else {
        newSet.add(domain);
      }
      return newSet;
    });
  }, []);

  // Select all visible
  const selectAll = useCallback(() => {
    setSelectedDomains(new Set(filteredTargets.map((t) => t.domain)));
  }, [filteredTargets]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedDomains(new Set());
  }, []);

  // Check if all visible are selected
  const allSelected = filteredTargets.length > 0 && filteredTargets.every((t) => selectedDomains.has(t.domain));
  const someSelected = selectedDomains.size > 0;

  // Export to CSV
  const exportToCSV = useCallback(() => {
    const domainsToExport = selectedDomains.size > 0
      ? filteredTargets.filter((t) => selectedDomains.has(t.domain))
      : filteredTargets;

    const headers = ['Domain', 'Company Name', 'ICP Score', 'Tier', 'Partner Tech', 'Search Provider', 'Monthly Traffic', 'Vertical'];
    const rows = domainsToExport.map((t) => [
      t.domain,
      t.company_name || '',
      t.icp_score?.toString() || '',
      t.icp_tier_name || getIcpTier(t.icp_score).toUpperCase(),
      t.partner_tech || '',
      t.current_search || '',
      t.sw_monthly_visits?.toString() || '',
      t.vertical || '',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredTargets, selectedDomains, title]);

  // Handle row click
  const handleRowClick = useCallback((domain: string) => {
    onSelectTarget(domain);
  }, [onSelectTarget]);

  // Tier counts
  const tierCounts = useMemo(() => {
    const counts = { hot: 0, warm: 0, cold: 0 };
    targets.forEach((t) => {
      counts[getIcpTier(t.icp_score)]++;
    });
    return counts;
  }, [targets]);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={480}
      title={null}
      padding={0}
      styles={{
        content: { background: GRAY_50 },
        header: { display: 'none' },
        body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' },
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'white',
          borderBottom: `1px solid ${GRAY_200}`,
          padding: 20,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Group justify="space-between" mb="md">
          <div>
            <Text size="lg" fw={600} c={GRAY_900}>
              {title}
            </Text>
            <Text size="sm" c={GRAY_500}>
              {targets.length.toLocaleString()} {targets.length === 1 ? 'account' : 'accounts'}
            </Text>
          </div>
          <Group gap="xs">
            <Tooltip label="Export to CSV">
              <ActionIcon
                variant="light"
                color="blue"
                size="lg"
                onClick={exportToCSV}
              >
                <IconDownload size={18} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon variant="subtle" color="gray" size="lg" onClick={onClose}>
              <IconX size={18} />
            </ActionIcon>
          </Group>
        </Group>

        {/* Search Input */}
        <TextInput
          placeholder="Search by domain or company name..."
          leftSection={<IconSearch size={16} color={GRAY_400} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          styles={{
            input: {
              background: GRAY_50,
              border: `1px solid ${GRAY_200}`,
              '&:focus': { borderColor: ALGOLIA_BLUE },
            },
          }}
          mb="md"
        />

        {/* ICP Tier Filter Chips */}
        <Chip.Group value={selectedTier} onChange={(v) => setSelectedTier(v as IcpTier)}>
          <Group gap="xs">
            <Chip value="all" variant="outline" size="sm" color="gray">
              All ({targets.length})
            </Chip>
            <Chip value="hot" variant="outline" size="sm" color="red">
              <Group gap={4}>
                <IconFlame size={12} />
                HOT ({tierCounts.hot})
              </Group>
            </Chip>
            <Chip value="warm" variant="outline" size="sm" color="orange">
              <Group gap={4}>
                <IconTrendingUp size={12} />
                WARM ({tierCounts.warm})
              </Group>
            </Chip>
            <Chip value="cold" variant="outline" size="sm" color="gray">
              <Group gap={4}>
                <IconSnowflake size={12} />
                COLD ({tierCounts.cold})
              </Group>
            </Chip>
          </Group>
        </Chip.Group>
      </div>

      {/* Account List */}
      <ScrollArea style={{ flex: 1 }} p="md">
        <AnimatePresence mode="popLayout">
          {filteredTargets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                textAlign: 'center',
                padding: 40,
              }}
            >
              <Text c={GRAY_500} size="sm">
                No accounts match your filters
              </Text>
            </motion.div>
          ) : (
            <Stack gap="xs">
              {filteredTargets.map((target, index) => {
                const tier = getIcpTier(target.icp_score);
                const tierConfig = ICP_TIERS[tier];
                const TierIcon = tierConfig.icon;
                const isSelected = selectedDomains.has(target.domain);

                return (
                  <motion.div
                    key={target.domain}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.02, duration: 0.2 }}
                  >
                    <div
                      style={{
                        background: isSelected ? `${ALGOLIA_BLUE}08` : 'white',
                        border: `1px solid ${isSelected ? ALGOLIA_BLUE : GRAY_200}`,
                        borderRadius: 8,
                        padding: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onClick={() => handleRowClick(target.domain)}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = GRAY_300;
                          e.currentTarget.style.background = GRAY_50;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.borderColor = GRAY_200;
                          e.currentTarget.style.background = 'white';
                        }
                      }}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                          {/* Checkbox */}
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelection(target.domain);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            styles={{
                              input: {
                                cursor: 'pointer',
                              },
                            }}
                          />

                          {/* Avatar */}
                          <Avatar
                            src={`https://logo.clearbit.com/${target.domain}`}
                            size={36}
                            radius="md"
                            style={{
                              border: `1px solid ${GRAY_200}`,
                            }}
                          >
                            {(target.company_name || target.domain).charAt(0).toUpperCase()}
                          </Avatar>

                          {/* Company Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Group gap="xs" wrap="nowrap">
                              <Text
                                size="sm"
                                fw={500}
                                c={GRAY_900}
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {target.company_name || target.domain}
                              </Text>
                              <ActionIcon
                                variant="subtle"
                                size="xs"
                                component="a"
                                href={`https://${target.domain}`}
                                target="_blank"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconExternalLink size={12} color={GRAY_400} />
                              </ActionIcon>
                            </Group>
                            <Group gap="xs">
                              <Text size="xs" c={GRAY_500}>
                                {target.domain}
                              </Text>
                              {target.sw_monthly_visits && (
                                <>
                                  <Text size="xs" c={GRAY_300}>|</Text>
                                  <Text size="xs" c={GRAY_500}>
                                    {formatTraffic(target.sw_monthly_visits)} visits/mo
                                  </Text>
                                </>
                              )}
                            </Group>
                          </div>
                        </Group>

                        {/* Badges */}
                        <Group gap="xs" wrap="nowrap">
                          {/* Search Provider Badge */}
                          {target.current_search && (
                            <Tooltip label={`Current: ${target.current_search}`}>
                              <Badge
                                size="sm"
                                variant="outline"
                                color="red"
                                style={{
                                  maxWidth: 80,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {target.current_search}
                              </Badge>
                            </Tooltip>
                          )}

                          {/* ICP Score Badge */}
                          <Badge
                            size="sm"
                            variant="light"
                            color={tier === 'hot' ? 'red' : tier === 'warm' ? 'orange' : 'gray'}
                            leftSection={<TierIcon size={10} />}
                            style={{
                              minWidth: 50,
                            }}
                          >
                            {target.icp_score ?? 0}
                          </Badge>
                        </Group>
                      </Group>
                    </div>
                  </motion.div>
                );
              })}
            </Stack>
          )}
        </AnimatePresence>
      </ScrollArea>

      {/* Footer Actions */}
      <div
        style={{
          background: 'white',
          borderTop: `1px solid ${GRAY_200}`,
          padding: 16,
          position: 'sticky',
          bottom: 0,
        }}
      >
        <Group justify="space-between">
          <Group gap="xs">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected && !allSelected}
              onChange={() => {
                if (allSelected) {
                  clearSelection();
                } else {
                  selectAll();
                }
              }}
              label={
                <Text size="sm" c={GRAY_600}>
                  Select All
                </Text>
              }
            />
            {someSelected && (
              <Badge variant="light" color="blue">
                {selectedDomains.size} selected
              </Badge>
            )}
          </Group>
          <Tooltip label={!someSelected ? 'Select accounts first' : 'Add selected accounts to campaign'}>
            <Button
              variant="filled"
              color="blue"
              size="sm"
              leftSection={<IconBriefcase size={16} />}
              disabled={!someSelected}
              onClick={() => {
                // TODO: Implement add to campaign
                console.log('Add to campaign:', Array.from(selectedDomains));
              }}
            >
              Add to Campaign
            </Button>
          </Tooltip>
        </Group>
      </div>
    </Drawer>
  );
}
