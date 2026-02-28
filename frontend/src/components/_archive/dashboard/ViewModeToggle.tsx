/**
 * ViewModeToggle Component
 *
 * Premium segmented control for switching between data views.
 * Light theme design with Algolia purple accent.
 */

import { UnstyledButton, Text, Group, Box } from '@mantine/core';
import {
  IconBuilding,
  IconPackage,
  IconCategory,
  IconUsers,
} from '@tabler/icons-react';

export type ViewMode = 'partner' | 'product' | 'vertical' | 'account';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

interface ViewModeOption {
  value: ViewMode;
  label: string;
  icon: React.ComponentType<{ size: number; stroke?: number }>;
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { value: 'partner', label: 'Partner', icon: IconBuilding },
  { value: 'product', label: 'Product', icon: IconPackage },
  { value: 'vertical', label: 'Vertical', icon: IconCategory },
  { value: 'account', label: 'Account', icon: IconUsers },
];

const ALGOLIA_PURPLE = '#5468FF';
const TEXT_DARK = '#1e293b';
const TEXT_MUTED = '#64748b';
const BG_LIGHT = '#f1f5f9';
const BORDER_COLOR = '#e2e8f0';

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <Group gap="sm" align="center">
      <Text size="sm" fw={600} style={{ color: TEXT_MUTED }}>
        View by:
      </Text>
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          borderRadius: '12px',
          backgroundColor: BG_LIGHT,
          border: `1px solid ${BORDER_COLOR}`,
        }}
      >
        {VIEW_MODE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = value === option.value;

          return (
            <UnstyledButton
              key={option.value}
              onClick={() => onChange(option.value)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                backgroundColor: isActive ? ALGOLIA_PURPLE : 'transparent',
                color: isActive ? '#ffffff' : TEXT_DARK,
                boxShadow: isActive ? '0 2px 8px rgba(84, 104, 255, 0.3)' : 'none',
              }}
            >
              <Icon size={18} stroke={isActive ? 2 : 1.5} />
              <Text
                size="sm"
                fw={isActive ? 600 : 500}
                style={{
                  color: 'inherit',
                }}
              >
                {option.label}
              </Text>
            </UnstyledButton>
          );
        })}
      </Box>
    </Group>
  );
}
