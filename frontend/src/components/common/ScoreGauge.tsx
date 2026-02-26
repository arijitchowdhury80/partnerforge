/**
 * ScoreGauge Component
 *
 * Animated circular progress gauge for ICP/Signal scores.
 * Features glow effects and smooth animations.
 */

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate, useInView } from 'framer-motion';
import { Tooltip, Text } from '@mantine/core';

interface ScoreGaugeProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

const sizeConfig = {
  sm: { width: 40, strokeWidth: 3, fontSize: 'text-xs', radius: 15 },
  md: { width: 48, strokeWidth: 4, fontSize: 'text-sm', radius: 18 },
  lg: { width: 64, strokeWidth: 5, fontSize: 'text-base', radius: 24 },
  xl: { width: 96, strokeWidth: 6, fontSize: 'text-xl', radius: 38 },
};

function getColorFromScore(score: number): string {
  if (score >= 80) return '#22C55E'; // Green
  if (score >= 60) return '#F59E0B'; // Amber
  if (score >= 40) return '#3B82F6'; // Blue
  return '#6B7280'; // Gray
}

export function ScoreGauge({
  value,
  max = 100,
  size = 'md',
  showLabel = true,
  label = 'Score',
  animated = true,
}: ScoreGaugeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  const config = sizeConfig[size];
  const center = config.width / 2;
  const circumference = 2 * Math.PI * config.radius;
  const percentage = Math.min((value / max) * 100, 100);
  const offset = circumference - (percentage / 100) * circumference;
  const color = getColorFromScore(value);

  // Animated score counter
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    if (isInView && animated) {
      const animation = animate(count, value, {
        duration: 1.2,
        ease: 'easeOut',
      });
      return animation.stop;
    } else if (!animated) {
      count.set(value);
    }
  }, [isInView, value, animated]);

  return (
    <Tooltip
      label={`${label}: ${value}/${max}`}
      withArrow
    >
      <div
        ref={ref}
        className="relative inline-flex items-center justify-center"
        style={{ width: config.width, height: config.width }}
      >
        <svg
          className="-rotate-90"
          width={config.width}
          height={config.width}
        >
          {/* Background ring */}
          <circle
            cx={center}
            cy={center}
            r={config.radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={config.strokeWidth}
            fill="none"
          />
          {/* Progress ring */}
          <motion.circle
            cx={center}
            cy={center}
            r={config.radius}
            stroke={color}
            strokeWidth={config.strokeWidth}
            fill="none"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={isInView ? { strokeDashoffset: offset } : {}}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
              filter: `drop-shadow(0 0 6px ${color})`,
            }}
          />
        </svg>

        {/* Center value */}
        {showLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.span
              className={`${config.fontSize} font-bold text-white`}
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.3 }}
            >
              {rounded}
            </motion.span>
          </div>
        )}

        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 0.15 } : {}}
          style={{
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          }}
        />
      </div>
    </Tooltip>
  );
}

// Horizontal bar variant for inline score display
interface ScoreBarProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
}

export function ScoreBar({
  value,
  max = 100,
  label,
  showValue = true,
}: ScoreBarProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const percentage = Math.min((value / max) * 100, 100);
  const color = getColorFromScore(value);

  return (
    <div ref={ref} className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <Text size="xs" c="dimmed">
              {label}
            </Text>
          )}
          {showValue && (
            <Text size="xs" fw={600} c="white">
              {value}
            </Text>
          )}
        </div>
      )}
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={isInView ? { width: `${percentage}%` } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
    </div>
  );
}

// Mini inline score badge
interface ScoreChipProps {
  value: number;
  label?: string;
}

export function ScoreChip({ value, label }: ScoreChipProps) {
  const color = getColorFromScore(value);

  return (
    <Tooltip label={label ? `${label}: ${value}` : `Score: ${value}`} withArrow>
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
        style={{
          backgroundColor: `${color}20`,
          color: color,
        }}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        {value}
      </span>
    </Tooltip>
  );
}
