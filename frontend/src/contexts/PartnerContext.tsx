/**
 * Partner Context
 *
 * Global state for selected partner and product.
 * Hierarchical structure: Partner → Products
 *
 * DATA SOURCE: Database tables (partners, partner_products)
 * NOT hardcoded - fetched from Supabase on mount
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getPartners } from '../services/supabase';

// Product within a partner ecosystem
export interface Product {
  key: string;
  name: string;
  shortName: string;
  count?: number;  // Number of targets with this product
  builtWithTechName?: string;  // For API filtering
}

// Partner company with their products
export interface Partner {
  key: string;
  name: string;
  shortName: string;
  products: Product[];
}

// Combined selection
export interface PartnerSelection {
  partner: Partner;
  product: Product | null;  // null means all products for this partner
}

// Default "All Partners" option - always available
const ALL_PARTNERS: Partner = {
  key: 'all',
  name: 'All Partners',
  shortName: 'All',
  products: [],
};

// Get display name for current selection
export function getSelectionDisplayName(selection: PartnerSelection): string {
  if (selection.partner.key === 'all') {
    return 'All Partners';
  }
  if (selection.product) {
    return `${selection.partner.shortName} ${selection.product.shortName}`;
  }
  return selection.partner.name;
}

// Get the tech name to filter by (for API)
export function getSelectionTechName(selection: PartnerSelection): string | undefined {
  if (selection.partner.key === 'all') {
    return undefined;
  }
  if (selection.product) {
    // Use the builtWithTechName if available, otherwise fall back to product name
    return selection.product.builtWithTechName || selection.product.name;
  }
  // Default: use partner name for broad matching
  // e.g., 'Adobe' matches both 'Adobe Experience Manager' AND 'Adobe Commerce'
  return selection.partner.name;
}

interface PartnerContextType {
  selection: PartnerSelection;
  setSelection: (selection: PartnerSelection) => void;
  selectPartner: (partner: Partner) => void;
  selectProduct: (product: Product | null) => void;
  partners: Partner[];
  isLoading: boolean;
  // Legacy support
  selectedPartner: {
    key: string;
    name: string;
    shortName: string;
    icon: string;
  };
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

// Legacy icon map for backwards compatibility
const iconMap: Record<string, string> = {
  all: '🌐',
  adobe: '🔴',
  salesforce: '☁️',
  shopify: '🛒',
  sap: '🔷',
  commercetools: '⚙️',
  bigcommerce: '🏪',
  vtex: '💜',
  amplience: '🟣',
  spryker: '🔶',
};

export function PartnerProvider({ children }: { children: ReactNode }) {
  // Partners loaded from database
  const [partners, setPartners] = useState<Partner[]>([ALL_PARTNERS]);
  const [isLoading, setIsLoading] = useState(true);

  // Default to "All Partners" - no specific partner selected
  const [selection, setSelection] = useState<PartnerSelection>({
    partner: ALL_PARTNERS,
    product: null,
  });

  // Fetch partners from database on mount
  useEffect(() => {
    async function loadPartners() {
      setIsLoading(true);
      try {
        const result = await getPartners();

        // Transform database format to Partner interface
        const dbPartners: Partner[] = result.partners.map(p => ({
          key: p.key,
          name: p.name,
          shortName: p.shortName,
          products: p.products.map(prod => ({
            key: prod.key,
            name: prod.name,
            shortName: prod.shortName,
            count: prod.count,
            builtWithTechName: prod.builtWithTechName,
          })),
        }));

        // Always include "All Partners" at the beginning
        setPartners([ALL_PARTNERS, ...dbPartners]);
      } catch (error) {
        console.error('Failed to load partners from database:', error);
        // Keep default [ALL_PARTNERS] on error
      } finally {
        setIsLoading(false);
      }
    }

    loadPartners();
  }, []);

  const selectPartner = (partner: Partner) => {
    setSelection({
      partner,
      product: partner.products.length > 0 ? partner.products[0] : null,
    });
  };

  const selectProduct = (product: Product | null) => {
    setSelection((prev) => ({
      ...prev,
      product,
    }));
  };

  // Legacy support for existing components
  const selectedPartner = {
    key: selection.partner.key,
    name: getSelectionDisplayName(selection),
    shortName: selection.partner.shortName,
    icon: iconMap[selection.partner.key] || '🌐',
  };

  return (
    <PartnerContext.Provider
      value={{
        selection,
        setSelection,
        selectPartner,
        selectProduct,
        partners,
        isLoading,
        selectedPartner,
      }}
    >
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  const context = useContext(PartnerContext);
  if (context === undefined) {
    throw new Error('usePartner must be used within a PartnerProvider');
  }
  return context;
}
