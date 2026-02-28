/**
 * ICP Data - Derived from Customer Evidence Analysis
 * Source: docs/system/ICP_ANALYSIS.md
 */

export interface EvidenceLevel {
  id: string;
  name: string;
  count: number;
  description: string;
  color: string;
}

export interface IndustryEvidence {
  industry: string;
  proofPoints: number;
  stories: number;
  quotes: number;
  logos: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface BuyerPersona {
  id: string;
  name: string;
  percentage: number;
  titles: string[];
  themes: string[];
  sampleQuote: string;
  sampleSpeaker: string;
  sampleCompany: string;
  caseStudyUrl?: string;
  color: string;
}

export interface TechPlatform {
  name: string;
  count: number;
  category: 'Commerce' | 'CMS';
}

export interface Competitor {
  name: string;
  count: number;
}

export interface ICPData {
  evidenceLevels: EvidenceLevel[];
  industries: IndustryEvidence[];
  personas: BuyerPersona[];
  techPlatforms: TechPlatform[];
  competitors: Competitor[];
}

// Evidence Pyramid Data (bottom to top)
export const evidenceLevels: EvidenceLevel[] = [
  {
    id: 'logos',
    name: 'Customer Logos',
    count: 1306,
    description: 'Full customer base - who they are',
    color: '#003DFF', // Algolia Blue
  },
  {
    id: 'proofpoints',
    name: 'Proof Points',
    count: 81,
    description: 'Quantified results - what they achieved',
    color: '#10b981', // Green
  },
  {
    id: 'stories',
    name: 'Customer Stories',
    count: 82,
    description: 'Detailed use cases - how they use us',
    color: '#f59e0b', // Amber
  },
  {
    id: 'quotes',
    name: 'Customer Quotes',
    count: 379,
    description: 'Voice of customer - what they say about us',
    color: '#8b5cf6', // Purple
  },
  {
    id: 'icp',
    name: 'ICP Definition',
    count: 3,
    description: 'Data-derived segments - who to target',
    color: '#5468FF', // Algolia Purple
  },
];

// Industry Distribution with Cross-Reference Evidence
export const industries: IndustryEvidence[] = [
  {
    industry: 'Fashion/Apparel',
    proofPoints: 53,
    stories: 15,
    quotes: 120,
    logos: 70,
    confidence: 'HIGH',
  },
  {
    industry: 'Grocery/Food',
    proofPoints: 28,
    stories: 7,
    quotes: 45,
    logos: 30,
    confidence: 'HIGH',
  },
  {
    industry: 'Retail E-commerce',
    proofPoints: 0,
    stories: 17,
    quotes: 202,
    logos: 650,
    confidence: 'HIGH',
  },
  {
    industry: 'SaaS',
    proofPoints: 0,
    stories: 2,
    quotes: 56,
    logos: 36,
    confidence: 'MEDIUM',
  },
  {
    industry: 'B2B E-commerce',
    proofPoints: 0,
    stories: 4,
    quotes: 31,
    logos: 30,
    confidence: 'MEDIUM',
  },
  {
    industry: 'Media/Publishing',
    proofPoints: 0,
    stories: 3,
    quotes: 18,
    logos: 16,
    confidence: 'LOW',
  },
];

// Buyer Personas derived from 379 quotes
export const personas: BuyerPersona[] = [
  {
    id: 'technical-leader',
    name: 'Technical Decision Maker',
    percentage: 30,
    titles: ['CTO', 'VP Engineering', 'Head of Engineering', 'Principal Architect'],
    themes: ['Performance', 'Scale', 'Speed of implementation', 'Integration ease'],
    sampleQuote: 'Speed of search request, speed of execution. This is why our attention turned to Algolia.',
    sampleSpeaker: 'Pascal Sardella',
    sampleCompany: 'TAG Heuer',
    caseStudyUrl: 'https://www.algolia.com/customers/tag-heuer/',
    color: '#003DFF',
  },
  {
    id: 'digital-experience',
    name: 'Digital Experience Owner',
    percentage: 26,
    titles: ['Director E-Commerce', 'VP Digital', 'Director of Digital Experience', 'Head of Product'],
    themes: ['Conversion', 'Relevance', 'User experience', 'Mobile'],
    sampleQuote: 'Delivering a fast, relevant experience to our online customers is a top priority.',
    sampleSpeaker: 'Digital Team',
    sampleCompany: 'Under Armour',
    caseStudyUrl: 'https://www.algolia.com/customers/under-armour/',
    color: '#5468FF',
  },
  {
    id: 'merchandising',
    name: 'Merchandising Champion',
    percentage: 14,
    titles: ['Sr Manager Digital Merchandising', 'Director Customer Experience', 'Merchandising Manager'],
    themes: ['A/B testing', 'Revenue optimization', 'AI-powered ranking'],
    sampleQuote: 'AI-powered merchandising has driven 5-20% revenue uplift in controlled experiments.',
    sampleSpeaker: 'E-Commerce Team',
    sampleCompany: 'Lacoste',
    caseStudyUrl: 'https://www.algolia.com/customers/lacoste/',
    color: '#f59e0b',
  },
  {
    id: 'operations',
    name: 'Operations Executive',
    percentage: 9,
    titles: ['COO', 'VP Operations', 'Director of Operations'],
    themes: ['Efficiency', 'Reduced manual work', 'Stability'],
    sampleQuote: 'With Algolia you don\'t need a lot of knowledge or people to use Search in a smart way.',
    sampleSpeaker: 'Alex Bloemendal',
    sampleCompany: 'Zeeman',
    caseStudyUrl: 'https://www.algolia.com/customers/zeeman/',
    color: '#10b981',
  },
];

// Tech Platform Distribution
export const techPlatforms: TechPlatform[] = [
  { name: 'Shopify', count: 29, category: 'Commerce' },
  { name: 'Magento', count: 20, category: 'Commerce' },
  { name: 'SFCC', count: 7, category: 'Commerce' },
  { name: 'Adobe AEM', count: 7, category: 'CMS' },
  { name: 'SAP Commerce', count: 9, category: 'Commerce' },
  { name: 'Contentful', count: 5, category: 'CMS' },
  { name: 'Commercetools', count: 6, category: 'Commerce' },
  { name: 'BigCommerce', count: 4, category: 'Commerce' },
];

// Competitors Displaced (Top 6 search competitors for Algolia)
export const competitors: Competitor[] = [
  { name: 'Elastic', count: 56 },
  { name: 'Bloomreach', count: 28 },
  { name: 'Constructor', count: 24 },
  { name: 'Coveo', count: 19 },
  { name: 'SearchSpring', count: 13 },
  { name: 'Yext', count: 11 },
];

// Primary ICP Summary
export const icpSummary = {
  primary: {
    segments: ['Fashion/Apparel', 'Grocery/Food', 'Retail E-commerce'],
    confidence: 'HIGH',
    evidence: 'Strong across all 4 levels (Logos, Proof Points, Stories, Quotes)',
  },
  secondary: {
    segments: ['SaaS', 'B2B E-commerce'],
    confidence: 'MEDIUM',
    evidence: 'Many quotes but few proof points - need case studies',
  },
  geography: {
    top: ['US (33%)', 'UK (12%)', 'Netherlands (6%)', 'Australia (6%)'],
    regions: ['EMEA (40%)', 'North America (39%)', 'APAC (10%)'],
  },
};

// Aggregate data export
export const icpData: ICPData = {
  evidenceLevels,
  industries,
  personas,
  techPlatforms,
  competitors,
};
