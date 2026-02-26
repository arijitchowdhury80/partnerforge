# PartnerForge Premium UI Specification

**Version:** 1.0
**Date:** 2026-02-25
**Objective:** Championship-Level Enterprise ABM Dashboard UX
**Research Scope:** 50+ libraries evaluated across 10 categories

---

## Executive Summary

This document defines the **premium visual identity** for PartnerForge. We're not building a college project — we're building **enterprise software that companies pay thousands of dollars to subscribe to**.

**Design Philosophy:**
> "Make executives say 'wow' in the first 3 seconds. Make them stay because the data is irresistible."

---

## The Championship Stack

### Tier 1: Core Visual Foundation

| Layer | Library | Why Championship-Level | Cost |
|-------|---------|------------------------|------|
| **Component System** | Aceternity UI | 200+ premium animated components, glassmorphism, 3D effects | Free + $299 Pro |
| **Data Visualization** | Nivo + ECharts | Most beautiful charts in the industry | Free |
| **Data Grid** | TanStack Table + Custom | Headless = unlimited design freedom | Free |
| **Animations** | Motion (Framer) + GSAP | Industry standard, 30.7k + 23k stars | Free |
| **3D Elements** | Spline | No-code 3D, React integration | Free + Pro |
| **Icons** | Hugeicons + Iconify | 46,000+ premium icons | Free |

### Tier 2: Premium Polish

| Layer | Library | Purpose | Cost |
|-------|---------|---------|------|
| Magic UI | 150+ animated components | Micro-interactions | Free |
| Horizon UI | Dashboard template reference | Modern fintech aesthetic | Free |
| react-loading-skeleton | Loading states | Adaptive skeletons | Free |
| Moti | 60fps skeleton animations | Performance | Free |

### Tier 3: Enhancement Options

| Library | When to Use | Cost |
|---------|-------------|------|
| Highcharts | Financial charting needs | Commercial |
| AG Grid Enterprise | >100k rows, Excel export | $999/dev |
| MUI X Data Grid Pro | Advanced data ops | $180/dev/yr |

---

## Visual Design Language

### 1. Glassmorphism (Primary Design Trend)

**Why Glassmorphism?**
- Drives user focus in complex enterprise UIs
- Modern GPUs handle blur effects smoothly in 2026
- Apple Liquid Glass aesthetic = premium perception
- Separates layered information hierarchy

**Implementation:**
```css
/* Championship-level glassmorphic card */
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Elevated glassmorphic card */
.glass-card-elevated {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    rgba(255, 255, 255, 0.05) 100%
  );
  backdrop-filter: blur(40px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 25px 45px rgba(0, 0, 0, 0.2),
    0 10px 20px rgba(0, 0, 0, 0.1);
}
```

### 2. Color System

**Primary Palette (Dark Mode Default):**
```css
:root {
  /* Algolia Brand */
  --algolia-blue: #003DFF;
  --algolia-purple: #5468FF;
  --algolia-space-gray: #21243D;

  /* Championship Gradients */
  --gradient-primary: linear-gradient(135deg, #003DFF 0%, #5468FF 100%);
  --gradient-success: linear-gradient(135deg, #10B981 0%, #059669 100%);
  --gradient-danger: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
  --gradient-warning: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);

  /* Background Layers */
  --bg-base: #0A0A0F;
  --bg-elevated: #121218;
  --bg-surface: #1A1A23;
  --bg-hover: #252530;

  /* Signal Status (Premium Gradients) */
  --status-hot: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);
  --status-warm: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
  --status-cool: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
  --status-cold: linear-gradient(135deg, #6B7280 0%, #4B5563 100%);

  /* Margin Zones */
  --margin-green: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
  --margin-yellow: linear-gradient(135deg, #EAB308 0%, #CA8A04 100%);
  --margin-red: linear-gradient(135deg, #EF4444 0%, #DC2626 100%);

  /* Text Hierarchy */
  --text-primary: #FFFFFF;
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-tertiary: rgba(255, 255, 255, 0.5);
  --text-disabled: rgba(255, 255, 255, 0.3);

  /* Glow Effects */
  --glow-blue: 0 0 20px rgba(0, 61, 255, 0.3);
  --glow-purple: 0 0 20px rgba(84, 104, 255, 0.3);
  --glow-green: 0 0 20px rgba(34, 197, 94, 0.3);
  --glow-red: 0 0 20px rgba(239, 68, 68, 0.3);
}
```

### 3. Typography

**Font Stack:**
```css
/* Primary: Inter — The modern standard */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Mono: JetBrains Mono — For data/code */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* Display: Optional accent for large numbers */
--font-display: 'SF Pro Display', 'Inter', sans-serif;
```

**Type Scale (Championship Hierarchy):**
```css
/* Hero metrics — command attention */
.metric-hero {
  font-size: 64px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Large metrics — KPI cards */
.metric-large {
  font-size: 48px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* Medium metrics — table cells */
.metric-medium {
  font-size: 24px;
  font-weight: 600;
  font-family: var(--font-mono);
}

/* Data labels */
.label-data {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
```

---

## Component Specifications

### 1. KPI Cards (Tremor + Aceternity)

**Design Goal:** Make executives stare at numbers

```tsx
// Premium KPI Card with animated value
import { motion, useMotionValue, useTransform, animate } from 'motion/react';
import { Card } from '@tremor/react';

function PremiumKPICard({
  title,
  value,
  trend,
  trendValue,
  icon,
  gradient = 'primary'
}: PremiumKPICardProps) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, value, { duration: 2 });
    return animation.stop;
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card-elevated p-6 group cursor-pointer"
      whileHover={{ scale: 1.02, boxShadow: 'var(--glow-blue)' }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="label-data mb-2">{title}</p>
          <motion.span className="metric-large">
            {rounded}
          </motion.span>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradientMap[gradient]}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <TrendBadge trend={trend} value={trendValue} />
        <span className="text-xs text-tertiary">vs last month</span>
      </div>

      {/* Subtle animated border on hover */}
      <motion.div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, var(--algolia-purple), transparent)`,
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </motion.div>
  );
}
```

### 2. Data Table (TanStack Table + Custom Premium UI)

**Design Goal:** 2,687 targets feel effortless to scan

```tsx
// Premium data table with glassmorphic rows
function PremiumTargetTable({ data }: { data: Company[] }) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Sticky header with blur */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-surface/80 border-b border-white/5">
        <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,80px] gap-4 px-6 py-4">
          <span className="label-data">Company</span>
          <span className="label-data text-center">ICP Score</span>
          <span className="label-data text-center">Status</span>
          <span className="label-data text-center">Vertical</span>
          <span className="label-data text-center">Partner Tech</span>
          <span className="label-data text-center">Signals</span>
          <span className="label-data text-center">Actions</span>
        </div>
      </div>

      {/* Virtualized rows */}
      <VirtualizedList
        data={data}
        itemHeight={72}
        renderItem={(company, index) => (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.02 }}
            className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,80px] gap-4 px-6 py-4
                       border-b border-white/5 hover:bg-white/5 cursor-pointer
                       transition-colors duration-200"
            whileHover={{ backgroundColor: 'rgba(84, 104, 255, 0.05)' }}
          >
            {/* Company cell with logo + name + ticker */}
            <div className="flex items-center gap-3">
              <CompanyAvatar domain={company.domain} />
              <div>
                <p className="font-medium text-white">{company.name}</p>
                {company.ticker && (
                  <p className="text-xs text-tertiary">{company.exchange}:{company.ticker}</p>
                )}
              </div>
            </div>

            {/* ICP Score with animated ring */}
            <div className="flex items-center justify-center">
              <ScoreRing value={company.icp_score} max={100} />
            </div>

            {/* Status pill with gradient */}
            <div className="flex items-center justify-center">
              <StatusPill status={company.status} />
            </div>

            {/* ... more cells */}
          </motion.div>
        )}
      />
    </div>
  );
}
```

### 3. Score Ring (Custom Animated Component)

```tsx
// Animated circular progress with glow effect
function ScoreRing({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = (value / max) * 100;
  const circumference = 2 * Math.PI * 18; // radius 18
  const offset = circumference - (percentage / 100) * circumference;

  const color = value >= 80 ? '#22C55E' : value >= 60 ? '#F59E0B' : value >= 40 ? '#3B82F6' : '#6B7280';

  return (
    <div className="relative w-12 h-12">
      <svg className="w-12 h-12 -rotate-90">
        {/* Background ring */}
        <circle
          cx="24" cy="24" r="18"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="4"
          fill="none"
        />
        {/* Progress ring with animation */}
        <motion.circle
          cx="24" cy="24" r="18"
          stroke={color}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          className="text-sm font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
}
```

### 4. Status Pills (Premium Gradient Pills)

```tsx
function StatusPill({ status }: { status: 'hot' | 'warm' | 'cool' | 'cold' }) {
  const styles = {
    hot: 'from-red-500 to-red-600 shadow-red-500/30',
    warm: 'from-orange-500 to-orange-600 shadow-orange-500/30',
    cool: 'from-blue-500 to-blue-600 shadow-blue-500/30',
    cold: 'from-gray-500 to-gray-600 shadow-gray-500/30',
  };

  const icons = {
    hot: '🔥',
    warm: '☀️',
    cool: '❄️',
    cold: '🌙',
  };

  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1 rounded-full
        text-xs font-semibold text-white
        bg-gradient-to-r ${styles[status]}
        shadow-lg ${styles[status].split(' ')[2]}
      `}
    >
      <span>{icons[status]}</span>
      <span className="uppercase tracking-wider">{status}</span>
    </motion.span>
  );
}
```

### 5. Executive Quote Card (In Their Own Words)

```tsx
function ExecutiveQuoteCard({ quote }: { quote: ExecutiveQuote }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="glass-card p-6 relative overflow-hidden"
    >
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-algolia-blue to-algolia-purple" />

      {/* Quote mark */}
      <span className="absolute top-4 right-4 text-6xl text-white/5 font-serif">"</span>

      {/* Quote text */}
      <blockquote className="text-lg text-white/90 italic pl-4 mb-4 leading-relaxed">
        "{quote.text}"
      </blockquote>

      {/* Attribution */}
      <div className="flex items-center justify-between pl-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-algolia-blue to-algolia-purple flex items-center justify-center text-white font-bold">
            {quote.speaker.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-white">{quote.speaker}</p>
            <p className="text-sm text-white/60">{quote.title}</p>
          </div>
        </div>

        {/* Source badge */}
        <SourceBadge
          url={quote.source_url}
          date={quote.source_date}
          type={quote.source_type}
        />
      </div>

      {/* Topic tags */}
      <div className="flex gap-2 mt-4 pl-4">
        {quote.topic_tags.map(tag => (
          <span key={tag} className="px-2 py-1 rounded-md bg-white/5 text-xs text-white/70">
            {tag}
          </span>
        ))}
      </div>

      {/* Algolia mapping indicator */}
      {quote.maps_to_algolia && (
        <div className="mt-4 pl-4 pt-4 border-t border-white/5">
          <p className="text-xs text-white/50 mb-1">Maps to Algolia Solution</p>
          <p className="text-sm text-algolia-purple font-medium">{quote.maps_to_algolia}</p>
        </div>
      )}
    </motion.div>
  );
}
```

### 6. Hero Section with 3D Element (Spline)

```tsx
import Spline from '@splinetool/react-spline';

function DashboardHero() {
  return (
    <div className="relative h-[400px] overflow-hidden rounded-3xl glass-card">
      {/* 3D Background */}
      <div className="absolute inset-0 opacity-50">
        <Spline scene="https://prod.spline.design/YOUR_SCENE_ID/scene.splinecode" />
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-base/90 via-base/70 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-12">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="label-data mb-4"
        >
          Partner Intelligence Platform
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl font-bold text-white mb-4"
        >
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
            2,687
          </span>
          {' '}Displacement Targets
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-white/60 mb-8 max-w-lg"
        >
          Companies using partner technologies that should be using Algolia
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-4"
        >
          <HotLeadsBadge count={9} />
          <WarmLeadsBadge count={49} />
          <EnrichedBadge count={400} />
        </motion.div>
      </div>
    </div>
  );
}
```

---

## Chart Specifications

### 1. Revenue Trend Chart (Nivo)

```tsx
import { ResponsiveLine } from '@nivo/line';

function RevenueTrendChart({ data }: { data: FinancialData[] }) {
  return (
    <div className="glass-card p-6 h-[400px]">
      <h3 className="label-data mb-4">3-Year Revenue Trend</h3>
      <ResponsiveLine
        data={data}
        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
        curve="catmullRom"
        enableArea={true}
        areaOpacity={0.15}
        colors={['#5468FF']}
        lineWidth={3}
        pointSize={10}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={3}
        pointBorderColor={{ from: 'serieColor' }}
        enableGridX={false}
        gridYValues={5}
        theme={{
          background: 'transparent',
          textColor: 'rgba(255,255,255,0.5)',
          grid: {
            line: {
              stroke: 'rgba(255,255,255,0.05)',
            },
          },
          crosshair: {
            line: {
              stroke: '#5468FF',
              strokeWidth: 2,
            },
          },
          tooltip: {
            container: {
              background: '#1A1A23',
              color: '#FFFFFF',
              borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            },
          },
        }}
        motionConfig="gentle"
      />
    </div>
  );
}
```

### 2. Margin Zone Donut (ECharts)

```tsx
import ReactECharts from 'echarts-for-react';

function MarginZoneChart({ value, zone }: { value: number; zone: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: '#22C55E',
    yellow: '#EAB308',
    red: '#EF4444',
  };

  const option = {
    series: [{
      type: 'gauge',
      radius: '100%',
      startAngle: 180,
      endAngle: 0,
      min: 0,
      max: 30,
      splitNumber: 3,
      itemStyle: {
        color: colors[zone],
        shadowColor: colors[zone],
        shadowBlur: 20,
      },
      progress: {
        show: true,
        roundCap: true,
        width: 12,
      },
      pointer: { show: false },
      axisLine: {
        roundCap: true,
        lineStyle: {
          width: 12,
          color: [[1, 'rgba(255,255,255,0.1)']],
        },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: false },
      detail: {
        offsetCenter: [0, '20%'],
        fontSize: 32,
        fontWeight: 'bold',
        formatter: '{value}%',
        color: colors[zone],
      },
      data: [{ value }],
    }],
  };

  return (
    <div className="glass-card p-6">
      <h3 className="label-data mb-2">EBITDA Margin</h3>
      <ReactECharts option={option} style={{ height: 200 }} />
      <div className="text-center mt-2">
        <span className={`text-sm font-medium text-${zone === 'green' ? 'green' : zone === 'yellow' ? 'yellow' : 'red'}-400`}>
          {zone === 'green' ? 'Healthy (>20%)' : zone === 'yellow' ? 'Moderate (10-20%)' : 'Pressure (<10%)'}
        </span>
      </div>
    </div>
  );
}
```

---

## Loading & Skeleton States

### Premium Skeleton Components

```tsx
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// Custom theme for skeletons
const skeletonTheme = {
  baseColor: 'rgba(255,255,255,0.05)',
  highlightColor: 'rgba(255,255,255,0.1)',
  borderRadius: '8px',
  duration: 1.5,
};

function KPICardSkeleton() {
  return (
    <div className="glass-card p-6">
      <Skeleton {...skeletonTheme} width={80} height={12} />
      <Skeleton {...skeletonTheme} width={120} height={48} className="mt-4" />
      <div className="flex gap-2 mt-4">
        <Skeleton {...skeletonTheme} width={60} height={24} />
        <Skeleton {...skeletonTheme} width={80} height={16} />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,1fr,80px] gap-4 px-6 py-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <Skeleton {...skeletonTheme} circle width={40} height={40} />
        <div>
          <Skeleton {...skeletonTheme} width={120} height={16} />
          <Skeleton {...skeletonTheme} width={80} height={12} className="mt-1" />
        </div>
      </div>
      <Skeleton {...skeletonTheme} width={48} height={48} circle className="mx-auto" />
      <Skeleton {...skeletonTheme} width={64} height={24} className="mx-auto" />
      <Skeleton {...skeletonTheme} width={80} height={16} className="mx-auto" />
      <div className="flex gap-1 justify-center">
        <Skeleton {...skeletonTheme} width={40} height={20} />
        <Skeleton {...skeletonTheme} width={40} height={20} />
      </div>
      <Skeleton {...skeletonTheme} width={40} height={16} className="mx-auto" />
      <div className="flex gap-2 justify-center">
        <Skeleton {...skeletonTheme} width={24} height={24} />
        <Skeleton {...skeletonTheme} width={24} height={24} />
      </div>
    </div>
  );
}
```

---

## Animation Guidelines

### When to Animate (Championship Impact)

| Action | Animation | Library | Purpose |
|--------|-----------|---------|---------|
| Page load | Staggered fade-in | Motion | Establish visual hierarchy |
| Metric update | Count up + glow | Motion | Draw attention to change |
| Status change | Color morph + pulse | Motion | Indicate state transition |
| Row hover | Subtle highlight | CSS | Indicate interactivity |
| Card expand | Spring-based open | Motion | Natural feel |
| Data refresh | Skeleton shimmer | Skeleton | Reduce perceived load time |
| Success | Confetti burst | GSAP | Celebrate achievement |
| Chart load | Draw animation | Nivo/ECharts | Build anticipation |

### When NOT to Animate

- Data table sorting (instant)
- Form input typing (no delay)
- Navigation clicks (instant)
- Pagination (instant swap)
- Filter application (fast fade)

---

## Micro-Interactions (Magic UI)

### Animated Borders

```tsx
import { motion } from 'motion/react';

function AnimatedBorderCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative p-[1px] rounded-xl overflow-hidden">
      {/* Animated border */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(90deg, transparent, #5468FF, transparent)',
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* Content */}
      <div className="relative bg-surface rounded-xl">
        {children}
      </div>
    </div>
  );
}
```

### Number Counter

```tsx
import { motion, useMotionValue, useTransform, animate } from 'motion/react';

function AnimatedCounter({ value, prefix = '', suffix = '' }: Props) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, value, {
      duration: 2,
      ease: 'easeOut',
    });
    return animation.stop;
  }, [value]);

  return (
    <span>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
```

---

## Icon Specification

### Primary Icon Set: Hugeicons

**Why Hugeicons:**
- 46,000+ icons (most comprehensive)
- Consistent 24px grid
- Multiple styles (Stroke, Filled, Duo-Tone)
- Direct Lucide migration path
- Design system ready

**Usage:**
```tsx
import {
  Building02Icon,
  ChartLineUp01Icon,
  Target04Icon,
  Rocket02Icon,
  Fire03Icon,
} from '@hugeicons/react';

// Example usage with consistent sizing
<Building02Icon size={24} className="text-white/70" />
```

### Fallback: Iconify

```tsx
import { Icon } from '@iconify/react';

// Access any icon set through Iconify
<Icon icon="mdi:chart-line" width={24} className="text-white/70" />
<Icon icon="ph:fire-bold" width={24} className="text-red-500" />
```

---

## Responsive Breakpoints

```css
/* Championship breakpoints */
--breakpoint-sm: 640px;   /* Mobile landscape */
--breakpoint-md: 768px;   /* Tablet portrait */
--breakpoint-lg: 1024px;  /* Tablet landscape / small desktop */
--breakpoint-xl: 1280px;  /* Desktop */
--breakpoint-2xl: 1536px; /* Large desktop */
--breakpoint-3xl: 1920px; /* Ultra-wide */

/* Dashboard-specific */
--sidebar-width: 280px;
--header-height: 64px;
--table-max-height: calc(100vh - 280px);
```

---

## Accessibility (Championship Standard)

1. **Color contrast:** All text meets WCAG AA (4.5:1 ratio)
2. **Focus states:** Visible focus rings on all interactive elements
3. **Motion:** Respect `prefers-reduced-motion`
4. **Screen readers:** Proper ARIA labels on all interactive elements
5. **Keyboard navigation:** Full keyboard support for data tables

```tsx
// Motion with reduced-motion support
const shouldReduceMotion = useReducedMotion();

<motion.div
  animate={{ opacity: 1, y: 0 }}
  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.5 }}
>
```

---

## Package Installation

```bash
# Core stack
npm install @aceternity/react motion gsap
npm install @nivo/core @nivo/line @nivo/pie
npm install echarts echarts-for-react
npm install @tanstack/react-table
npm install react-loading-skeleton

# Icons
npm install @hugeicons/react @iconify/react

# 3D (optional)
npm install @splinetool/react-spline

# Utilities
npm install clsx tailwind-merge
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Time to Interactive | < 3.0s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| Table render (2,687 rows) | < 100ms | React DevTools |
| Animation frame rate | 60fps | Browser DevTools |
| Bundle size (gzipped) | < 300kb | Webpack |

---

## Championship Checklist

Before shipping any screen, verify:

- [ ] Glassmorphic cards with proper blur
- [ ] Gradient accents on status indicators
- [ ] Animated metric counters
- [ ] Skeleton loading states
- [ ] Hover micro-interactions
- [ ] Premium icon consistency
- [ ] Dark mode by default
- [ ] Source citation badges visible
- [ ] 60fps animations
- [ ] Mobile responsive layout
- [ ] Accessibility compliant

---

*Document Version: 1.0*
*Created: 2026-02-25*
*Status: Championship-Level UI Specification Complete*
