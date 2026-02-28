/**
 * AnimatedBackground - Consistent animated space background for all pages
 *
 * Features:
 * - Milky way base image
 * - Animated star particles
 * - Subtle nebula movement
 * - Gradient overlay for readability
 */

import { Box } from '@mantine/core';
import { ReactNode } from 'react';

interface AnimatedBackgroundProps {
  children: ReactNode;
}

export function AnimatedBackground({ children }: AnimatedBackgroundProps) {
  return (
    <Box pos="relative" style={{ minHeight: '100vh' }}>
      {/* Galaxy Background Image with animation */}
      <Box
        className="galaxy-background"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {/* Base galaxy image with slow pan animation */}
        <Box
          className="galaxy-base"
          style={{
            position: 'absolute',
            top: '-10%',
            left: '-10%',
            width: '120%',
            height: '120%',
            backgroundImage: 'url(/images/milky-way.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Animated star layer 1 - small stars */}
        <Box className="stars-layer stars-small" />

        {/* Animated star layer 2 - medium stars */}
        <Box className="stars-layer stars-medium" />

        {/* Animated star layer 3 - large twinkling stars */}
        <Box className="stars-layer stars-large" />

        {/* Nebula glow effect */}
        <Box className="nebula-glow" />

        {/* Dark overlay for better readability */}
        <Box
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.8) 100%)',
          }}
        />
      </Box>

      {/* Content */}
      <Box pos="relative" style={{ zIndex: 1, minHeight: '100vh' }}>
        {children}
      </Box>
    </Box>
  );
}

export default AnimatedBackground;
