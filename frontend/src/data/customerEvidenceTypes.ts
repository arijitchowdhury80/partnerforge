/**
 * Customer Evidence Types
 * Data extracted from Customer Evidence Excel file
 */

export interface Quote {
  text: string;
  speaker: string;
  title: string;
  source: string;  // TechValidate, G2, Customer Interview, etc.
}

export interface CustomerEvidence {
  company: string;
  storyUrl: string | null;
  industry: string;
  useCase: string;
  country: string;
  region: string;
  featuresUsed: string[];
  quotes: Quote[];
  metrics: string[];
}

export interface EvidenceStats {
  totalCompanies: number;
  withStoryUrl: number;
  withQuotes: number;
  totalQuotes: number;
}

export interface CustomerEvidenceData {
  companies: CustomerEvidence[];
  byIndustry: Record<string, string[]>;
  stats: EvidenceStats;
}

// Industry node data for mind map
export interface IndustryData {
  id: string;
  name: string;
  count: number;
  companies: CustomerEvidence[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  proofPoints: number;
  color: string;
}

// Normalized industry mapping
export const INDUSTRY_CONFIG: Record<string, { name: string; color: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; proofPoints: number }> = {
  'Fashion/Apparel': { name: 'Fashion/Apparel', color: '#dc2626', confidence: 'HIGH', proofPoints: 53 },
  'Grocery/Food': { name: 'Grocery/Food', color: '#16a34a', confidence: 'HIGH', proofPoints: 28 },
  'Retail E-commerce': { name: 'Retail E-commerce', color: '#2563eb', confidence: 'HIGH', proofPoints: 0 },
  'SaaS': { name: 'SaaS', color: '#7c3aed', confidence: 'MEDIUM', proofPoints: 0 },
  'B2B E-commerce': { name: 'B2B E-commerce', color: '#0891b2', confidence: 'MEDIUM', proofPoints: 0 },
  'Media/Publishing': { name: 'Media/Publishing', color: '#ea580c', confidence: 'LOW', proofPoints: 0 },
  'Other': { name: 'Other', color: '#64748b', confidence: 'LOW', proofPoints: 0 },
};
