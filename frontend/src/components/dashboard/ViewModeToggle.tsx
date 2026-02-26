/**
 * ViewModeToggle Component
 *
 * Premium segmented control for switching between data views.
 * Uses glassmorphism design with Algolia purple accent.
 */

import { UnstyledButton, Text, Group, Box } from '@mantine/core';
import {
  IconBuilding,
  IconPackage,
  IconCategory,
  IconUsers,
} from '@tabler/icons-react';
import { motion } from 'framer-motion';

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

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <Group gap="sm" align="center">
      <Text size="sm" c="dimmed" fw={500}>
        View by:
      </Text>
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '4px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
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
                padding: '8px 14px',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.6)',
              }}
              className={!isActive ? 'hover:bg-white/5' : undefined}
            >
              {/* Active background with glow */}
              {isActive && (
                <motion.div
                  layoutId="viewModeActiveBackground"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '8px',
                    background: `linear-gradient(135deg, ${ALGOLIA_PURPLE}, rgba(84, 104, 255, 0.8))`,
                    boxShadow: `0 4px 20px rgba(84, 104, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`,
                  }}
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}

              {/* Content */}
              <Group gap={6} style={{ position: 'relative', zIndex: 1 }}>
                <Icon size={16} stroke={isActive ? 2 : 1.5} />
                <Text
                  size="sm"
                  fw={isActive ? 600 : 500}
                  style={{
                    color: 'inherit',
                    letterSpacing: isActive ? '0.01em' : undefined,
                  }}
                >
                  {option.label}
                </Text>
              </Group>
            </UnstyledButton>
          );
        })}
      </Box>
    </Group>
  );
}
