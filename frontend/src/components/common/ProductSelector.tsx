/**
 * Product Selector - Chip-based product filter
 *
 * Reusable component for selecting products within a partner.
 * Uses shared COLORS from @/lib/constants.
 */

import { Chip, Group, Badge, Text } from '@mantine/core';
import { COLORS } from '@/lib/constants';
import type { Product } from '@/contexts/PartnerContext';

// =============================================================================
// Chip Style Config - Centralized for consistency
// =============================================================================

export const CHIP_STYLES = {
  selected: {
    backgroundColor: COLORS.ALGOLIA_NEBULA_BLUE,
    color: COLORS.ALGOLIA_WHITE,
    borderColor: COLORS.ALGOLIA_NEBULA_BLUE,
  },
  unselected: {
    backgroundColor: COLORS.ALGOLIA_WHITE,
    color: COLORS.GRAY_700,
    borderColor: COLORS.GRAY_300,
  },
  badge: {
    selected: {
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: COLORS.ALGOLIA_WHITE,
    },
    unselected: {
      backgroundColor: COLORS.GRAY_100,
      color: COLORS.GRAY_600,
    },
  },
} as const;

// =============================================================================
// Component Props
// =============================================================================

interface ProductSelectorProps {
  products: Product[];
  selectedProductKey: string | null;
  onSelectProduct: (productKey: string | null) => void;
  showAllOption?: boolean;
  label?: string;
}

// =============================================================================
// Component
// =============================================================================

export function ProductSelector({
  products,
  selectedProductKey,
  onSelectProduct,
  showAllOption = true,
  label = 'Filter by Product',
}: ProductSelectorProps) {
  // Don't render if only 1 product (no filtering needed)
  if (products.length <= 1 && !showAllOption) {
    return null;
  }

  const currentValue = selectedProductKey || 'all';

  const getChipStyles = (isSelected: boolean) => ({
    label: {
      fontSize: '13px',
      fontWeight: 500,
      paddingLeft: 12,
      paddingRight: 12,
      ...(isSelected ? CHIP_STYLES.selected : CHIP_STYLES.unselected),
    },
    iconWrapper: {
      display: 'none' as const,
    },
  });

  const getBadgeStyles = (isSelected: boolean) => ({
    root: {
      fontSize: '10px',
      padding: '0 6px',
      ...(isSelected ? CHIP_STYLES.badge.selected : CHIP_STYLES.badge.unselected),
    },
  });

  return (
    <div>
      {label && (
        <Text size="xs" c={COLORS.GRAY_500} fw={500} mb={6}>
          {label}
        </Text>
      )}
      <Chip.Group
        value={currentValue}
        onChange={(value) => {
          // Handle both string and string[] from Mantine (single select mode)
          const selectedValue = Array.isArray(value) ? value[0] : value;
          onSelectProduct(selectedValue === 'all' ? null : selectedValue);
        }}
      >
        <Group gap={8}>
          {showAllOption && (
            <Chip
              value="all"
              variant="outline"
              size="sm"
              styles={getChipStyles(currentValue === 'all')}
            >
              All Products
            </Chip>
          )}
          {products.map((product) => {
            const isSelected = selectedProductKey === product.key;
            return (
              <Chip
                key={product.key}
                value={product.key}
                variant="outline"
                size="sm"
                styles={getChipStyles(isSelected)}
              >
                {product.shortName}
                {product.count !== undefined && product.count > 0 && (
                  <Badge
                    size="xs"
                    variant="light"
                    color={isSelected ? 'gray' : 'blue'}
                    ml={6}
                    styles={getBadgeStyles(isSelected)}
                  >
                    {product.count.toLocaleString()}
                  </Badge>
                )}
              </Chip>
            );
          })}
        </Group>
      </Chip.Group>
    </div>
  );
}

export default ProductSelector;
