/**
 * LoadingSpinner Component
 *
 * Premium loading indicators with various styles.
 */

import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse' | 'bars';
  color?: string;
  text?: string;
}

const sizeConfig = {
  sm: { spinner: 16, text: 'text-xs' },
  md: { spinner: 24, text: 'text-sm' },
  lg: { spinner: 40, text: 'text-base' },
  xl: { spinner: 64, text: 'text-lg' },
};

export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  color = '#5468FF',
  text,
}: LoadingSpinnerProps) {
  const config = sizeConfig[size];

  const renderSpinner = () => {
    switch (variant) {
      case 'dots':
        return <DotsSpinner size={config.spinner} color={color} />;
      case 'pulse':
        return <PulseSpinner size={config.spinner} color={color} />;
      case 'bars':
        return <BarsSpinner size={config.spinner} color={color} />;
      default:
        return <CircleSpinner size={config.spinner} color={color} />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      {renderSpinner()}
      {text && (
        <motion.span
          className={`${config.text} text-white/60`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {text}
        </motion.span>
      )}
    </div>
  );
}

// Default circle spinner
function CircleSpinner({ size, color }: { size: number; color: string }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="3"
        fill="none"
      />
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="31.416"
        strokeDashoffset="23.562"
        style={{
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
    </motion.svg>
  );
}

// Dots spinner
function DotsSpinner({ size, color }: { size: number; color: string }) {
  const dotSize = size / 4;

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: dotSize,
            height: dotSize,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Pulse spinner
function PulseSpinner({ size, color }: { size: number; color: string }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={{
          scale: [0.5, 1],
          opacity: [0.8, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={{
          scale: [0.5, 1],
          opacity: [0.8, 0],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeOut',
          delay: 0.5,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: size / 2,
          height: size / 2,
          backgroundColor: color,
          top: '25%',
          left: '25%',
          boxShadow: `0 0 8px ${color}`,
        }}
      />
    </div>
  );
}

// Bars spinner
function BarsSpinner({ size, color }: { size: number; color: string }) {
  const barWidth = size / 6;
  const barCount = 4;

  return (
    <div className="flex items-end gap-0.5" style={{ height: size }}>
      {Array.from({ length: barCount }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-t"
          style={{
            width: barWidth,
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
          }}
          animate={{
            height: [size * 0.3, size * 0.8, size * 0.3],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// Full page loading overlay
interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
}

export function LoadingOverlay({ visible, text = 'Loading...' }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
        <LoadingSpinner size="lg" variant="default" />
        <span className="text-white/80">{text}</span>
      </div>
    </motion.div>
  );
}

// Skeleton loading placeholder
interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
}

export function Skeleton({ width, height, circle, className = '' }: SkeletonProps) {
  return (
    <motion.div
      className={`bg-white/10 rounded ${circle ? 'rounded-full' : 'rounded-md'} ${className}`}
      style={{ width, height }}
      animate={{
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

// Card skeleton for loading states
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="p-6 rounded-xl bg-white/5 border border-white/10 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton width={100} height={16} />
        <Skeleton width={60} height={24} />
      </div>
      <Skeleton width={120} height={40} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width="100%" height={12} />
      ))}
    </div>
  );
}

// Table row skeleton
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
      <Skeleton width={40} height={40} circle />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={10} />
      </div>
      {Array.from({ length: columns - 2 }).map((_, i) => (
        <Skeleton key={i} width={60} height={16} className="flex-shrink-0" />
      ))}
    </div>
  );
}
