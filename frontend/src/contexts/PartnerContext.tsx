/**
 * Partner Context
 *
 * Global state for selected partner technology.
 * Controls which partner's displacement targets are shown.
 */

import { createContext, useContext, useState, ReactNode } from 'react';

export interface Partner {
  key: string;
  name: string;
  shortName: string;
  color: string;
  icon: string;
  count?: number;
}

// Available partners - matches backend PARTNER_TECHNOLOGIES
export const PARTNERS: Partner[] = [
  { key: 'all', name: 'All Partners', shortName: 'All', color: 'blue', icon: '🌐' },
  { key: 'adobe', name: 'Adobe Experience Manager', shortName: 'Adobe AEM', color: 'red', icon: '🔴' },
  { key: 'shopify', name: 'Shopify', shortName: 'Shopify', color: 'green', icon: '🛒' },
  { key: 'salesforce', name: 'Salesforce Commerce Cloud', shortName: 'SFCC', color: 'cyan', icon: '☁️' },
  { key: 'bigcommerce', name: 'BigCommerce', shortName: 'BigCommerce', color: 'violet', icon: '🏪' },
  { key: 'magento', name: 'Magento', shortName: 'Magento', color: 'orange', icon: '🟠' },
  { key: 'commercetools', name: 'commercetools', shortName: 'CT', color: 'teal', icon: '⚙️' },
  { key: 'vtex', name: 'VTEX', shortName: 'VTEX', color: 'pink', icon: '💜' },
  { key: 'sap', name: 'SAP Commerce Cloud', shortName: 'SAP', color: 'yellow', icon: '🟡' },
  { key: 'elastic', name: 'Elasticsearch', shortName: 'Elastic', color: 'lime', icon: '🔍' },
];

interface PartnerContextType {
  selectedPartner: Partner;
  setSelectedPartner: (partner: Partner) => void;
  partners: Partner[];
}

const PartnerContext = createContext<PartnerContextType | undefined>(undefined);

export function PartnerProvider({ children }: { children: ReactNode }) {
  // Default to Adobe AEM since that's what we have data for
  const [selectedPartner, setSelectedPartner] = useState<Partner>(PARTNERS[1]);

  return (
    <PartnerContext.Provider value={{ selectedPartner, setSelectedPartner, partners: PARTNERS }}>
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
