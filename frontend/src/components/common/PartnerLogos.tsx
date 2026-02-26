/**
 * Partner Brand Logos
 *
 * SVG logos for each partner company.
 * Using simplified, recognizable brand marks.
 */

interface LogoProps {
  size?: number;
  className?: string;
}

// Adobe Logo - Red square with 'A'
export function AdobeLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#FF0000" />
      <path d="M8 18L12 6L16 18H13.5L12.5 15H10L8 18Z" fill="white" />
      <path d="M11 13H13L12 10L11 13Z" fill="#FF0000" />
    </svg>
  );
}

// Salesforce Logo - Cloud shape
export function SalesforceLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M19.5 11.5C19.5 9 17.5 7 15 7C14.2 7 13.4 7.2 12.7 7.6C11.9 6 10.1 5 8 5C5 5 2.5 7.5 2.5 10.5C2.5 10.7 2.5 10.9 2.5 11.1C1.4 11.7 0.5 12.8 0.5 14.2C0.5 16.3 2.2 18 4.3 18H19.7C21.5 18 23 16.5 23 14.7C23 13 21.5 11.5 19.5 11.5Z" fill="#00A1E0" />
    </svg>
  );
}

// Shopify Logo - Shopping bag with 'S'
export function ShopifyLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15.5 4C15.5 4 15 4 14.7 4.3L13 6H9L7.3 4.3C7 4 6.5 4 6.5 4L5 20H17L15.5 4Z" fill="#95BF47" />
      <path d="M12 8C10.3 8 9 9.3 9 11C9 12.7 10.3 14 12 14C13.7 14 15 12.7 15 11C15 9.3 13.7 8 12 8ZM12 12.5C11.2 12.5 10.5 11.8 10.5 11C10.5 10.2 11.2 9.5 12 9.5C12.8 9.5 13.5 10.2 13.5 11C13.5 11.8 12.8 12.5 12 12.5Z" fill="white" />
    </svg>
  );
}

// SAP Logo - Blue with SAP text
export function SAPLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#0070F2" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">SAP</text>
    </svg>
  );
}

// commercetools Logo - CT in circle
export function CommercetoolsLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="11" fill="#1A1A1A" stroke="#6359E9" strokeWidth="2" />
      <text x="12" y="16" textAnchor="middle" fill="#6359E9" fontSize="9" fontWeight="bold" fontFamily="Arial">ct</text>
    </svg>
  );
}

// BigCommerce Logo - BC in hexagon
export function BigCommerceLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#121118" />
      <path d="M6 8H10C11.1 8 12 8.9 12 10C12 10.7 11.6 11.4 11 11.7C11.8 12 12.5 12.8 12.5 13.8C12.5 15 11.5 16 10.3 16H6V8ZM8 11H9.5C10 11 10.5 10.6 10.5 10C10.5 9.4 10 9 9.5 9H8V11ZM8 15H9.8C10.4 15 10.9 14.5 10.9 13.9C10.9 13.3 10.4 12.8 9.8 12.8H8V15Z" fill="white" />
      <path d="M14 10C14 8.9 14.9 8 16 8H18V9.5H16.3C15.9 9.5 15.5 9.9 15.5 10.3V11H18V12.5H15.5V16H14V10Z" fill="white" />
    </svg>
  );
}

// Magento Logo - M in orange
export function MagentoLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#F46F25" />
      <path d="M12 5L6 8V16L8 17V10L12 8L16 10V17L18 16V8L12 5Z" fill="white" />
      <path d="M10 11V18L12 19L14 18V11L12 10L10 11Z" fill="white" />
    </svg>
  );
}

// VTEX Logo
export function VTEXLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#F71963" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="Arial">VTEX</text>
    </svg>
  );
}

// Elasticsearch Logo - Search icon
export function ElasticsearchLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#FEC514" />
      <circle cx="11" cy="11" r="5" stroke="#343741" strokeWidth="2" fill="none" />
      <path d="M15 15L19 19" stroke="#343741" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Amplience Logo - Purple with distinctive wave pattern (content amplification)
export function AmplienceLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#7B2D8E" />
      {/* Amplify/wave icon - distinctive brand mark */}
      <path d="M6 15 L9 9 L12 13 L15 7 L18 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="6" cy="15" r="1.5" fill="white" />
      <circle cx="18" cy="15" r="1.5" fill="white" />
    </svg>
  );
}

// Spryker Logo - Orange S shape
export function SprykerLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#EC6921" />
      <path d="M16 8C16 6.9 15.1 6 14 6H10C8.9 6 8 6.9 8 8V9H14V10H10C8.9 10 8 10.9 8 12V16C8 17.1 8.9 18 10 18H14C15.1 18 16 17.1 16 16V15H10V14H14C15.1 14 16 13.1 16 12V8Z" fill="white" />
    </svg>
  );
}

// Generic "All" icon
export function AllPartnersLogo({ size = 24, className }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <rect width="24" height="24" rx="4" fill="#5468FF" />
      <circle cx="8" cy="8" r="2" fill="white" />
      <circle cx="16" cy="8" r="2" fill="white" />
      <circle cx="8" cy="16" r="2" fill="white" />
      <circle cx="16" cy="16" r="2" fill="white" />
    </svg>
  );
}

// Logo component map for easy lookup
export const PartnerLogoMap: Record<string, React.FC<LogoProps>> = {
  all: AllPartnersLogo,
  adobe: AdobeLogo,
  salesforce: SalesforceLogo,
  shopify: ShopifyLogo,
  sap: SAPLogo,
  commercetools: CommercetoolsLogo,
  bigcommerce: BigCommerceLogo,
  magento: MagentoLogo,
  vtex: VTEXLogo,
  elastic: ElasticsearchLogo,
  amplience: AmplienceLogo,
  spryker: SprykerLogo,
};

export function getPartnerLogo(partnerKey: string): React.FC<LogoProps> {
  return PartnerLogoMap[partnerKey] || AllPartnersLogo;
}
