/**
 * Sidebar Navigation Component
 *
 * Navigation sidebar with v2 5-layer funnel structure.
 * Layers: ICP → Galaxy (L0) → Whale (L2) → Crossbeam (L3) → Hot Targets
 *
 * 3D Glassmorphism design with hover effects and active state persistence
 */

import { useState } from 'react';
import { Stack, Text, Box, Badge, Divider } from '@mantine/core';
import {
  IconUpload,
  IconSettings,
  IconChartBar,
  IconBook,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  badge?: string | number;
  badgeColor?: string;
}

// 5-Layer Funnel Navigation - No icons, no badges
const funnelNavItems: NavItem[] = [
  {
    label: 'ICP Definition',
    path: '/icp',
  },
  {
    label: 'Partner Tech Galaxy',
    path: '/galaxy',
  },
  {
    label: 'Demandbase + ZoomInfo',
    path: '/whale',
  },
  {
    label: 'Crossbeam',
    path: '/crossbeam',
  },
];

// 3D Glassmorphism NavItem Component
function GlassNavItem({ item, isActive, onClick }: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Base glassmorphism style
  const baseStyle: React.CSSProperties = {
    position: 'relative',
    padding: '18px 20px',
    marginBottom: '12px',
    borderRadius: '14px',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
  };

  // Dynamic state-based styles
  const getStateStyle = (): React.CSSProperties => {
    if (isActive) {
      // Active state - constant background
      return {
        background: 'linear-gradient(135deg, rgba(0, 61, 255, 0.15) 0%, rgba(84, 104, 255, 0.25) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(0, 61, 255, 0.4)',
        boxShadow: '0 8px 32px rgba(0, 61, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        transform: 'translateY(0) scale(1)',
      };
    }

    if (isHovered) {
      // Hover state - dynamic background
      return {
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        transform: 'translateY(-2px) scale(1.02)',
      };
    }

    // Default state
    return {
      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      transform: 'translateY(0) scale(1)',
    };
  };

  return (
    <Box
      style={{ ...baseStyle, ...getStateStyle() }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Shine effect on hover */}
      {isHovered && !isActive && (
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
            animation: 'shine 0.6s ease-out',
          }}
        />
      )}

      <Text
        style={{
          fontSize: 18,
          fontWeight: isActive ? 700 : 600,
          color: isActive ? '#003DFF' : '#334155',
          transition: 'color 0.2s ease',
          zIndex: 1,
        }}
      >
        {item.label}
      </Text>

      {item.badge && (
        <Badge
          size="lg"
          variant="filled"
          color={item.badgeColor || 'blue'}
          style={{
            fontSize: 14,
            padding: '8px 14px',
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            zIndex: 1,
          }}
        >
          {item.badge}
        </Badge>
      )}
    </Box>
  );
}

// Simple tool nav item (with icon)
function ToolNavItem({ label, icon: Icon, isActive, onClick }: {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        marginBottom: 8,
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: isActive
          ? 'rgba(0, 61, 255, 0.1)'
          : isHovered
            ? 'rgba(0, 0, 0, 0.04)'
            : 'transparent',
        borderLeft: isActive ? '3px solid #003DFF' : '3px solid transparent',
      }}
    >
      <Icon size={22} color={isActive ? '#003DFF' : '#64748b'} />
      <Text
        style={{
          fontSize: 16,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? '#003DFF' : '#334155',
        }}
      >
        {label}
      </Text>
    </Box>
  );
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Stack h="100%" justify="space-between" p="lg">
      <Box>
        {/* Dashboard - simple link */}
        <ToolNavItem
          label="Dashboard"
          icon={IconChartBar}
          isActive={location.pathname === '/dashboard'}
          onClick={() => navigate('/dashboard')}
        />

        <Divider my="lg" color="gray.2" />

        {/* Funnel Layers - 3D Glassmorphism */}
        <Text
          size="sm"
          fw={700}
          c="#94a3b8"
          tt="uppercase"
          mb="md"
          style={{ letterSpacing: '1px', fontSize: 13 }}
        >
          Pipeline Layers
        </Text>

        <Stack gap={0}>
          {funnelNavItems.map((item) => (
            <GlassNavItem
              key={item.path}
              item={item}
              isActive={location.pathname === item.path}
              onClick={() => navigate(item.path)}
            />
          ))}
        </Stack>

        <Divider my="xl" color="gray.2" />

        {/* Tools */}
        <Text
          size="sm"
          fw={700}
          c="#94a3b8"
          tt="uppercase"
          mb="md"
          style={{ letterSpacing: '1px', fontSize: 13 }}
        >
          Tools
        </Text>
        <ToolNavItem
          label="Upload Lists"
          icon={IconUpload}
          isActive={location.pathname === '/lists'}
          onClick={() => navigate('/lists')}
        />
        <ToolNavItem
          label="Analytics"
          icon={IconChartBar}
          isActive={location.pathname === '/analytics'}
          onClick={() => navigate('/analytics')}
        />

        <Divider my="xl" color="gray.2" />

        {/* Configuration */}
        <Text
          size="sm"
          fw={700}
          c="#94a3b8"
          tt="uppercase"
          mb="md"
          style={{ letterSpacing: '1px', fontSize: 13 }}
        >
          Configuration
        </Text>
        <ToolNavItem
          label="Documentation"
          icon={IconBook}
          isActive={location.pathname === '/docs'}
          onClick={() => navigate('/docs')}
        />
        <ToolNavItem
          label="Settings"
          icon={IconSettings}
          isActive={location.pathname === '/settings'}
          onClick={() => navigate('/settings')}
        />
      </Box>
    </Stack>
  );
}
