/**
 * Partner Context
 *
 * Global state for selected partner and product.
 * Hierarchical structure: Partner → Products
 */

import { createContext, useContext, useState, ReactNode } from 'react';

// Product within a partner ecosystem
export interface Product {
  key: string;
  name: string;
  shortName: string;
  count?: number;  // Number of targets with this product
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

// Partner/Product hierarchy
export const PARTNERS: Partner[] = [
  {
    key: 'all',
    name: 'All Partners',
    shortName: 'All',
    products: [],
  },
  {
    key: 'adobe',
    name: 'Adobe',
    shortName: 'Adobe',
    products: [
      { key: 'aem', name: 'Experience Manager (AEM)', shortName: 'AEM', count: 2687 },
      { key: 'commerce', name: 'Commerce (Magento)', shortName: 'Commerce', count: 0 },
      { key: 'campaign', name: 'Campaign', shortName: 'Campaign' },
      { key: 'analytics', name: 'Analytics', shortName: 'Analytics' },
      { key: 'target', name: 'Target', shortName: 'Target' },
    ],
  },
  {
    key: 'salesforce',
    name: 'Salesforce',
    shortName: 'Salesforce',
    products: [
      { key: 'commerce-cloud', name: 'Commerce Cloud (SFCC)', shortName: 'SFCC' },
      { key: 'marketing-cloud', name: 'Marketing Cloud', shortName: 'Marketing' },
      { key: 'service-cloud', name: 'Service Cloud', shortName: 'Service' },
      { key: 'experience-cloud', name: 'Experience Cloud', shortName: 'Experience' },
    ],
  },
  {
    key: 'shopify',
    name: 'Shopify',
    shortName: 'Shopify',
    products: [
      { key: 'shopify-plus', name: 'Shopify Plus', shortName: 'Plus' },
      { key: 'shopify', name: 'Shopify', shortName: 'Shopify' },
      { key: 'shopify-lite', name: 'Shopify Lite', shortName: 'Lite' },
    ],
  },
  {
    key: 'sap',
    name: 'SAP',
    shortName: 'SAP',
    products: [
      { key: 'commerce-cloud', name: 'Commerce Cloud', shortName: 'Commerce' },
      { key: 'hybris', name: 'Hybris', shortName: 'Hybris' },
      { key: 'cx', name: 'Customer Experience', shortName: 'CX' },
    ],
  },
  {
    key: 'commercetools',
    name: 'commercetools',
    shortName: 'CT',
    products: [
      { key: 'commercetools', name: 'commercetools', shortName: 'CT' },
    ],
  },
  {
    key: 'bigcommerce',
    name: 'BigCommerce',
    shortName: 'BigCommerce',
    products: [
      { key: 'enterprise', name: 'BigCommerce Enterprise', shortName: 'Enterprise' },
      { key: 'essentials', name: 'BigCommerce Essentials', shortName: 'Essentials' },
    ],
  },
  {
    key: 'vtex',
    name: 'VTEX',
    shortName: 'VTEX',
    products: [
      { key: 'vtex', name: 'VTEX', shortName: 'VTEX' },
    ],
  },
  {
    key: 'amplience',
    name: 'Amplience',
    shortName: 'Amplience',
    products: [
      { key: 'amplience', name: 'Amplience DXP', shortName: 'DXP', count: 15 },
    ],
  },
  {
    key: 'spryker',
    name: 'Spryker',
    shortName: 'Spryker',
    products: [
      { key: 'spryker', name: 'Spryker Commerce OS', shortName: 'Commerce OS', count: 20 },
    ],
  },
  // NOTE: Elasticsearch is a COMPETITOR, not a partner - removed from this list
];

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
    // Map to BuiltWith tech names
    const techNameMap: Record<string, string> = {
      'adobe-aem': 'Adobe Experience Manager',
      'adobe-commerce': 'Adobe Commerce',
      'adobe-campaign': 'Adobe Campaign',
      'adobe-analytics': 'Adobe Analytics',
      'salesforce-commerce-cloud': 'Salesforce Commerce Cloud',
      'shopify-shopify-plus': 'Shopify Plus',
      'shopify-shopify': 'Shopify',
      'sap-commerce-cloud': 'SAP Commerce Cloud',
      'sap-hybris': 'SAP Hybris',
      'commercetools-commercetools': 'commercetools',
      'bigcommerce-enterprise': 'BigCommerce',
      'vtex-vtex': 'VTEX',
      'amplience-amplience': 'Amplience',
      'spryker-spryker': 'Spryker',
    };
    return techNameMap[`${selection.partner.key}-${selection.product.key}`] || selection.product.name;
  }
  // Default partner tech name - use broad names for ilike matching
  // e.g., 'Adobe' matches both 'Adobe Experience Manager' AND 'Adobe Commerce'
  const defaultTechMap: Record<string, string> = {
    adobe: 'Adobe',                // Matches AEM, Commerce, Campaign, Analytics
    salesforce: 'Salesforce',      // Matches all Salesforce products
    shopify: 'Shopify',
    sap: 'SAP',                    // Matches SAP Commerce Cloud, Hybris
    commercetools: 'commercetools',
    bigcommerce: 'BigCommerce',
    vtex: 'VTEX',
    amplience: 'Amplience',
    spryker: 'Spryker',
  };
  return defaultTechMap[selection.partner.key];
}

interface PartnerContextType {
  selection: PartnerSelection;
  setSelection: (selection: PartnerSelection) => void;
  selectPartner: (partner: Partner) => void;
  selectProduct: (product: Product | null) => void;
  partners: Partner[];
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
  // Default to "All Partners" - no specific partner selected
  // User must explicitly select a partner to see filtered data
  const [selection, setSelection] = useState<PartnerSelection>({
    partner: PARTNERS[0], // "All Partners" - no specific selection
    product: null,
  });

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
        partners: PARTNERS,
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
