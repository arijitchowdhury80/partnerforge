/**
 * Partner Selector Component
 *
 * Horizontal tabs/pills to select partner technology.
 * Shows in the header for easy switching between partners.
 */

import { Group, UnstyledButton, Text, Badge, Tooltip, Box } from '@mantine/core';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { usePartner, PARTNERS, Partner } from '@/contexts/PartnerContext';

interface PartnerPillProps {
  partner: Partner;
  isSelected: boolean;
  onClick: () => void;
}

function PartnerPill({ partner, isSelected, onClick }: PartnerPillProps) {
  return (
    <Tooltip label={partner.name} position="bottom">
      <UnstyledButton
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          background: isSelected
            ? `var(--mantine-color-${partner.color}-filled)`
            : 'rgba(255, 255, 255, 0.05)',
          border: isSelected
            ? 'none'
            : '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
        }}
        className={isSelected ? '' : 'hover:bg-white/10'}
      >
        <Text size="sm" c={isSelected ? 'white' : 'dimmed'}>
          {partner.icon}
        </Text>
        <Text
          size="xs"
          fw={isSelected ? 600 : 400}
          c={isSelected ? 'white' : 'dimmed'}
        >
          {partner.shortName}
        </Text>
        {partner.count !== undefined && (
          <Badge
            size="xs"
            variant={isSelected ? 'white' : 'light'}
            color={isSelected ? 'white' : partner.color}
            style={{ marginLeft: '2px' }}
          >
            {partner.count.toLocaleString()}
          </Badge>
        )}
      </UnstyledButton>
    </Tooltip>
  );
}

export function PartnerSelector() {
  const { selectedPartner, setSelectedPartner, partners } = usePartner();

  // Show only first 6 partners, plus "All"
  const visiblePartners = partners.slice(0, 7);

  return (
    <Box
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '24px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <Text size="xs" c="dimmed" fw={500} mr="xs">
        Partner:
      </Text>
      <Group gap={6}>
        {visiblePartners.map((partner) => (
          <PartnerPill
            key={partner.key}
            partner={partner}
            isSelected={selectedPartner.key === partner.key}
            onClick={() => setSelectedPartner(partner)}
          />
        ))}
      </Group>
    </Box>
  );
}

// Compact version for mobile/smaller screens
export function PartnerSelectorCompact() {
  const { selectedPartner, setSelectedPartner, partners } = usePartner();

  return (
    <Group gap={4}>
      {partners.slice(0, 5).map((partner) => (
        <Tooltip key={partner.key} label={partner.name}>
          <UnstyledButton
            onClick={() => setSelectedPartner(partner)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: selectedPartner.key === partner.key
                ? `var(--mantine-color-${partner.color}-filled)`
                : 'rgba(255, 255, 255, 0.05)',
              border: selectedPartner.key === partner.key
                ? 'none'
                : '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.2s ease',
            }}
          >
            <Text size="sm">{partner.icon}</Text>
          </UnstyledButton>
        </Tooltip>
      ))}
    </Group>
  );
}
