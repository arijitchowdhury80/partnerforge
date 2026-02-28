/**
 * GalaxyBackground - Shared cosmic background for all Arian pages
 *
 * Single source of truth for the galaxy background.
 * All pages should import and use this component.
 */

import { Box } from '@mantine/core';
import { ReactNode } from 'react';

interface GalaxyBackgroundProps {
  children: ReactNode;
}

/**
 * GalaxyBackground wraps page content with a cosmic background.
 * Uses the milky-way.jpg image with a dark overlay.
 */
export function GalaxyBackground({ children }: GalaxyBackgroundProps) {
  return (
    <Box pos="relative" style={{ minHeight: '100vh' }}>
      {/* Fixed Galaxy Background Image */}
      <Box
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          overflow: 'hidden',
          backgroundImage: 'url(/images/milky-way.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark overlay for readability */}
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.4) 0%, rgba(15,23,42,0.75) 100%)',
          }}
        />
        {/* Animated star field layer */}
        <Box className="galaxy-stars" />
      </Box>

      {/* Content Layer */}
      <Box pos="relative" style={{ zIndex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}

export default GalaxyBackground;
