/**
 * KPICards Component
 *
 * Animated KPI cards with glassmorphism design.
 * Uses Framer Motion for count-up animations and hover effects.
 */

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { Text, Group, Tooltip, Paper } from '@mantine/core';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconMinus,
  IconBuilding,
  IconTargetArrow,
  IconFlame,
  IconSun,
  IconDatabase,
  IconSparkles,
} from '@tabler/icons-react';
import type { KPICardData, DashboardStats } from '@/types';

interface KPICardsProps {
  stats: DashboardStats | undefined;
  isLoading?: boolean;
}

export function KPICards({ stats, isLoading }: KPICardsProps) {
  const cards: KPICardData[] = [
    {
      title: 'Total Companies',
      value: stats?.total_companies || 0,
      icon: <IconBuilding size={24} />,
      gradient: 'primary',
      format: 'number',
    },
    {
      title: 'Enriched',
      value: stats?.enriched_companies || 0,
      previousValue: stats?.total_companies,
      trend: stats?.enriched_companies && stats?.total_companies
        ? (stats.enriched_companies / stats.total_companies >= 0.5 ? 'up' : 'down')
        : 'neutral',
      trendValue: stats?.total_companies
        ? Math.round((stats.enriched_companies || 0) / stats.total_companies * 100)
        : 0,
      icon: <IconDatabase size={24} />,
      gradient: 'success',
      format: 'number',
      suffix: stats?.total_companies ? ` / ${stats.total_companies}` : '',
    },
    {
      title: 'Hot Leads',
      value: stats?.hot_leads || 0,
      trend: 'up',
      trendValue: 12,
      icon: <IconFlame size={24} />,
      gradient: 'danger',
      format: 'number',
    },
    {
      title: 'Warm Leads',
      value: stats?.warm_leads || 0,
      trend: 'up',
      trendValue: 8,
      icon: <IconSun size={24} />,
      gradient: 'warning',
      format: 'number',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <KPICard key={card.title} card={card} index={index} isLoading={isLoading} />
      ))}
    </div>
  );
}

interface KPICardProps {
  card: KPICardData;
  index: number;
  isLoading?: boolean;
}

function KPICard({ card, index, isLoading }: KPICardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  // Animated counter
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => {
    if (card.format === 'currency') {
      return `$${Math.round(latest).toLocaleString()}`;
    }
    if (card.format === 'percentage') {
      return `${Math.round(latest)}%`;
    }
    return Math.round(latest).toLocaleString();
  });

  useEffect(() => {
    if (isInView && !isLoading) {
      const animation = animate(count, card.value, {
        duration: 1.5,
        ease: 'easeOut',
      });
      return animation.stop;
    }
  }, [isInView, card.value, isLoading]);

  // Gradient configurations
  const gradients: Record<string, { bg: string; text: string; glow: string }> = {
    primary: {
      bg: 'from-blue-600/20 to-purple-600/20',
      text: 'from-blue-400 to-purple-400',
      glow: 'rgba(84, 104, 255, 0.3)',
    },
    success: {
      bg: 'from-green-600/20 to-emerald-600/20',
      text: 'from-green-400 to-emerald-400',
      glow: 'rgba(34, 197, 94, 0.3)',
    },
    danger: {
      bg: 'from-red-600/20 to-orange-600/20',
      text: 'from-red-400 to-orange-400',
      glow: 'rgba(239, 68, 68, 0.3)',
    },
    warning: {
      bg: 'from-orange-600/20 to-yellow-600/20',
      text: 'from-orange-400 to-yellow-400',
      glow: 'rgba(249, 115, 22, 0.3)',
    },
  };

  const gradient = gradients[card.gradient || 'primary'];

  // Get trend icon
  const getTrendIcon = () => {
    switch (card.trend) {
      case 'up':
        return <IconTrendingUp size={14} className="text-green-400" />;
      case 'down':
        return <IconTrendingDown size={14} className="text-red-400" />;
      default:
        return <IconMinus size={14} className="text-gray-400" />;
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="group relative"
    >
      <Paper
        p="lg"
        radius="lg"
        className={`
          relative overflow-hidden backdrop-blur-xl
          bg-gradient-to-br ${gradient.bg}
          border border-white/10
          transition-all duration-300
          hover:border-white/20
        `}
        style={{
          boxShadow: `0 8px 32px rgba(0, 0, 0, 0.2)`,
        }}
      >
        {/* Animated glow effect on hover */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${gradient.glow}, transparent 70%)`,
          }}
        />

        {/* Animated border */}
        <motion.div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100"
          style={{
            background: `linear-gradient(90deg, transparent, ${gradient.glow}, transparent)`,
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <Text
                size="xs"
                tt="uppercase"
                fw={600}
                c="dimmed"
                className="tracking-wider"
              >
                {card.title}
              </Text>
            </div>
            <div
              className={`
                p-2.5 rounded-xl
                bg-gradient-to-br ${gradient.bg}
                border border-white/10
              `}
            >
              <div className={`bg-gradient-to-br ${gradient.text} bg-clip-text`}>
                {card.icon}
              </div>
            </div>
          </div>

          {/* Animated value */}
          <div className="flex items-baseline gap-2">
            {isLoading ? (
              <div className="h-10 w-24 bg-white/10 rounded animate-pulse" />
            ) : (
              <>
                <motion.span
                  className={`
                    text-3xl font-bold
                    bg-gradient-to-r ${gradient.text}
                    bg-clip-text text-transparent
                  `}
                >
                  {card.prefix}
                  {rounded as unknown as React.ReactNode}
                  {card.suffix}
                </motion.span>
              </>
            )}
          </div>

          {/* Trend indicator */}
          {card.trend && card.trendValue !== undefined && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.5 + index * 0.1 }}
              className="mt-3 flex items-center gap-2"
            >
              <div
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                  ${card.trend === 'up'
                    ? 'bg-green-500/20 text-green-400'
                    : card.trend === 'down'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-500/20 text-gray-400'
                  }
                `}
              >
                {getTrendIcon()}
                {card.trendValue}%
              </div>
              <Text size="xs" c="dimmed">
                vs last month
              </Text>
            </motion.div>
          )}
        </div>

        {/* Decorative sparkle */}
        <motion.div
          className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <IconSparkles size={16} className="text-white/30" />
        </motion.div>
      </Paper>
    </motion.div>
  );
}

// Export individual card for custom layouts
export { KPICard };

// Hero KPI Card - larger variant for key metrics
interface HeroKPICardProps {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}

export function HeroKPICard({ title, value, subtitle, icon }: HeroKPICardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    if (isInView) {
      const animation = animate(count, value, {
        duration: 2,
        ease: 'easeOut',
      });
      return animation.stop;
    }
  }, [isInView, value]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.5 }}
    >
      <Paper
        p="xl"
        radius="xl"
        className="
          relative overflow-hidden backdrop-blur-xl
          bg-gradient-to-br from-blue-600/10 to-purple-600/10
          border border-white/10
        "
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.1) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative z-10 flex items-center gap-6">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10">
            {icon}
          </div>

          <div>
            <Text size="sm" c="dimmed" tt="uppercase" fw={600} className="tracking-wider">
              {title}
            </Text>
            <motion.div className="text-5xl font-bold text-white mt-1">
              {rounded}
            </motion.div>
            <Text size="sm" c="dimmed" mt="xs">
              {subtitle}
            </Text>
          </div>
        </div>
      </Paper>
    </motion.div>
  );
}
