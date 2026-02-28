-- Arian Seed Data: Technologies
-- Partners and Competitors that Algolia cares about

-- ============================================
-- PARTNER TECHNOLOGIES
-- ============================================

INSERT INTO technologies (name, category, sub_category, is_partner, is_competitor, builtwith_name, description) VALUES

-- Adobe Ecosystem
('Adobe Experience Manager', 'CMS', 'Enterprise CMS', true, false, 'Adobe Experience Manager', 'Enterprise content management platform'),
('Adobe Commerce', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'Magento', 'Enterprise ecommerce platform (formerly Magento)'),
('Adobe Experience Platform', 'CDP', 'Customer Data Platform', true, false, 'Adobe Experience Platform', 'Real-time customer data platform'),
('Adobe Analytics', 'Analytics', 'Web Analytics', true, false, 'Adobe Analytics', 'Enterprise analytics solution'),
('Adobe Target', 'Personalization', 'A/B Testing', true, false, 'Adobe Target', 'Personalization and A/B testing'),

-- Shopify Ecosystem
('Shopify', 'Ecommerce', 'SMB Ecommerce', true, false, 'Shopify', 'Ecommerce platform for SMB'),
('Shopify Plus', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'Shopify Plus', 'Enterprise tier of Shopify'),

-- Salesforce Ecosystem
('Salesforce Commerce Cloud', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'Salesforce Commerce Cloud', 'Enterprise B2C commerce platform'),
('Salesforce B2B Commerce', 'Ecommerce', 'B2B Ecommerce', true, false, 'Salesforce B2B Commerce', 'B2B commerce platform'),
('Salesforce', 'CRM', 'CRM', true, false, 'Salesforce', 'CRM platform'),
('MuleSoft', 'Integration', 'API Management', true, false, 'MuleSoft', 'API-led connectivity platform'),

-- Commercetools
('commercetools', 'Ecommerce', 'Headless Commerce', true, false, 'commercetools', 'Headless commerce platform'),

-- BigCommerce
('BigCommerce', 'Ecommerce', 'Mid-Market Ecommerce', true, false, 'BigCommerce', 'Ecommerce platform'),
('BigCommerce Enterprise', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'BigCommerce Enterprise', 'Enterprise ecommerce'),

-- SAP
('SAP Commerce Cloud', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'SAP Commerce Cloud', 'Enterprise commerce platform'),
('SAP Hybris', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'SAP Hybris', 'Legacy name for SAP Commerce'),

-- VTEX
('VTEX', 'Ecommerce', 'Enterprise Ecommerce', true, false, 'VTEX', 'Digital commerce platform'),

-- Headless CMS Partners
('Contentful', 'CMS', 'Headless CMS', true, false, 'Contentful', 'Headless content management'),
('Sanity', 'CMS', 'Headless CMS', true, false, 'Sanity', 'Headless content platform'),
('Contentstack', 'CMS', 'Headless CMS', true, false, 'Contentstack', 'Headless CMS'),
('Strapi', 'CMS', 'Headless CMS', true, false, 'Strapi', 'Open-source headless CMS'),
('Prismic', 'CMS', 'Headless CMS', true, false, 'Prismic', 'Headless website builder'),

-- Frontend Frameworks (Integration Partners)
('Next.js', 'Framework', 'Frontend', true, false, 'Next.js', 'React framework by Vercel'),
('Nuxt.js', 'Framework', 'Frontend', true, false, 'Nuxt.js', 'Vue.js framework'),
('Gatsby', 'Framework', 'Frontend', true, false, 'Gatsby', 'React-based static site generator'),

-- Other Commerce/Retail Tech Partners
('Amplience', 'CMS', 'Commerce CMS', true, false, 'Amplience', 'Headless commerce content'),
('Bloomreach Content', 'CMS', 'Commerce CMS', true, false, 'Bloomreach Content', 'Digital experience platform (CMS side)'),
('Akeneo', 'PIM', 'Product Information', true, false, 'Akeneo', 'Product information management'),
('Salsify', 'PIM', 'Product Information', true, false, 'Salsify', 'Product experience management'),

-- Personalization Partners
('Dynamic Yield', 'Personalization', 'Personalization', true, false, 'Dynamic Yield', 'Personalization platform'),
('Optimizely', 'Personalization', 'A/B Testing', true, false, 'Optimizely', 'Digital experience platform'),

-- CDP Partners
('Segment', 'CDP', 'Customer Data Platform', true, false, 'Segment', 'Customer data platform'),
('mParticle', 'CDP', 'Customer Data Platform', true, false, 'mParticle', 'Customer data platform'),
('Tealium', 'CDP', 'Tag Management', true, false, 'Tealium', 'Customer data hub'),

-- ============================================
-- COMPETITOR TECHNOLOGIES
-- ============================================

-- Direct Search Competitors
('Coveo', 'Search', 'Enterprise Search', false, true, 'Coveo', 'AI-powered relevance platform'),
('Elasticsearch', 'Search', 'Open Source Search', false, true, 'Elasticsearch', 'Open-source search engine'),
('Elastic Cloud', 'Search', 'Managed Search', false, true, 'Elastic Cloud', 'Managed Elasticsearch'),
('Bloomreach Discovery', 'Search', 'Commerce Search', false, true, 'Bloomreach', 'Commerce search and merchandising'),
('Constructor.io', 'Search', 'Commerce Search', false, true, 'Constructor', 'AI-first product discovery'),
('Lucidworks', 'Search', 'Enterprise Search', false, true, 'Lucidworks', 'AI-powered search platform'),
('Searchspring', 'Search', 'Ecommerce Search', false, true, 'Searchspring', 'Ecommerce search platform'),
('Klevu', 'Search', 'Ecommerce Search', false, true, 'Klevu', 'AI search for ecommerce'),
('Nosto', 'Search', 'Ecommerce Personalization', false, true, 'Nosto', 'Commerce experience platform'),
('Attraqt', 'Search', 'Ecommerce Search', false, true, 'Attraqt', 'Product discovery platform'),
('Hawksearch', 'Search', 'Ecommerce Search', false, true, 'Hawksearch', 'Site search solution'),
('Yext', 'Search', 'Answers Platform', false, true, 'Yext', 'Answers platform'),
('Swiftype', 'Search', 'Site Search', false, true, 'Swiftype', 'Site search (Elastic)'),
('Doofinder', 'Search', 'Ecommerce Search', false, true, 'Doofinder', 'Ecommerce search'),
('Sajari', 'Search', 'Site Search', false, true, 'Sajari', 'AI search platform'),
('Meilisearch', 'Search', 'Open Source Search', false, true, 'Meilisearch', 'Open-source search'),
('Typesense', 'Search', 'Open Source Search', false, true, 'Typesense', 'Open-source search'),

-- Indirect Competitors (Platform Search)
('Salesforce Einstein Search', 'Search', 'Platform Search', false, true, 'Salesforce Einstein', 'Salesforce native search'),
('Amazon CloudSearch', 'Search', 'Cloud Search', false, true, 'Amazon CloudSearch', 'AWS managed search'),
('Google Cloud Search', 'Search', 'Cloud Search', false, true, 'Google Cloud Search', 'Google workspace search'),
('Azure Cognitive Search', 'Search', 'Cloud Search', false, true, 'Azure Cognitive Search', 'Microsoft Azure search'),

-- Recommendation Competitors
('Recombee', 'Recommendations', 'Recommendation Engine', false, true, 'Recombee', 'AI recommendations'),
('Barilliance', 'Recommendations', 'Ecommerce Personalization', false, true, 'Barilliance', 'Ecommerce personalization'),
('RichRelevance', 'Recommendations', 'Personalization', false, true, 'RichRelevance', 'Omnichannel personalization');

-- ============================================
-- ALGOLIA (for tracking our own presence)
-- ============================================

INSERT INTO technologies (name, category, sub_category, is_partner, is_competitor, builtwith_name, description) VALUES
('Algolia', 'Search', 'Site Search', false, false, 'Algolia', 'AI-powered search and discovery'),
('Algolia Recommend', 'Recommendations', 'Recommendation Engine', false, false, 'Algolia Recommend', 'AI recommendations by Algolia'),
('Algolia Answers', 'Search', 'Semantic Search', false, false, 'Algolia Answers', 'Semantic search by Algolia');
