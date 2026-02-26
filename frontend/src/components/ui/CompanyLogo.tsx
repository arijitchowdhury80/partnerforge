/**
 * CompanyLogo Component - Premium Company Logo Display
 *
 * Uses Clearbit Logo API with graceful fallbacks:
 * 1. Clearbit Logo API (primary) - https://logo.clearbit.com/{domain}
 * 2. Google Favicon API (fallback) - High-res favicons
 * 3. Initials Avatar (final fallback)
 */

import { useState } from 'react';

interface CompanyLogoProps {
  domain: string;
  companyName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  radius?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
}

const SIZE_MAP: Record<string, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const RADIUS_MAP: Record<string, number> = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 9999,
};

// Color palette for initials fallback
const COLORS = [
  '#003DFF', // Algolia Blue
  '#5468FF', // Algolia Purple
  '#36B37E', // Green
  '#FF5630', // Red
  '#6554C0', // Purple
  '#00B8D9', // Cyan
  '#FF8B00', // Orange
];

function getColorFromDomain(domain: string): string {
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function CompanyLogo({
  domain,
  companyName,
  size = 'sm',
  radius = 'md',
  className,
}: CompanyLogoProps) {
  const [imgSrc, setImgSrc] = useState<'clearbit' | 'favicon' | 'initials'>('clearbit');

  // Clean domain
  const cleanDomain = domain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/$/, '')
    .toLowerCase();

  const sizePx = typeof size === 'number' ? size : SIZE_MAP[size] || 32;
  const radiusPx = typeof radius === 'number' ? radius : RADIUS_MAP[radius] || 8;

  const clearbitUrl = `https://logo.clearbit.com/${cleanDomain}`;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;

  const initials = (companyName || cleanDomain).charAt(0).toUpperCase();
  const bgColor = getColorFromDomain(cleanDomain);

  const containerStyle: React.CSSProperties = {
    width: sizePx,
    height: sizePx,
    minWidth: sizePx,
    borderRadius: radiusPx,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: imgSrc === 'initials' ? bgColor : '#ffffff',
    border: imgSrc === 'initials' ? 'none' : '1px solid #e2e8f0',
    flexShrink: 0,
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: imgSrc === 'favicon' ? 4 : 2,
  };

  const initialsStyle: React.CSSProperties = {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: sizePx * 0.45,
    lineHeight: 1,
    userSelect: 'none',
  };

  const handleClearbitError = () => {
    setImgSrc('favicon');
  };

  const handleFaviconError = () => {
    setImgSrc('initials');
  };

  return (
    <div style={containerStyle} className={className}>
      {imgSrc === 'clearbit' && (
        <img
          src={clearbitUrl}
          alt={companyName || cleanDomain}
          style={imgStyle}
          onError={handleClearbitError}
          loading="lazy"
        />
      )}
      {imgSrc === 'favicon' && (
        <img
          src={faviconUrl}
          alt={companyName || cleanDomain}
          style={imgStyle}
          onError={handleFaviconError}
          loading="lazy"
        />
      )}
      {imgSrc === 'initials' && (
        <span style={initialsStyle}>{initials}</span>
      )}
    </div>
  );
}

export default CompanyLogo;
